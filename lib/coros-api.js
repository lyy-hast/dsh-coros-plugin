/**
 * COROS MCP protocol client.
 *
 * Everything here is transport + parsing only: no Cordis, no DSH, no filesystem.
 * That keeps the OAuth dance testable from a plain `node script.mjs`.
 *
 * Login flow (verified end to end against mcpcn.coros.com):
 *   1. POST /connect/register            -> client_id (dynamic client registration)
 *   2. POST /api/v1/cli/login-sessions   -> sessionId / pollToken / loginUrl
 *   3. the user signs in inside an iframe pointed at loginUrl
 *   4. POST /api/v1/cli/login-sessions/<id>/claim  -> loginTicket (one shot!)
 *   5. GET  authorize_url + &login_ticket=... -> 302 -> <redirect_uri>?code=...
 *   6. POST /oauth2/token                -> access_token + refresh_token
 */

import { createHash, randomBytes } from 'node:crypto'

export const REGIONS = {
  cn: 'https://mcpcn.coros.com',
  eu: 'https://mcpeu.coros.com',
  us: 'https://mcpus.coros.com',
}

export const DEFAULT_REGION = 'cn'
export const SCOPES = 'openid offline_access mcp.tools'
export const REDIRECT_URI = 'http://127.0.0.1:43123/callback'
export const CLIENT_NAME = 'DeepSeek Harness COROS Sport'
export const PROTOCOL_VERSION = '2025-06-18'
export const POLL_INTERVAL_MS = 3000
/** Renew an access token that is within this many seconds of expiring. */
export const REFRESH_SKEW_SECONDS = 600

export function resolveIssuer(region, override) {
  if (override) return String(override).replace(/\/+$/, '')
  return REGIONS[region] ?? REGIONS[DEFAULT_REGION]
}

export function mcpUrlFor(issuer) {
  return `${issuer}/mcp`
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

export function randomUrlSafe(size = 32) {
  return randomBytes(size).toString('base64url')
}

export function createPkce() {
  const verifier = randomUrlSafe(48)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function buildAuthorizeUrl({ issuer, mcpUrl, clientId, redirectUri, scopes, challenge, state }) {
  const url = new URL(`${issuer}/oauth2/authorize`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scopes)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('resource', mcpUrl)
  url.searchParams.set('state', state)
  return url.toString()
}

async function readJson(res) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

/** Dynamic client registration. COROS silently drops `device_code` from grant_types. */
export async function registerClient(issuer, { redirectUri = REDIRECT_URI, scopes = SCOPES } = {}) {
  const res = await fetch(`${issuer}/connect/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: scopes,
    }),
  })
  const payload = await readJson(res)
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`client registration failed (HTTP ${res.status})`)
  }
  if (!payload.client_id) throw new Error('client registration returned no client_id')
  return payload
}

/**
 * Open a CLI login session. The returned `loginUrl` renders the COROS consent
 * page, which is the only surface that can actually authenticate a user:
 * fetching the authorize endpoint server-side answers `{"result":"1001"}`.
 */
export async function createLoginSession(issuer, clientId) {
  const res = await fetch(`${issuer}/api/v1/cli/login-sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ clientId }),
  })
  const payload = await readJson(res)
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`login session failed (HTTP ${res.status})`)
  }
  for (const field of ['sessionId', 'pollToken', 'loginUrl', 'expiresAt']) {
    if (!payload[field]) throw new Error(`login session missing ${field}`)
  }
  const interval = Number(payload.intervalSeconds)
  return {
    sessionId: String(payload.sessionId),
    pollToken: String(payload.pollToken),
    loginUrl: String(payload.loginUrl),
    expiresAt: payload.expiresAt,
    intervalMs: Number.isFinite(interval) && interval > 0 ? Math.max(1000, interval * 1000) : POLL_INTERVAL_MS,
  }
}

/**
 * One poll of a login session.
 *
 * Status is read from the body, never from the HTTP status: an unknown session
 * answers `200 {"status":"expired"}`, a missing poll token answers 500 and a
 * wrong one answers 400, so the transport code carries no meaning here.
 */
export async function claimLoginSession(issuer, sessionId, pollToken) {
  let res
  try {
    res = await fetch(`${issuer}/api/v1/cli/login-sessions/${encodeURIComponent(sessionId)}/claim`, {
      method: 'POST',
      headers: { 'x-poll-token': pollToken, accept: 'application/json' },
    })
  } catch (err) {
    return { status: 'network-error', message: String(err?.message ?? err), payload: {} }
  }
  const payload = await readJson(res)
  const status = String(payload.status ?? '').toLowerCase()
  if (status) return { status, payload }
  if (res.status === 400) return { status: 'invalid-token', message: payload.message ?? 'poll token is invalid', payload }
  if (res.status === 500) return { status: 'server-error', message: payload.result ?? 'server error', payload }
  return { status: 'unknown', message: `HTTP ${res.status}`, payload }
}

export async function exchangeCode(issuer, { clientId, redirectUri, code, verifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  })
  const res = await fetch(`${issuer}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  })
  const payload = await readJson(res)
  if (res.status !== 200 || !payload.access_token) {
    throw new Error(`token exchange failed (HTTP ${res.status}${payload.error ? `: ${payload.error}` : ''})`)
  }
  return normalizeToken(payload, clientId)
}

/**
 * Exchange a one-shot `loginTicket` for an authorization code.
 *
 * The ticket is appended to the authorize URL we built before the session
 * started, and that GET answers 302 to our loopback redirect. We never listen
 * on that port: `redirect: 'manual'` surfaces the Location header directly.
 */
export async function redeemLoginTicket({ issuer, redirectUri, state, authorizeUrl }, loginTicket) {
  const url = new URL(authorizeUrl)
  url.searchParams.append('login_ticket', loginTicket)
  const res = await fetch(url, { redirect: 'manual', headers: { accept: 'text/html' } })
  const location = res.headers.get('location')
  if (!location) throw new Error(`authorize returned HTTP ${res.status} without a redirect`)
  const target = new URL(location, issuer)
  if (!target.href.startsWith(redirectUri)) throw new Error('authorize redirected off the loopback callback')
  const code = target.searchParams.get('code')
  const returnedState = target.searchParams.get('state')
  if (!code) throw new Error('callback carried no authorization code')
  if (returnedState && state && returnedState !== state) throw new Error('callback state mismatch')
  return code
}

export async function refreshAccessToken(issuer, { clientId, refreshToken }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  })
  const res = await fetch(`${issuer}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  })
  const payload = await readJson(res)
  if (res.status !== 200 || !payload.access_token) {
    throw new Error(`token refresh failed (HTTP ${res.status}${payload.error ? `: ${payload.error}` : ''})`)
  }
  if (!payload.refresh_token) throw new Error('token refresh returned no rotated refresh_token')
  return normalizeToken(payload, clientId)
}

/**
 * Ask COROS to invalidate a token.
 *
 * Best effort by design: the caller is wiping local custody either way, and a
 * dead network must not turn "sign out" into an error the user cannot clear.
 */
export async function revokeToken(issuer, { clientId, token, tokenTypeHint = 'refresh_token' }) {
  if (!token) return false
  const body = new URLSearchParams({ token, client_id: clientId, token_type_hint: tokenTypeHint })
  const res = await fetch(`${issuer}/oauth2/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  })
  return res.status === 200
}

function normalizeToken(payload, clientId) {
  const expiresIn = Number(payload.expires_in)
  return {
    access_token: String(payload.access_token),
    refresh_token: String(payload.refresh_token),
    token_type: String(payload.token_type ?? 'Bearer'),
    scope: String(payload.scope ?? SCOPES),
    client_id: String(clientId),
    expires_at_epoch: nowSeconds() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 2591999),
    obtained_at_epoch: nowSeconds(),
  }
}

async function readMcpBody(res) {
  const contentType = String(res.headers.get('content-type') ?? '')
  const text = await res.text()
  if (!contentType.includes('text/event-stream')) return text
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')
}

/** One JSON-RPC request against the (stateless) MCP endpoint. */
export async function mcpRequest(mcpUrl, accessToken, method, params, { id = ++rpcCounter } = {}) {
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} }),
  })
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { code: 401 })
  const body = await readMcpBody(res)
  if (!body) throw new Error(`MCP ${method} returned an empty body (HTTP ${res.status})`)
  let payload
  try {
    payload = JSON.parse(body)
  } catch {
    throw new Error(`MCP ${method} returned non-JSON (HTTP ${res.status})`)
  }
  if (payload.error) throw new Error(payload.error.message ?? `MCP ${method} failed`)
  if (res.status >= 500) throw new Error(`MCP ${method} failed (HTTP ${res.status})`)
  return payload.result
}

let rpcCounter = 0

/**
 * Call one MCP tool and unwrap its human-readable text.
 *
 * COROS sends `content[0].text` as a JSON-encoded *string*, so the payload
 * arrives double-encoded and needs one extra parse before it is readable.
 */
export async function callTool(mcpUrl, accessToken, name, args = {}) {
  const result = await mcpRequest(mcpUrl, accessToken, 'tools/call', { name, arguments: args })
  const parts = Array.isArray(result?.content) ? result.content : []
  const raw = parts
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
  return { text: unwrapText(raw), isError: Boolean(result?.isError) }
}

function unwrapText(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed.startsWith('"')) return String(raw ?? '')
  try {
    const parsed = JSON.parse(trimmed)
    return typeof parsed === 'string' ? parsed : String(raw ?? '')
  } catch {
    return String(raw ?? '')
  }
}

/* ------------------------------------------------------------------ parsing */

const FIELD_RE = /^\s*([A-Za-z0-9][A-Za-z0-9 ./()_-]*?)\s*:\s*(.+?)\s*$/

function parseFields(text) {
  const out = {}
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = FIELD_RE.exec(line)
    if (match) out[match[1]] = match[2]
  }
  return out
}

/**
 * Parse `preamble | Key: value | Key: value` lines.
 *
 * The health header leads with a prose segment ("Daily Health Data — Last 3
 * days"), which no anchor-at-column-zero rule can see past, so every ` | `
 * segment is tried on its own instead.
 */
function parsePipeFields(text) {
  const out = {}
  for (const line of String(text ?? '').split(/\r?\n/)) {
    for (const segment of line.split(/\s+\|\s+/)) {
      const match = /^([A-Za-z][A-Za-z0-9 ./()_-]*?)\s*:\s*(.+)$/.exec(segment.trim())
      if (match) out[match[1]] = match[2].trim()
    }
  }
  return out
}

/** Split `A: 1 | B: 2` style values so both halves become their own field. */
function expandPipes(fields) {
  const out = {}
  for (const [key, value] of Object.entries(fields)) {
    const parts = String(value).split(/\s+\|\s+/)
    out[key] = parts[0].trim()
    for (const part of parts.slice(1)) {
      const match = /^([^:=]+?)\s*[:=]\s*(.+)$/.exec(part)
      if (match) out[match[1].trim()] = match[2].trim()
    }
  }
  return out
}

function splitNumberedBlocks(text) {
  const blocks = []
  let current = null
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = /^\s*\d+\.\s+(.+?)\s*$/.exec(line)
    if (match) {
      if (current) blocks.push(current)
      current = { title: match[1], lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) blocks.push(current)
  return blocks
}

function toNumber(value) {
  const cleaned = String(value ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  return cleaned ? Number(cleaned[0]) : undefined
}

const SCHEDULE_DATE_RE = /^\s*(\d{4}-\d{2}-\d{2})\s*$/
const RULE_RE = /^\s*[-=]{3,}\s*$/
const SCHEDULE_NOTE_RE = /^\s*Use Plan ID with\b/i

/**
 * Split the weekly schedule into one block per *date*.
 *
 * queryTrainingSchedule answers with a date line, then the course name, then
 * its `Key: value` fields, blocks separated by a blank line and closed by a
 * prose footnote:
 *
 *   2026-11-02
 *   轻松跑 40 分钟
 *   Plan ID: 481426180101292068
 *   idInPlan: 1
 *   Distance: 5.82 km
 *
 * Nothing there is numbered, so splitNumberedBlocks sees zero blocks and the
 * panel claimed "no workout this week" for an athlete with sixteen of them.
 * Only the first non-field line inside a block is the course name; later prose
 * (the Plan-ID footnote) is dropped rather than rendered as a workout.
 */
function splitScheduleBlocks(text) {
  const blocks = []
  let current = null
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (RULE_RE.test(line) || SCHEDULE_NOTE_RE.test(line)) continue
    const dateMatch = SCHEDULE_DATE_RE.exec(line)
    if (dateMatch) {
      if (current) blocks.push(current)
      current = { date: dateMatch[1], title: '', fields: {} }
      continue
    }
    if (!current) continue
    if (line.trim() === '') continue
    const fieldMatch = current.title === '' ? null : FIELD_RE.exec(line)
    if (fieldMatch) current.fields[fieldMatch[1]] = fieldMatch[2]
    else if (current.title === '') current.title = line.trim()
  }
  if (current) blocks.push(current)
  return blocks
}

export function parseUserInfo(text) {
  const f = parseFields(text)
  return {
    nickname: f.Nickname,
    gender: f.Gender,
    height: f.Height,
    weight: f.Weight,
    birthday: f.Birthday,
    raw: String(text ?? ''),
  }
}

export function parseDevices(text) {
  const devices = splitNumberedBlocks(text).map((block) => {
    const f = parseFields(block.lines.join('\n'))
    return {
      name: block.title,
      bluetoothId: f['Bluetooth ID'],
      modelName: f['Model Name'],
      serialNumber: f['Serial Number'],
      warrantyExpires: f['Warranty Expires'],
    }
  })
  const countMatch = /Bound Devices\s*\((\d+)\)/i.exec(String(text ?? ''))
  return { count: countMatch ? Number(countMatch[1]) : devices.length, devices, raw: String(text ?? '') }
}

export function parseRecovery(text) {
  const f = parseFields(text)
  return {
    percent: toNumber(f.Recovery),
    level: f.Level,
    estimatedFullRecovery: f['Estimated Full Recovery'],
    raw: String(text ?? ''),
  }
}

export function parseFitness(text) {
  const f = expandPipes(parseFields(text))
  const predictions = []
  for (const [key, value] of Object.entries(f)) {
    if (/Prediction$/i.test(key)) predictions.push({ label: key, value })
  }
  return {
    vo2max: toNumber(f.VO2max),
    runningLevel: toNumber(f['Running Level']),
    thresholdPace: f['Threshold Pace'],
    predictions,
    raw: String(text ?? ''),
  }
}

export function parseSportRecords(text) {
  const records = splitNumberedBlocks(text).map((block) => {
    const f = expandPipes(parseFields(block.lines.join('\n')))
    const [sportType, date] = String(block.title).split(/\s+—\s+/)
    return {
      sportType: sportType ?? block.title,
      date: date ?? '',
      location: f.Location,
      distance: f.Distance,
      duration: f.Duration,
      averagePace: f['Average Pace'],
      averageHeartRate: f['Avg HR'],
      calories: f.Calories,
      labelId: f.LabelId,
      sportTypeCode: f.SportType,
    }
  })
  const range = /Sport Records\s*—\s*(.+?)\s*\((\d+)\s*records?\)/i.exec(String(text ?? ''))
  return {
    range: range ? range[1] : undefined,
    records,
    raw: String(text ?? ''),
  }
}

export function parseDailyHealth(text) {
  const source = String(text ?? '')
  const header = parsePipeFields(source.split(/^---\s*\d{8}\s*---$/m)[0] ?? '')
  const days = []
  const dayRe = /^---\s*(\d{8})\s*---$/gm
  const marks = []
  let match
  while ((match = dayRe.exec(source)) !== null) marks.push({ stamp: match[1], index: match.index, end: dayRe.lastIndex })
  for (let i = 0; i < marks.length; i += 1) {
    const chunk = source.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].index : source.length)
    const f = expandPipes(parseFields(chunk))
    days.push({
      date: `${marks[i].stamp.slice(0, 4)}-${marks[i].stamp.slice(4, 6)}-${marks[i].stamp.slice(6, 8)}`,
      steps: toNumber(f.Steps),
      calories: f.Calories,
      exercise: f.Exercise,
      stress: f.Stress,
      sleepTotal: f.Total,
      sleepDeep: f.Deep,
      sleepLight: f.Light,
      sleepRem: f.REM,
      sleepAwake: f.Awake,
    })
  }
  return {
    restingHeartRate: header['Resting HR'],
    hrvBaseline: header['HRV Baseline'],
    days,
    raw: source,
  }
}

export function parseTrainingSchedule(text) {
  const source = String(text ?? '').trim()
  const empty = /^no training schedule/i.test(source) || source.length === 0
  // The live tool answers with date-headed blocks; a numbered listing is kept as
  // a fallback so an older reply shape still renders instead of going silent.
  const dated = splitScheduleBlocks(source).map((block) => ({
    date: block.date,
    title: block.title,
    ...expandPipes(block.fields),
  }))
  const entries = dated.length
    ? dated
    : splitNumberedBlocks(source).map((b) => ({ title: b.title, ...expandPipes(parseFields(b.lines.join('\n'))) }))
  return { empty, entries, raw: source }
}

const PLAN_TAG_RE = /\[[^\]]+\]/g
const PLAN_STATUS_WORD_RE = /\b(in\s*progress|not\s*started|completed)\b/i
const PLAN_DATES_RE = /^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/

// Titles arrive as "4 周日常健康跑计划 [In progress] [mcp]": the status is a
// bracket tag rather than a field, and "[mcp]" only says the record was created
// through this server. The tag is read for the status and stripped before the
// name reaches the panel.
function planStatusFromTitle(title) {
  for (const tag of String(title ?? '').match(PLAN_TAG_RE) ?? []) {
    const inner = tag.slice(1, -1).trim()
    if (PLAN_STATUS_WORD_RE.test(inner)) return inner
  }
  return undefined
}

function stripStatusTags(title) {
  return String(title ?? '').replace(PLAN_TAG_RE, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Parse the training plan *library* (not the weekly schedule).
 *
 * This is what separates the two empty states in the panel: `total === 0` with
 * `conclusive === true` means the athlete has never stored a plan, while a
 * non-empty library with an empty weekly schedule only means this week is a
 * rest week. Creating a plan is a NEW plan rather than a merge, so the "create
 * one" call to action must key off this file and never off the weekly schedule.
 *
 * The tool reports a negative answer as prose whose wording depends on the
 * filter. Measured against the live server:
 *   statusList=[0,1,2] -> "No training plans found in the user's plan library
 *                         for status filter: not started, in progress,
 *                         completed (all; statusList=[0,1,2])."
 *   statusList omitted -> "No in-progress training plans found (statusList
 *                         omitted, server default [1]). Not-started library
 *                         originals and completed plans were not searched."
 * Only the first covers the whole library. The second is genuinely unknown:
 * the athlete may own plans we never asked about. Since a false "empty" puts a
 * create button in front of someone who already has a plan, the parser asks the
 * caller to declare the scope and reports `conclusive: false` otherwise.
 */
export function parseTrainingPlanLibrary(text, { allStatuses = false } = {}) {
  const source = String(text ?? '').trim()
  const plans = splitNumberedBlocks(source).map((b) => {
    const f = expandPipes(parseFields(b.lines.join('\n')))
    const bracket = planStatusFromTitle(b.title)
    const span = PLAN_DATES_RE.exec(String(f.Dates ?? '').trim())
    return {
      title: stripStatusTags(b.title),
      planId: f['Plan ID'] ?? f.PlanId,
      // The live listing carries the status in the title ("... [In progress]")
      // rather than in a field, spells the other labels in sentence case
      // ("Record role", "Editable via MCP") and merges both ends of the plan
      // into one range ("Dates: 2026-11-02 to 2026-11-29"). Reading only the
      // field names that are never sent left status/startDate/endDate
      // undefined, which silently disabled the overlap warning shown before a
      // plan is written.
      status: f.Status ?? f['Execute Status'] ?? bracket,
      recordRole: f['Record Role'] ?? f.RecordRole ?? f['Record role'],
      editable: f.Editable ?? f['Editable via MCP'],
      startDate: f['Start Date'] ?? f.StartDate ?? (span ? span[1] : undefined),
      endDate: f['End Date'] ?? f.EndDate ?? (span ? span[2] : undefined),
    }
  })
  // Which statuses the negative answer actually covered, taken from the
  // server's own summary clause ("for status filter: ..."). Two of the three
  // measured phrasings cannot prove an empty library: the omitted-filter reply
  // carries no such clause, and the completed-only reply names one status. The
  // caller's `allStatuses` is only its claim about the request; the text has to
  // corroborate it, so a mismatched pair still reads as unknown instead of
  // conjuring a create button for someone who owns plans.
  const scope = /for status filter:\s*(.+)$/im.exec(source)
  const coversWholeLibrary =
    scope !== null && ['not started', 'in progress', 'completed'].every((s) => scope[1].toLowerCase().includes(s))
  const negative = /^no\b/i.test(source)
  const conclusive = plans.length > 0 || (negative && allStatuses && coversWholeLibrary)
  const empty = conclusive && plans.length === 0
  return {
    empty,
    conclusive,
    total: plans.length,
    inProgress: plans.filter((p) => /in\s*progress/i.test(String(p.status ?? ''))).length,
    plans,
    raw: source,
  }
}

/* ------------------------------------------------------------------- dates */

export function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysAgo(days, from = new Date()) {
  const copy = new Date(from.getTime())
  copy.setDate(copy.getDate() - days)
  return copy
}
