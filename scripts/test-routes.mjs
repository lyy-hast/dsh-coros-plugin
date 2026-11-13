/**
 * Drive the host half's HTTP routes without DSH.
 *
 *   node scripts/test-routes.mjs            # read-only previews
 *   node scripts/test-routes.mjs --write    # also performs ONE real create
 *
 * The host half only reloads on app restart, so this stands in for the GUI
 * while the module is being developed: it builds a fake `ctx` whose
 * `webServer.register` records routes, then calls the handlers with synthetic
 * requests. Same code path as production — `apply` is the real export.
 *
 * `--write` is opt-in and never the default: it stores a permanent plan in the
 * COROS account, and the API has no delete.
 */
import { Readable } from 'node:stream'
import assert from 'node:assert/strict'

import { apply } from '../lib/index.js'

const routes = new Map()

const ctx = {
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  get: () => undefined,
  inject: () => () => {},
  effect: (fn) => {
    const disposer = fn()
    return () => {
      if (typeof disposer === 'function') disposer()
    }
  },
  webServer: {
    register: ({ path, handler }) => {
      routes.set(path, handler)
      return () => routes.delete(path)
    },
  },
}

apply(ctx, {})

assert.ok(routes.size >= 8, `expected at least 8 routes, got ${routes.size}`)
console.log('registered routes:', [...routes.keys()].join(', '))

/** Minimal res double: records status + parsed JSON body. */
function makeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value
    },
    writeHead(status) {
      this.statusCode = status
      return this
    },
    end(body) {
      this.body = body ?? ''
    },
  }
  return res
}

async function call(target, { method = 'GET', body } = {}) {
  const [pathname, query] = target.split('?')
  const handler = routes.get(pathname)
  assert.ok(handler, `route ${pathname} is not registered`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = query ? `${pathname}?${query}` : pathname
  const res = makeRes()
  await handler(req, res)
  let json
  try {
    json = JSON.parse(res.body)
  } catch {
    json = { raw: res.body }
  }
  return { status: res.statusCode, json }
}

/* --------------------------------------------------------------- previews */

// The plan API only accepts a start date today or later. Keep the fixture
// relative to the clock so this script does not start failing once a hardcoded
// date falls into the past.
function nextMondayIso() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  const daysToMonday = ((8 - date.getDay()) % 7) || 7
  date.setDate(date.getDate() + daysToMonday)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
const planStart = nextMondayIso()
const planStartCompact = planStart.replace(/-/g, '')
const planMidweek = (() => {
  const date = new Date(`${planStart}T00:00:00`)
  date.setDate(date.getDate() + 3)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
})()

const preview = await call(`/coros-sport/plan/preview?startDate=${planStart}&lang=zh`)
console.log('\n[preview]', preview.status, JSON.stringify(preview.json, null, 1).slice(0, 1600))
assert.equal(preview.status, 200, 'preview must succeed')
assert.equal(preview.json.plan.totalWeeks, 4)
assert.equal(preview.json.plan.sessionCount, 16)
assert.equal(preview.json.plan.weeks.length, 4)
assert.equal(preview.json.plan.weeks[0].sessions.length, 4)
// The preview must be a real answer, not an unchecked "probably fine".
assert.equal(preview.json.preview.ok, true)
assert.deepEqual(preview.json.preview.problems, [])
assert.equal(preview.json.preview.writable, true)

const english = await call(`/coros-sport/plan/preview?startDate=${planStartCompact}&lang=en`)
assert.equal(english.status, 200)
assert.equal(english.json.plan.weeks[0].sessions[0].weekday, 'Mon')

// A mid-week date is pulled back to its Monday: the plan always starts there.
const midweek = await call(`/coros-sport/plan/preview?startDate=${planMidweek}&lang=zh`)
assert.equal(midweek.status, 200)
assert.equal(midweek.json.plan.startDate, planStart, 'a Thursday start must snap to that week Monday')

const bad = await call('/coros-sport/plan/preview?startDate=not-a-date')
assert.equal(bad.status, 400, 'a malformed startDate must be rejected')

// No parameter means "the coming Monday", so the panel needs no date input.
const defaulted = await call('/coros-sport/plan/preview?lang=zh')
assert.equal(defaulted.status, 200)
assert.match(defaulted.json.plan.startDate, /^\d{4}-\d{2}-\d{2}$/)

/* ------------------------------------------------------- write guardrails */

const refused = await call('/coros-sport/plan/write', { method: 'POST', body: { startDate: planStart } })
console.log('\n[write without confirm]', refused.status, JSON.stringify(refused.json))
assert.equal(refused.status, 400)
assert.equal(refused.json.code, 'unconfirmed')

const badJson = await call('/coros-sport/plan/write', { method: 'POST', body: undefined })
assert.equal(badJson.status, 400, 'an empty body must not write')

// The client cannot smuggle its own plan in: the host rebuilds the payload from
// its own code and ignores anything section-shaped in the body.
const tampered = await call('/coros-sport/plan/write', {
  method: 'POST',
  body: {
    startDate: planStart,
    confirm: false,
    sections: [{ sectionType: 2, targetType: 2, targetValue: 60 }],
    courseList: [{ dayNo: 0, sportType: 1, courseName: 'evil', courseDescription: '', sections: [] }],
  },
})
assert.equal(tampered.status, 400)
assert.equal(tampered.json.code, 'unconfirmed', 'a tampered body still needs confirmation')

// An unknown path is a missing route, not a handled 404 — the handler's
// `default` branch covers unknown *actions* behind real paths. Assert the
// shape that actually protects the athlete: no route outside the prefix.
assert.equal(routes.has('/coros-sport/nope'), false, 'unknown paths must not be registered')
for (const path of routes.keys()) {
  assert.ok(path.startsWith('/coros-sport/'), `route ${path} escapes the plugin prefix`)
}

/* ------------------------------------------------------------ real write */

if (process.argv.includes('--write')) {
  const report = await call('/coros-sport/plan/write', {
    method: 'POST',
    body: { startDate: planStart, lang: 'zh', confirm: true },
  })
  console.log('\n[WRITE]', report.status, JSON.stringify(report.json, null, 1))
  assert.equal(report.status, 200)
  assert.equal(report.json.report.created, true, 'the server should have accepted the plan')
} else {
  console.log('\nskipped the real create (pass --write to perform it; it is permanent)')
}

console.log('\nok — all route checks passed')
