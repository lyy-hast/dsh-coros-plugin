/**
 * Host half of the COROS Sport plugin.
 *
 * Responsibilities:
 *   - own the OAuth session (see ./coros-auth.js) and the stored token
 *   - call COROS MCP tools on behalf of the panel
 *   - expose a tiny JSON API on the DSH web server for the Client half
 *
 * The panel never talks to coros.com itself: the consent iframe is the only
 * browser-facing surface, and everything else goes through these routes.
 */

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { CorosAuth, STATUS } from './coros-auth.js'
import {
  callTool,
  daysAgo,
  formatDate,
  mcpUrlFor,
  parseDailyHealth,
  parseDevices,
  parseFitness,
  parseRecovery,
  parseSportRecords,
  parseTrainingSchedule,
  parseUserInfo,
  resolveIssuer,
} from './coros-api.js'

export const name = 'dsh-coros-sport'
export const inject = ['webServer']

const ROUTE_PREFIX = '/coros-sport'
const TOKEN_FILE = join(homedir(), '.dsh-coros-sport', 'token.json')

/**
 * File-backed credential store used when the host credential service is absent.
 *
 * The credential service is preferred because `modifyRecord` serializes writes
 * across processes; this keeps a single-file deployment working regardless.
 */
function createFileStore() {
  return {
    async readRecord() {
      try {
        const raw = await readFile(TOKEN_FILE, 'utf8')
        const payload = JSON.parse(raw)
        return payload ? { kind: 'grant', payload } : undefined
      } catch {
        return undefined
      }
    },
    async modifyRecord(_key, mutate) {
      const current = await this.readRecord()
      const next = await mutate(current)
      if (next === undefined) return current
      await mkdir(join(homedir(), '.dsh-coros-sport'), { recursive: true })
      await writeFile(TOKEN_FILE, JSON.stringify(next.payload ?? null, null, 2), { encoding: 'utf8', mode: 0o600 })
      return next
    },
    async deleteRecord() {
      await rm(TOKEN_FILE, { force: true })
    },
  }
}

export function apply(ctx, config = {}) {
  const log = (message) => {
    try {
      ctx.logger?.info?.(message)
    } catch {
      /* logging must never break a request */
    }
  }

  const credentials = ctx.get?.('credentials')
  const store = credentials ?? createFileStore()
  const auth = new CorosAuth({ credentials: store, credentialKey: 'coros-sport:oauth', log })
  const configRegion = String(config.region ?? 'cn')
  const configIssuer = config.issuer ? String(config.issuer) : undefined

  /** Run an MCP tool, refreshing once when the token turns out to be stale. */
  async function runTool(toolName, args) {
    const token = await auth.accessToken()
    const issuer = resolveIssuer(token.region ?? configRegion, token.issuer ?? configIssuer)
    try {
      return await callTool(mcpUrlFor(issuer), token.access_token, toolName, args ?? {})
    } catch (err) {
      if (err?.code !== 401) throw err
      const renewed = await auth.refresh()
      const refreshedIssuer = resolveIssuer(renewed.region ?? configRegion, renewed.issuer ?? configIssuer)
      return callTool(mcpUrlFor(refreshedIssuer), renewed.access_token, toolName, args ?? {})
    }
  }

  /**
   * Collect one panel's worth of data.
   *
   * Each tool is settled independently: a single failing tool (say, a user who
   * never recorded a workout) must not blank the whole panel.
   */
  async function collectOverview({ days = 7 } = {}) {
    const to = new Date()
    const from = daysAgo(days - 1, to)
    const jobs = {
      profile: () => runTool('queryUserInfo').then((r) => parseUserInfo(r.text)),
      devices: () => runTool('queryDevices').then((r) => parseDevices(r.text)),
      recovery: () => runTool('queryRecoveryStatus').then((r) => parseRecovery(r.text)),
      fitness: () => runTool('queryFitnessAssessmentOverview').then((r) => parseFitness(r.text)),
      activities: () => runTool('querySportRecords').then((r) => parseSportRecords(r.text)),
      health: () => runTool('queryDailyHealthData', { days }).then((r) => parseDailyHealth(r.text)),
      schedule: () => runTool('queryTrainingSchedule').then((r) => parseTrainingSchedule(r.text)),
    }
    const names = Object.keys(jobs)
    const settled = await Promise.allSettled(names.map((key) => jobs[key]()))
    const data = {}
    const errors = []
    settled.forEach((outcome, index) => {
      const key = names[index]
      if (outcome.status === 'fulfilled') data[key] = outcome.value
      else errors.push({ section: key, message: String(outcome.reason?.message ?? outcome.reason) })
    })
    return {
      range: { from: formatDate(from), to: formatDate(to), days },
      sections: data,
      errors,
      fetchedAt: new Date().toISOString(),
    }
  }

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload)
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.writeHead(status)
    res.end(body)
  }

  async function handle(req, res, action) {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      switch (action) {
        case 'status': {
          const current = await auth.status()
          return sendJson(res, 200, { ok: true, ...current })
        }
        case 'login/start': {
          const region = url.searchParams.get('region') ?? configRegion
          const started = await auth.startLogin({ region, issuer: configIssuer })
          return sendJson(res, 200, { ok: true, ...started })
        }
        case 'login/poll': {
          const loginId = url.searchParams.get('loginId') ?? ''
          const result = await auth.pollLogin(loginId)
          return sendJson(res, 200, { ok: true, ...result })
        }
        case 'login/cancel': {
          const loginId = url.searchParams.get('loginId') ?? ''
          await auth.cancelLogin(loginId)
          return sendJson(res, 200, { ok: true })
        }
        case 'logout': {
          await auth.logout()
          return sendJson(res, 200, { ok: true, state: STATUS.unauthenticated })
        }
        case 'overview': {
          const days = Number(url.searchParams.get('days') ?? 7)
          // Resolve the credential first: signed out is a 401 the panel turns
          // into its sign-in screen, not a page full of failed cards.
          await auth.accessToken()
          const overview = await collectOverview({ days: Number.isFinite(days) && days > 0 && days <= 30 ? days : 7 })
          return sendJson(res, 200, { ok: true, ...overview })
        }
        default:
          return sendJson(res, 404, { ok: false, error: 'unknown action' })
      }
    } catch (err) {
      const message = String(err?.message ?? err)
      log(`[coros] ${action} failed: ${message}`)
      const status = err?.code === 'unauthenticated' ? 401 : 500
      return sendJson(res, status, { ok: false, error: message, code: err?.code })
    }
  }

  const routes = [
    ['status', `${ROUTE_PREFIX}/status`],
    ['login/start', `${ROUTE_PREFIX}/login/start`],
    ['login/poll', `${ROUTE_PREFIX}/login/poll`],
    ['login/cancel', `${ROUTE_PREFIX}/login/cancel`],
    ['logout', `${ROUTE_PREFIX}/logout`],
    ['overview', `${ROUTE_PREFIX}/overview`],
  ]

  for (const [action, path] of routes) {
    ctx.effect(() =>
      ctx.webServer.register({
        kind: 'exact',
        path,
        handler: (req, res) => handle(req, res, action),
      }),
    )
  }
}
