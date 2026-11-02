/**
 * Render and drive the panel's training-plan block without a browser.
 *
 *   node scripts/test-client.mjs
 *
 * The client bundle is not a module: it hands a factory to
 * `window.__ModuleLoader__` and expects the host to supply React. Both are easy
 * to fake, and doing so catches what a syntax check cannot — a component that
 * parses but throws on render, a missing dict key rendering as `planTitle`, or
 * a confirm step that fires the write on the first click.
 *
 * The React stub is a real (if tiny) renderer: state setters persist, effects
 * run once on mount, and the caller can re-render — so the click path is
 * exercised rather than inspected. `fetch` is stubbed and every request is
 * recorded: the assertions care most about the one request that must NOT
 * happen before the confirmation click.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

/* ------------------------------------------------------------- React stub */

let currentInstance = null

function createElement(type, props, ...children) {
  const flat = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false && c !== true)
  const merged = props || {}
  // React puts children on props.children (a single child stays bare, several
  // become an array) and the panel's components read them from there — a stub
  // that kept them on the element instead would render empty sections.
  merged.children = flat.length <= 1 ? flat[0] : flat
  return { type, props: merged, children: flat }
}

function sameDeps(a, b) {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const React = {
  createElement,
  Fragment: 'Fragment',
  useState(initial) {
    const inst = currentInstance
    const index = inst.hookIndex++
    if (!(index in inst.hooks)) inst.hooks[index] = typeof initial === 'function' ? initial() : initial
    const setter = (next) => {
      inst.hooks[index] = typeof next === 'function' ? next(inst.hooks[index]) : next
      inst.renders += 1
    }
    return [inst.hooks[index], setter]
  },
  // The plan block fetches on mount, so this stub has to run effects — a no-op
  // would leave the component stuck in its loading state forever.
  useEffect(fn, deps) {
    const inst = currentInstance
    const index = inst.hookIndex++
    const prev = inst.hooks[index]
    if (prev && prev.__effect && sameDeps(prev.deps, deps)) return
    inst.hooks[index] = { __effect: fn, deps: deps || [], pending: true }
  },
  useRef(initial) {
    const inst = currentInstance
    const index = inst.hookIndex++
    if (!(index in inst.hooks)) inst.hooks[index] = { current: initial }
    return inst.hooks[index]
  },
  useMemo(fn) {
    return fn()
  },
}

function render(inst) {
  currentInstance = inst
  inst.hookIndex = 0
  inst.tree = inst.component(inst.props)
  currentInstance = null
  // Effects run after the tree is built, the way React schedules them.
  for (const hook of inst.hooks) {
    if (hook && hook.__effect && hook.pending) {
      hook.pending = false
      hook.__effect()
    }
  }
  return inst.tree
}

function mount(component, props) {
  const inst = { component, props, hooks: [], hookIndex: 0, tree: null, renders: 0 }
  render(inst)
  return {
    inst,
    get tree() {
      return inst.tree
    },
    /** Run something that changes state (a click), then re-render. */
    act(fn) {
      currentInstance = inst
      fn()
      currentInstance = null
      render(inst)
    },
  }
}

/**
 * Expand function components and text, the way React would.
 *
 * The registered components are thin wrappers, so without this nothing below
 * the outermost function ever runs — which is exactly the code under test.
 */
function walk(node, visit) {
  if (node === null || node === undefined || node === false) return
  if (typeof node === 'string' || typeof node === 'number') {
    visit(node)
    return
  }
  assert.equal(typeof node, 'object', 'unexpected render output: ' + typeof node)
  if (typeof node.type === 'function') {
    const inst = currentInstance
    currentInstance = inst || { hooks: [], hookIndex: 0, renders: 0 }
    const subtree = node.type(node.props)
    currentInstance = inst
    walk(subtree, visit)
    return
  }
  visit(node)
  for (const child of node.children || []) walk(child, visit)
}

function texts(tree) {
  const out = []
  walk(tree, (node) => {
    if (typeof node === 'string' || typeof node === 'number') out.push(String(node))
  })
  return out
}

function buttons(tree) {
  const out = []
  walk(tree, (node) => {
    if (typeof node === 'object' && node.type === 'button' && typeof node.props.onClick === 'function') out.push(node)
  })
  return out
}

function labelsOf(button) {
  return button.children.filter((child) => typeof child === 'string').join('')
}

function findButton(tree, fragment) {
  const hit = buttons(tree).find((button) => labelsOf(button).includes(fragment))
  assert.ok(hit, `no button labelled "${fragment}" — found: ${buttons(tree).map(labelsOf).join(' / ')}`)
  return hit
}

function hasButton(tree, fragment) {
  return buttons(tree).some((button) => labelsOf(button).includes(fragment))
}

/* ------------------------------------------------------------ load bundle */

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

// Expose the plan component for the duration of the test by appending one
// assignment to the factory. A string replace on purpose: exporting panel
// internals from production code only to make them testable is a worse trade.
const instrumented = source.replace(
  "return { inject: ['slots'], apply: apply }",
  "window.__t = { PlanSection: PlanSection, ScheduleSection: ScheduleSection, makeT: makeT };\n    return { inject: ['slots'], apply: apply }",
)
assert.notEqual(instrumented, source, 'the harness must have found the factory return')

let factory
const sandbox = { __ModuleLoader__: { load: (options) => { factory = options.factory } } }
new Function('window', 'React', 'module', 'exports', instrumented)(sandbox, React, { exports: {} }, {})
assert.equal(typeof factory, 'function', 'the bundle must register a factory')

const module_ = factory((name) => {
  assert.equal(name, 'react', 'the bundle only requires react')
  return React
})
assert.deepEqual(module_.inject, ['slots'], 'the panel declares only the slots service')

/* ----------------------------------------------- render through the slots */

const registered = new Map()
const slots = {
  inject: (_name, fn) => fn(),
  register: (options, component) => {
    // Key on slot name + panel id: the main panel and the sidebar row share the
    // panel id by design, so keying on the id alone would collapse them.
    registered.set(`${options.name}:${options.key ?? options.id ?? ''}`, component)
    return () => {}
  },
}

module_.apply({
  get: () => null,
  slots,
  logger: { info: () => {}, warn: () => {} },
})
assert.equal(registered.size, 2, 'the panel and its sidebar icon must both register')

const Panel = registered.get('main:coros-sport')
assert.ok(Panel, 'the main panel must be registered under its id')

/* ------------------------------------------ drive the plan block itself */

const { PlanSection, makeT } = sandbox.__t
assert.equal(typeof PlanSection, 'function')
const t = makeT('zh')

// Every request the component makes, so the "no write before confirm" rule can
// be asserted on the wire rather than on the render.
const calls = []
let nextResponse = { ok: true, status: 200, body: {} }
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), method: (init && init.method) || 'GET', body: init && init.body })
  const body = nextResponse.body
  return {
    ok: nextResponse.ok,
    status: nextResponse.status,
    json: async () => body,
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Shape matches what GET /plan/preview returns (summarizePlan + preview). */
const plan = {
  planName: '4 周日常健康跑计划',
  planOverview: '以轻松跑为主，每周一节阈值课，周末一次长距离。',
  startDate: '2026-11-02',
  endDate: '2026-11-29',
  totalWeeks: 4,
  sessionCount: 16,
  totalDistanceKm: 149.4,
  weeks: [
    {
      index: 1,
      label: '第 1 周',
      theme: '建立节奏',
      weekStart: '2026-11-02',
      weekEnd: '2026-11-08',
      distanceKm: 37.7,
      sessions: [
        { date: '20261102', dateLabel: '11-02', weekday: '周一', time: '18:30', name: '轻松跑 40 分钟', detail: '约 40 分钟', distanceKm: 6.4 },
        { date: '20261103', dateLabel: '11-03', weekday: '周二', time: '18:30', name: '轻松跑 + 4 组加速跑', detail: '约 45 分钟', distanceKm: 7.3 },
        { date: '20261105', dateLabel: '11-05', weekday: '周四', time: '18:30', name: '阈值课 3 × 8 分钟', detail: '约 58 分钟', distanceKm: 10 },
        { date: '20261108', dateLabel: '11-08', weekday: '周日', time: '17:30', name: '长距离 90 分钟', detail: '约 90 分钟', distanceKm: 14 },
      ],
    },
    {
      index: 2,
      label: '第 2 周',
      theme: '加长阈值',
      weekStart: '2026-11-09',
      weekEnd: '2026-11-15',
      distanceKm: 41,
      sessions: [
        { date: '20261109', dateLabel: '11-09', weekday: '周一', time: '18:30', name: '轻松跑 45 分钟', detail: '约 45 分钟', distanceKm: 7.2 },
      ],
    },
  ],
}

const previewOk = {
  ok: true,
  plan: plan,
  preview: { ok: true, problems: [], writable: true, library: { conflicts: [] } },
}

// The response has to be in place before mounting: the component checks on
// mount, so the very first request is already in flight by the time mount()
// returns.
nextResponse = { ok: true, status: 200, body: previewOk }

let wroteCallback = 0
// `today` is pinned: the component opens on the week containing today, so a
// real clock would make these assertions depend on the day the suite runs.
const view = mount(PlanSection, { t, locale: 'zh', today: '2026-10-30', onWritten: () => { wroteCallback += 1 } })

// --- mount ---------------------------------------------------------------
let text = texts(view.tree).join(' | ')
assert.ok(text.includes('训练计划'), 'the section title must render: ' + text)
assert.ok(text.includes('正在读取'), 'the block starts in its loading state: ' + text)
assert.equal(calls.length, 1, 'mounting must fetch the plan exactly once')
assert.equal(calls[0].url, '/coros-sport/plan/preview?lang=zh', 'the check must be a read of the plan route')
assert.equal(calls[0].method, 'GET', 'the check step must be a GET')
console.log('mount ok:', text.slice(0, 60))

// --- ready (read-only preview) ------------------------------------------
await flush()
view.act(() => {})

text = texts(view.tree).join(' | ')
assert.ok(text.includes('2026-11-02 → 2026-11-29'), 'the section meta must span the plan: ' + text)
assert.ok(text.includes('4 周 16 节'), 'the meta must count weeks and sessions: ' + text)
assert.ok(text.includes('4 周日常健康跑计划'), 'the plan name must be shown')
assert.ok(text.includes('第 1 周'), 'weeks must be grouped: ' + text)
assert.ok(text.includes('建立节奏'), 'each week must carry its theme')
assert.ok(text.includes('37.7 km'), 'each week must carry its volume')
assert.ok(text.includes('11-02 周一'), 'each session must show its date and weekday: ' + text)
assert.ok(text.includes('18:30 · 约 40 分钟 · 6.4 km'), 'each session must show time, duration and distance: ' + text)
assert.ok(text.includes('17:30'), 'the long run must keep its own time slot')
assert.ok(text.includes('写入不可撤销'), 'the permanence warning must be on screen before any click: ' + text)
assert.ok(text.includes('接口没有开始时间字段'), 'the start-time caveat must be visible too')
assert.ok(hasButton(view.tree, '创建训练计划'), 'a create button must appear when the plan is valid')
assert.equal(calls.length, 1, 'rendering the plan must not send anything further')
assert.ok(!text.includes('第 2 周'), 'only the current week is rendered, not all of them: ' + text)
assert.ok(text.includes('第 1 / 2 周'), 'the pager must say where the athlete is: ' + text)
console.log('ready state ok')

// --- week pager ---------------------------------------------------------
// Switching weeks is local state: four weeks of rows is a wall of text, so the
// athlete sees one week and pages through the rest without re-reading the plan.
const prev = findButton(view.tree, '上一周')
assert.equal(prev.props.disabled, true, 'the first week has no previous week')
view.act(() => findButton(view.tree, '下一周').props.onClick())
text = texts(view.tree).join(' | ')
assert.ok(text.includes('第 2 / 2 周'), 'the pager must follow the click: ' + text)
assert.ok(text.includes('第 2 周'), 'the second week must render: ' + text)
assert.ok(text.includes('加长阈值'), 'the second week keeps its theme: ' + text)
assert.ok(text.includes('41 km'), 'the second week keeps its volume: ' + text)
assert.ok(text.includes('11-09 周一'), 'the second week keeps its sessions: ' + text)
assert.ok(!text.includes('建立节奏'), 'the first week must be gone, not stacked below')
assert.equal(findButton(view.tree, '下一周').props.disabled, true, 'the last week has no next week')
assert.equal(calls.length, 1, 'paging must not refetch the plan')
view.act(() => findButton(view.tree, '上一周').props.onClick())
text = texts(view.tree).join(' | ')
assert.ok(text.includes('第 1 / 2 周'), 'paging back must return to the first week')
assert.ok(!text.includes('加长阈值'), 'paging back must drop the second week')
assert.ok(hasButton(view.tree, '创建训练计划'), 'paging must not disturb the create action')
console.log('week pager ok')

// --- confirm gate -------------------------------------------------------
// The whole point of the two-step flow: the plan is on screen, and the first
// click changes only local state.
view.act(() => findButton(view.tree, '创建训练计划').props.onClick())
assert.equal(calls.length, 1, 'the first click must NOT write')
text = texts(view.tree).join(' | ')
assert.ok(text.includes('确认创建，写入 16 节'), 'the confirm button must name the count: ' + text)
assert.ok(text.includes('无法撤销'), 'the confirm step must warn that it is permanent')
console.log('confirm gate ok — no request yet')

// Cancelling returns to the preview without touching the account.
view.act(() => findButton(view.tree, '取消').props.onClick())
assert.equal(calls.length, 1, 'cancelling must not write')
assert.ok(hasButton(view.tree, '创建训练计划'), 'cancelling returns to the create button')
assert.ok(!hasButton(view.tree, '确认创建，写入 16 节'), 'cancelling drops the confirm button')

// --- write --------------------------------------------------------------
nextResponse = {
  ok: true,
  status: 200,
  body: {
    ok: true,
    plan: plan,
    report: { created: true, planName: '4 周日常健康跑计划', startDate: '2026-11-02', endDate: '2026-11-29', totalWeeks: 4, sessionCount: 16 },
  },
}
view.act(() => findButton(view.tree, '创建训练计划').props.onClick())
view.act(() => findButton(view.tree, '确认创建，写入 16 节').props.onClick())
await flush()
view.act(() => {})

const write = calls[1]
assert.equal(calls.length, 2, 'confirming sends exactly one more request')
assert.equal(write.url, '/coros-sport/plan/write')
assert.equal(write.method, 'POST')
const sent = JSON.parse(write.body)
assert.equal(sent.confirm, true, 'the write must carry an explicit confirm')
assert.equal(sent.startDate, '2026-11-02', 'the write must target the plan that was previewed')
assert.equal(sent.courseList, undefined, 'the client must not send course payloads — the host rebuilds them')
assert.equal(sent.sections, undefined, 'there is no per-day payload any more')
assert.equal(wroteCallback, 1, 'a successful write must ask the dashboard to refresh')

text = texts(view.tree).join(' | ')
assert.ok(text.includes('已创建「4 周日常健康跑计划」，16 节'), 'the result must report what landed: ' + text)
console.log('write state ok')

// --- rejected write -----------------------------------------------------
// COROS refusing the plan is not an exception: the route reports
// created:false, and that must read as a failure, not a success.
nextResponse = {
  ok: true,
  status: 200,
  body: { ok: true, plan: plan, report: { created: false, reason: 'planStartDate out of range' } },
}
view.act(() => findButton(view.tree, '重新读取').props.onClick())
await flush()
view.act(() => {})
view.act(() => findButton(view.tree, '创建训练计划').props.onClick())
view.act(() => findButton(view.tree, '确认创建，写入 16 节').props.onClick())
await flush()
view.act(() => {})
text = texts(view.tree).join(' | ')
assert.ok(text.includes('高驰没有接受这份计划'), 'a rejection must say so: ' + text)
assert.ok(text.includes('planStartDate out of range'), 'a rejection must carry the reason: ' + text)
assert.ok(!text.includes('已创建'), 'a rejection must not claim success')
console.log('rejected path ok')

// --- failed write -------------------------------------------------------
// A transport/validation failure keeps the plan on screen with the error, so
// the athlete can see what went wrong and retry.
const callsBeforeFailure = calls.length
nextResponse = { ok: true, status: 200, body: previewOk }
view.act(() => findButton(view.tree, '重新读取').props.onClick())
await flush()
view.act(() => {})
view.act(() => findButton(view.tree, '创建训练计划').props.onClick())
// The stub fails the *write*, not the read: swap the response after the
// confirm gate is on screen so the recheck above stays honest.
nextResponse = { ok: false, status: 400, body: { ok: false, error: 'server said no', code: 'invalid-plan' } }
view.act(() => findButton(view.tree, '确认创建，写入 16 节').props.onClick())
await flush()
view.act(() => {})
assert.equal(calls.length, callsBeforeFailure + 2, 'recheck then write')
text = texts(view.tree).join(' | ')
assert.ok(text.includes('server said no'), 'a failed write must show the error: ' + text)
assert.ok(!text.includes('已创建'), 'a failed write must not claim success')
assert.ok(hasButton(view.tree, '创建训练计划'), 'a failed write must leave a way to retry: ' + text)
console.log('failed-write path ok')

// --- conflicts ----------------------------------------------------------
// Two plans on the same dates is the one mistake this screen can prevent, so
// the warning has to name the existing plan.
nextResponse = {
  ok: true,
  status: 200,
  body: {
    ok: true,
    plan: plan,
    preview: {
      ok: true,
      problems: [],
      writable: true,
      library: { conflicts: [{ title: '旧计划', startDate: '2026-11-02', endDate: '2026-11-15' }] },
    },
  },
}
view.act(() => findButton(view.tree, '重新读取').props.onClick())
await flush()
view.act(() => {})
text = texts(view.tree).join(' | ')
assert.ok(text.includes('已有计划覆盖同一段时间'), 'an overlapping plan must be called out: ' + text)
assert.ok(text.includes('旧计划 2026-11-02→2026-11-15'), 'the warning must name the plan it collides with: ' + text)
console.log('conflict warning ok')

// --- failed check -------------------------------------------------------
// A failed read has nothing trustworthy to show, so it drops back to a state
// with one action: try again.
nextResponse = { ok: false, status: 500, body: { ok: false, error: 'boom' } }
view.act(() => findButton(view.tree, '重新读取').props.onClick())
await flush()
view.act(() => {})
text = texts(view.tree).join(' | ')
assert.ok(text.includes('boom'), 'a failed check must show the error: ' + text)
assert.ok(hasButton(view.tree, '重新读取'), 'a failed check must offer a retry: ' + text)
assert.ok(!hasButton(view.tree, '创建训练计划'), 'a failed check must not leave a create button behind')
assert.ok(!text.includes('第 1 周'), 'a failed check must not leave a stale plan on screen')
console.log('failed-check path ok')

/* ----------------------------------------------- dict completeness checks */

// A missing key falls back to the key name itself, which renders as `planTitle`
// in the middle of a sentence — so assert every key the block can reach is
// translated in both locales, not just the one this machine happens to use.
const PLAN_KEYS = [
  'planTitle',
  'planHint',
  'planNoTime',
  'planChecking',
  'planRange',
  'planCreateAction',
  'planConfirm',
  'planCancel',
  'planDanger',
  'planCreating',
  'planCreated',
  'planRejected',
  'planConflict',
  'planReload',
]
for (const locale of ['zh', 'en']) {
  const translate = makeT(locale)
  for (const key of PLAN_KEYS) {
    assert.notEqual(translate(key), key, `${locale} is missing dict key ${key}`)
  }
}

// The keys from the abandoned per-day flow must be gone, not merely unused:
// a leftover string is how a dead feature gets resurrected by accident.
const dictSource = source.slice(source.indexOf('var DICT'), source.indexOf('function makeT'))
assert.ok(dictSource.length > 0, 'DICT must be findable')
for (const stale of ['planWritableCount', 'planStatusWillWrite', 'planWriteAction', 'planReasonDayOccupied']) {
  assert.equal(dictSource.includes(stale + ':'), false, `stale dict key ${stale} must be removed`)
}

/* -------------------------- drive the schedule block from a real response */

// The schedule tool answers with one dated block per session, which is a
// different shape from the numbered blocks every other tool uses. The parser
// was fixed to read it; this asserts the panel above it finally shows sessions
// instead of claiming the week is empty.
{
  const { ScheduleSection } = sandbox.__t
  assert.equal(typeof ScheduleSection, 'function')

  const schedule = {
    empty: false,
    entries: [
      { date: '2026-11-02', title: '轻松跑 40 分钟', Distance: '5.82 km', 'Estimated Time': '40:00' },
      { date: '2026-11-03', title: '轻松跑 + 4 组加速跑', Distance: '6.76 km', 'Estimated Time': '45:20' },
      { date: '2026-11-05', title: '阈值课 3 × 8 分钟', Distance: '9.81 km', 'Estimated Time': '1:01:52' },
      { date: '2026-11-08', title: '长距离 90 分钟', Distance: '13.96 km', 'Estimated Time': '1:30:00' },
    ],
    raw: '',
  }

  // A plan library that knows about plans: "no session this week" would be a
  // wrong statement now that the sessions are actually parsed.
  const library = { conclusive: true, empty: false, total: 2, plans: [] }

  const scheduleView = mount(ScheduleSection, { t, today: '2026-10-30', data: schedule, library, loading: false })
  const scheduleText = texts(scheduleView.tree).join(' | ')
  assert.ok(scheduleText.includes('轻松跑 40 分钟'), 'sessions must render, not the empty state: ' + scheduleText)
  assert.ok(scheduleText.includes('阈值课 3 × 8 分钟'), 'every session in the window must be available')
  assert.ok(!scheduleText.includes('本周暂无训练课'), 'a parsed week must never claim to be empty')
  assert.ok(scheduleText.includes('5.82 km'), 'the distance on the response must be shown: ' + scheduleText)
  assert.ok(!scheduleText.includes('481426180101292068'), 'the plan id is an implementation detail and must stay hidden')
  assert.equal(buttons(scheduleView.tree).length, 0, 'a week with sessions offers no creation button')
  console.log('schedule rows ok')

  // A plan is always written starting the next Monday, so right after creating
  // one the week-scoped schedule is legitimately empty. Saying only "no workout
  // this week" while a plan is listed right below reads like a bug, so the card
  // names the start date instead.
  const upcoming = {
    conclusive: true,
    empty: false,
    total: 2,
    plans: [
      { title: '4 周日常健康跑计划', status: 'In progress', startDate: '2026-11-02', endDate: '2026-11-29' },
      { title: '4 周日常健康跑计划', status: 'Not started', startDate: '2026-12-07', endDate: '2027-01-03' },
    ],
  }
  const restView = mount(ScheduleSection, {
    t,
    today: '2026-10-30',
    data: { empty: true, entries: [], raw: '' },
    library: upcoming,
    loading: false,
  })
  const restText = texts(restView.tree).join(' | ')
  assert.ok(restText.includes('共 2 个计划'), 'the rest week must still report the plans: ' + restText)
  assert.ok(restText.includes('2026-11-02'), 'the soonest plan start must be named: ' + restText)
  assert.equal(buttons(restView.tree).length, 0, 'a rest week on an existing plan must not offer creation')

  // With no usable dates the card stays at the plain sentence rather than
  // inventing one.
  const undatedView = mount(ScheduleSection, {
    t,
    today: '2026-10-30',
    data: { empty: true, entries: [], raw: '' },
    library: { conclusive: true, empty: false, total: 1, plans: [{ title: 'x' }] },
    loading: false,
  })
  const undatedText = texts(undatedView.tree).join(' | ')
  assert.ok(undatedText.includes('本周暂无训练课'), 'an undated library keeps the original wording')
  assert.ok(!undatedText.includes('训练从'), 'no start date may be invented: ' + undatedText)
  console.log('rest week note ok')
}

console.log('\nok — client plan flow renders, gates and writes correctly')
