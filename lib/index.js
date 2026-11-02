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

import { randomUUID } from 'node:crypto'
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
  parseTrainingPlanLibrary,
  parseTrainingSchedule,
  parseUserInfo,
  resolveIssuer,
} from './coros-api.js'
import { buildTrainingPlan, normalizeStartDate, summarizePlan, toIso } from './plan-workouts.js'
import { previewTrainingPlan, writeTrainingPlan } from './plan-writer.js'

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
      // The plan *library*, not the weekly schedule. The panel needs both to
      // tell "never had a plan" apart from "rest week", and only the former may
      // offer to create one: createTrainingPlan stores a NEW plan instead of
      // merging into the running one. `allStatuses` mirrors the statusList
      // below; the parser uses it to decide whether a negative answer really
      // covers the whole library.
      planLibrary: () =>
        runTool('queryTrainingPlanLibrary', { statusList: [0, 1, 2] }).then((r) =>
          parseTrainingPlanLibrary(r.text, { allStatuses: true }),
        ),
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

  /**
   * Read a small JSON body.
   *
   * The only route with a body caps it: this endpoint writes to the athlete's
   * account, and an unbounded `readFile` on a request stream is a free way to
   * exhaust memory.
   */
  function readJsonBody(req, limitBytes = 8 * 1024) {
    return new Promise((resolve, reject) => {
      let size = 0
      const chunks = []
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > limitBytes) {
          reject(Object.assign(new Error('request body too large'), { code: 'too-large' }))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8').trim()
        if (!text) return resolve({})
        try {
          const parsed = JSON.parse(text)
          resolve(parsed && typeof parsed === 'object' ? parsed : {})
        } catch {
          reject(Object.assign(new Error('invalid JSON body'), { code: 'invalid-json' }))
        }
      })
      req.on('error', reject)
    })
  }

  async function handle(req, res, action) {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      switch (action) {
        case 'status': {
          const current = await auth.status()
          return sendJson(res, 200, { ok: true, ...current })
        }
        case 'plan/preview': {
          // Read-only: this validates the plan and reports any plan already
          // covering the same weeks. The panel shows exactly this before asking.
          await auth.accessToken()
          const start = normalizeStartDate(url.searchParams.get('startDate') ?? '', new Date())
          if (!start) return sendJson(res, 400, { ok: false, error: 'startDate must be YYYY-MM-DD or yyyyMMdd' })
          const plan = buildTrainingPlan({ startDate: toIso(start), lang: url.searchParams.get('lang') ?? 'zh' })
          const preview = await previewTrainingPlan({ runTool, plan, today: new Date() })
          return sendJson(res, 200, { ok: true, plan: summarizePlan(plan), preview })
        }
        case 'plan/write': {
          // The only route in this plugin that changes the athlete's account.
          // `confirm` is not a formality: it is the difference between showing
          // a plan and storing one, and the write is not reversible.
          await auth.accessToken()
          const body = await readJsonBody(req)
          if (body.confirm !== true) {
            return sendJson(res, 400, { ok: false, error: 'write not confirmed', code: 'unconfirmed' })
          }
          // The client sends the window it showed, but the host rebuilds the
          // payload from its own code: a tampered or stale body must not be
          // able to write arbitrary sections into the account.
          const start = normalizeStartDate(body.startDate ?? '', new Date())
          if (!start) return sendJson(res, 400, { ok: false, error: 'startDate must be YYYY-MM-DD or yyyyMMdd' })
          const plan = buildTrainingPlan({ startDate: toIso(start), lang: body.lang ?? 'zh' })
          const report = await writeTrainingPlan({ runTool, plan, confirm: true, today: new Date() })
          log(`[coros] plan create: ${report.created ? 'created' : 'rejected'} ${plan.planName} (${plan.startDate}..${plan.endDate})`)
          return sendJson(res, 200, { ok: true, plan: summarizePlan(plan), report })
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
      const code = err?.code
      const status = code === 'unauthenticated' ? 401 : code === 'invalid-plan' || code === 'unconfirmed' || code === 'out-of-window' || code === 'invalid-json' || code === 'too-large' ? 400 : 500
      return sendJson(res, status, { ok: false, error: message, code, problems: err?.problems })
    }
  }

  const routes = [
    ['status', `${ROUTE_PREFIX}/status`],
    ['login/start', `${ROUTE_PREFIX}/login/start`],
    ['login/poll', `${ROUTE_PREFIX}/login/poll`],
    ['login/cancel', `${ROUTE_PREFIX}/login/cancel`],
    ['logout', `${ROUTE_PREFIX}/logout`],
    ['overview', `${ROUTE_PREFIX}/overview`],
    ['plan/preview', `${ROUTE_PREFIX}/plan/preview`],
    ['plan/write', `${ROUTE_PREFIX}/plan/write`],
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

  /* ------------------------------------------------------------- command */

  /**
   * Compose the athlete's real numbers into the prompt half of the turn.
   *
   * The model gets one plain-text briefing rather than the raw tool payloads:
   * the panel's parsers already turned prose into fields, and re-flattening
   * them keeps the turn small enough to stay cheap on every invocation. It is
   * written to be safe to paste into a conversation, so it only carries what
   * the COROS tools returned — no token, no ids the model cannot use.
   */
  function buildPlanBriefing({ goal, overview }) {
    const { sections = {}, range } = overview ?? {}
    const lines = []
    lines.push('以下是我在高驰（COROS）账号里的真实训练数据，请据此为我制定训练计划。')
    if (goal) lines.push('', `我的目标：${goal}`)

    const profile = sections.profile
    if (profile?.nickname || profile?.weight) {
      const facts = [profile.nickname && `昵称 ${profile.nickname}`, profile.gender && `性别 ${profile.gender}`, profile.height && `身高 ${profile.height}`, profile.weight && `体重 ${profile.weight}`].filter(Boolean)
      if (facts.length > 0) lines.push('', `【个人信息】${facts.join('，')}`)
    }

    const recovery = sections.recovery
    if (recovery?.percent !== undefined || recovery?.level) {
      lines.push('', `【恢复状态】${[recovery.percent !== undefined && `恢复度 ${recovery.percent}%`, recovery.level && `等级 ${recovery.level}`, recovery.estimatedFullRecovery && `预计完全恢复 ${recovery.estimatedFullRecovery}`].filter(Boolean).join('，')}`)
    }

    const fitness = sections.fitness
    if (fitness && (fitness.vo2max !== undefined || fitness.thresholdPace || (fitness.predictions ?? []).length > 0)) {
      const facts = [fitness.vo2max !== undefined && `VO2max ${fitness.vo2max}`, fitness.runningLevel !== undefined && `跑力 ${fitness.runningLevel}`, fitness.thresholdPace && `阈值配速 ${fitness.thresholdPace}`].filter(Boolean)
      lines.push('', `【体能评估】${facts.join('，') || '—'}`)
      const predictions = (fitness.predictions ?? []).slice(0, 5)
      if (predictions.length > 0) lines.push('成绩预测：', ...predictions.map((p) => `  - ${p.label}：${p.value}`))
    }

    const records = (sections.activities?.records ?? []).slice(0, 8)
    if (records.length > 0) {
      lines.push('', '【近期训练记录】')
      for (const record of records) {
        const parts = [record.sportType, record.date, record.distance, record.duration, record.averagePace && `配速 ${record.averagePace}`, record.averageHeartRate && `心率 ${record.averageHeartRate}`].filter(Boolean)
        lines.push(`  - ${parts.join(' | ')}`)
      }
    }

    const schedule = sections.schedule
    if (schedule?.empty) lines.push('', `【本周安排】（${range?.from ?? ''} 至 ${range?.to ?? ''}）暂无训练课`)
    else {
      const entries = (schedule?.entries ?? []).slice(0, 8)
      if (entries.length > 0) {
        lines.push('', '【本周安排】')
        for (const entry of entries) {
          const parts = Object.entries(entry).filter(([key]) => key !== 'title').slice(0, 5).map(([key, value]) => `${key} ${value}`)
          lines.push(`  - ${[entry.title, ...parts].filter(Boolean).join(' | ')}`)
        }
      }
    }

    const library = sections.planLibrary
    if (library?.total > 0) {
      lines.push('', `【已有训练计划】${library.total} 个${library.inProgress > 0 ? `，其中 ${library.inProgress} 个进行中` : ''}`)
      for (const plan of (library.plans ?? []).slice(0, 5)) {
        const parts = [plan.title, plan.status, plan.startDate && `开始 ${plan.startDate}`, plan.endDate && `结束 ${plan.endDate}`].filter(Boolean)
        lines.push(`  - ${parts.join(' | ')}`)
      }
    } else {
      lines.push('', '【已有训练计划】账号里还没有任何训练计划。')
    }

    lines.push(
      '',
      '要求：',
      '1. 先用上面的数据说明你为什么这样安排（强度、恢复、时间窗）。',
      '2. 给出逐周的计划表，每节课写明类型、时长或距离、目标强度。',
      '3. 如果我的目标与当前体能或恢复状态不匹配，直接指出并调整。',
      '4. 现在只给出计划文本；写入高驰账号我会另行确认。',
    )
    return lines.join('\n')
  }

  /** Wrap one plain-text prompt as a user-role message the loop can admit. */
  function createTextMessage(text) {
    return {
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'user' },
    }
  }

  // `commands` is deliberately NOT in the module-level `inject`: a profile built
  // without `@deepseek-ai/dsh-commands` would then leave this whole plugin
  // unloaded, panel included. Scoped inject loads the command only where the
  // service exists and keeps the read-only panel working everywhere else.
  ctx.inject(['commands'], (commandCtx) =>
    commandCtx.effect(() =>
      commandCtx.commands.register({
        name: 'coros-plan',
        description: '读取高驰账号的训练数据，并结合你的提示词生成一份训练计划',
        // Declaring `input` is what makes the client render a chip for this
        // command; without it the command still runs but never appears as a
        // token in the composer.
        input: { hint: '训练目标，例如：6 周后跑完 10 公里' },
        handler: async (invocation) => {
          const goal = String(invocation.rawInput ?? '').trim()
          try {
            await auth.accessToken()
          } catch (err) {
            if (err?.code === 'unauthenticated') {
              return {
                kind: 'error',
                text: '高驰账号还没有登录。请先在侧边栏的「高驰运动」面板里完成登录，再使用 /coros-plan。',
              }
            }
            throw err
          }
          try {
            const overview = await collectOverview({ days: 7 })
            const failed = overview.errors ?? []
            const text = buildPlanBriefing({ goal, overview })
            await invocation.agent.followup(createTextMessage(text))
            const note = failed.length > 0 ? `（${failed.length} 项数据暂时没取到，已跳过）` : ''
            return { kind: 'success', text: `已读取你的高驰数据${note}，正在生成训练计划。` }
          } catch (err) {
            const message = String(err?.message ?? err)
            log(`[coros] /coros-plan failed: ${message}`)
            return { kind: 'error', text: `读取高驰数据失败：${message}` }
          }
        },
      }),
    ),
  )
}
