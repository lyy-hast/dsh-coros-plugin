/**
 * Render and drive the panel's training-plan page without a browser.
 *
 *   node scripts/test-client.mjs
 *
 * The client bundle is not a module: it hands a factory to
 * `window.__ModuleLoader__` and expects the host to supply React. Both are easy
 * to fake, and doing so catches what a syntax check cannot — a component that
 * parses but throws on render, a missing dict key rendering as `planTitle`, or
 * a confirm step that fires the write on the first click.
 *
 * The plan used to be a block inside the dashboard. It is now a page of its
 * own, opened from the schedule header and left through a back button, so the
 * tests follow that shape: the dashboard must no longer carry the plan, the
 * schedule header must carry the way in, the page must show every week at
 * once, and the back button must land on the dashboard again.
 *
 * The React stub is a real (if tiny) renderer: state setters persist, effects
 * run once on mount, nested function components get their own hook storage,
 * and the caller can re-render — so the click path is exercised rather than
 * inspected. `fetch` is stubbed and every request is recorded: the assertions
 * care most about the one request that must NOT happen before the confirmation
 * click.
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
  // Which component instance created this element: that is the parent when the
  // walk reaches a nested component, and it is what lets two siblings of the
  // same type keep separate hook storage.
  return { type, props: merged, children: flat, owner: currentInstance }
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
  // The plan page fetches on mount, so this stub has to run effects — a no-op
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

function newInstance(component, props) {
  return { component, props, hooks: [], hookIndex: 0, renders: 0, tree: null, children_by_path: new Map() }
}

function childInstance(parent, component, props, path) {
  if (!parent.children_by_path) parent.children_by_path = new Map()
  let child = parent.children_by_path.get(path)
  // A different component in the same position is a different component: the
  // panel swaps the dashboard for the plan page, and the two must not share
  // hooks. The path, not a running counter, is the key — reading the tree twice
  // has to land on the same instances, or every pass would start from scratch
  // and async results would never appear.
  if (!child || child.component !== component) {
    child = newInstance(component, props)
    parent.children_by_path.set(path, child)
  }
  child.props = props
  return child
}

function renderInstance(inst) {
  currentInstance = inst
  inst.hookIndex = 0
  inst.tree = inst.component(inst.props)
  currentInstance = null
  // Effects run after the tree is built, the way React schedules them. A child
  // effect calling its own setter only marks it for the next render, which is
  // what the test's text reads drive.
  for (const hook of inst.hooks) {
    if (hook && hook.__effect && hook.pending) {
      hook.pending = false
      hook.__effect()
    }
  }
  return inst.tree
}

let rootInstance = null

function mount(component, props) {
  const inst = newInstance(component, props)
  rootInstance = inst
  renderInstance(inst)
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
      renderInstance(inst)
    },
  }
}

/**
 * Expand function components and text, the way React would.
 *
 * The registered components are thin wrappers, so without this nothing below
 * the outermost function ever runs — which is exactly the code under test.
 * Nested components keep their own instance, so a click inside a child hits
 * that child's state and not its parent's. Instances are keyed by their path in
 * the tree, which is what makes repeated passes reuse the same state instead of
 * rebuilding the panel from scratch on every read.
 */
function walk(node, visit, parent, path) {
  if (node === null || node === undefined || node === false) return
  const at = path || 'r'
  if (typeof node === 'string' || typeof node === 'number') {
    visit(node)
    return
  }
  assert.equal(typeof node, 'object', 'unexpected render output: ' + typeof node)
  if (typeof node.type === 'function') {
    const owner = parent || rootInstance
    assert.ok(owner, 'a component must be walked from a mounted parent')
    const inst = childInstance(owner, node.type, node.props, at)
    renderInstance(inst)
    walk(inst.tree, visit, inst, at + '>')
    return
  }
  visit(node)
  const kids = node.children || []
  for (let i = 0; i < kids.length; i += 1) walk(kids[i], visit, parent, at + '/' + i)
}

function texts(tree) {
  const out = []
  walk(tree, (node) => {
    if (typeof node === 'string' || typeof node === 'number') out.push(String(node))
  })
  return out
}

function classes(tree) {
  const out = []
  walk(tree, (node) => {
    if (typeof node === 'object' && node.props && typeof node.props.className === 'string') out.push(node.props.className)
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

// Expose the panel internals for the duration of the test by appending one
// assignment to the factory. A string replace on purpose: exporting panel
// internals from production code only to make them testable is a worse trade.
const instrumented = source.replace(
  "return { inject: ['slots'], apply: apply }",
  "window.__t = { Panel: Panel, Dashboard: Dashboard, PlanPage: PlanPage, ScheduleSection: ScheduleSection, makeT: makeT, clearCachedOverview: clearCachedOverview };\n    return { inject: ['slots'], apply: apply }",
)
assert.notEqual(instrumented, source, 'the harness must have found the factory return')

let factory
function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}
const sandbox = { __ModuleLoader__: { load: (options) => { factory = options.factory } }, localStorage: createStorage() }
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

const RegisteredPanel = registered.get('main:coros-sport')
assert.ok(RegisteredPanel, 'the main panel must be registered under its id')

/* ------------------------------------------------------------- the routes */

// Every request the components make, so the "no write before confirm" rule can
// be asserted on the wire rather than on the render.
const calls = []
const routes = new Map()
globalThis.fetch = async (url, init) => {
  const path = String(url)
  calls.push({ url: path, method: (init && init.method) || 'GET', body: init && init.body })
  const route = routes.get(path) || routes.get(path.split('?')[0])
  const body = route ? route.body : { ok: false, error: 'no route for ' + path }
  return {
    ok: route ? route.ok !== false : false,
    status: route ? route.status || 200 : 404,
    json: async () => body,
  }
}
function route(path, body, options) {
  routes.set(path, { body: { ok: true, ...body }, ok: true, status: 200, ...(options || {}) })
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Let asynchronous work land and re-render until the tree stops changing.
 *
 * Reading the tree is what expands nested components, which is what lets their
 * effects fire — so a settle pass always reads text, flushes, then re-renders.
 */
async function settle(view, rounds = 6) {
  for (let i = 0; i < rounds; i += 1) texts(view.tree)
  for (let i = 0; i < rounds; i += 1) {
    await flush()
    view.act(() => {})
    texts(view.tree)
  }
}

/* -------------------------------------------------------------- test data */

const { Panel, Dashboard, PlanPage, ScheduleSection, makeT, clearCachedOverview } = sandbox.__t
assert.equal(typeof Dashboard, 'function', 'the dashboard is testable on its own')
assert.equal(typeof PlanPage, 'function', 'the plan is a page component now')
assert.equal(typeof ScheduleSection, 'function')
const t = makeT('zh')

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
    {
      index: 3,
      label: '第 3 周',
      theme: '短间歇',
      weekStart: '2026-11-16',
      weekEnd: '2026-11-22',
      distanceKm: 39,
      sessions: [
        { date: '20261116', dateLabel: '11-16', weekday: '周一', time: '18:30', name: '轻松跑 50 分钟', detail: '约 50 分钟', distanceKm: 8 },
      ],
    },
    {
      index: 4,
      label: '第 4 周',
      theme: '减量恢复',
      weekStart: '2026-11-23',
      weekEnd: '2026-11-29',
      distanceKm: 31.7,
      sessions: [
        { date: '20261123', dateLabel: '11-23', weekday: '周一', time: '18:30', name: '轻松跑 40 分钟', detail: '约 40 分钟', distanceKm: 6.4 },
      ],
    },
  ],
}

const previewOk = { plan, preview: { ok: true, problems: [], writable: true, library: { conflicts: [] } } }

/* ================================================== the plan page itself */

// The response has to be in place before mounting: the component checks on
// mount, so the very first request is already in flight by the time mount()
// returns.
route('/coros-sport/plan/preview?lang=zh', previewOk)

let wroteCallback = 0
let backClicks = 0
// `today` is pinned: the page marks the week containing today, so a real clock
// would make these assertions depend on the day the suite runs.
const view = mount(PlanPage, {
  t,
  locale: 'zh',
  today: '2026-10-30',
  onBack: () => { backClicks += 1 },
  onWritten: () => { wroteCallback += 1 },
})

// --- mount ---------------------------------------------------------------
let text = texts(view.tree).join(' | ')
assert.ok(text.includes('训练计划'), 'the page title must render: ' + text)
assert.ok(text.includes('正在读取'), 'the page starts in its loading state: ' + text)
assert.equal(calls.length, 1, 'mounting must fetch the plan exactly once')
assert.equal(calls[0].url, '/coros-sport/plan/preview?lang=zh', 'the check must be a read of the plan route')
assert.equal(calls[0].method, 'GET', 'the check step must be a GET')
console.log('mount ok:', text.slice(0, 60))

// --- ready (read-only preview) ------------------------------------------
await flush()
view.act(() => {})

text = texts(view.tree).join(' | ')
assert.ok(text.includes('2026-11-02 → 2026-11-29'), 'the page subtitle must span the plan: ' + text)
assert.ok(text.includes('4 周 16 节'), 'the subtitle must count weeks and sessions: ' + text)
assert.ok(text.includes('4 周日常健康跑计划'), 'the plan name must be shown')
assert.ok(text.includes('11-02 周一'), 'each session must show its date and weekday: ' + text)
assert.ok(text.includes('18:30 · 约 40 分钟 · 6.4 km'), 'each session must show time, duration and distance: ' + text)
assert.ok(text.includes('17:30'), 'the long run must keep its own time slot')
assert.ok(text.includes('写入不可撤销'), 'the permanence warning must be on screen before any click: ' + text)
assert.ok(text.includes('接口没有开始时间字段'), 'the start-time caveat must be visible too')
assert.ok(hasButton(view.tree, '创建训练计划'), 'a create button must appear when the plan is valid')
assert.equal(calls.length, 1, 'rendering the plan must not send anything further')
console.log('ready state ok')

// --- every week on one page ---------------------------------------------
// This is the whole point of the page: "detail" means the athlete can read the
// four weeks as one document, so the pager the dashboard block had is gone.
for (const label of ['第 1 周', '第 2 周', '第 3 周', '第 4 周']) {
  assert.ok(text.includes(label), `every week must render at once, missing ${label}: ` + text)
}
for (const theme of ['建立节奏', '加长阈值', '短间歇', '减量恢复']) {
  assert.ok(text.includes(theme), `every week keeps its theme, missing ${theme}`)
}
for (const km of ['37.7 km', '41 km', '39 km', '31.7 km']) {
  assert.ok(text.includes(km), `every week keeps its volume, missing ${km}`)
}
assert.ok(text.includes('11-23 周一'), 'the last week keeps its sessions: ' + text)
assert.ok(!hasButton(view.tree, '上一周'), 'the week pager must be gone entirely')
assert.ok(!hasButton(view.tree, '下一周'), 'the week pager must be gone entirely')
assert.equal(calls.length, 1, 'one page of weeks must cost one request')
// One 重新读取 is enough: the action row carries it, and a second copy in the
// page head would be the same button twice, one line apart.
assert.equal(
  buttons(view.tree).filter((button) => labelsOf(button) === '重新读取').length,
  1,
  'the page must not draw the reload action twice: ' + buttons(view.tree).map(labelsOf).join(' / '),
)
console.log('all weeks at once ok')

// --- the way back -------------------------------------------------------
// The page is reached from the dashboard, so it has to hand the reader back.
// This is the user's requirement stated plainly: open the detail, come back.
assert.ok(hasButton(view.tree, '返回看板'), 'the page must offer a way back: ' + text)
view.act(() => findButton(view.tree, '返回看板').props.onClick())
assert.equal(backClicks, 1, 'the back button must ask the panel to switch views')
assert.equal(calls.length, 1, 'going back must not refetch anything')
console.log('back button ok')

// --- the week the athlete is living in ----------------------------------
// With four weeks stacked, the reader needs to know which one is now. Today is
// pinned before the plan starts, so nothing may be marked: a plan that has not
// begun must not claim to be "this week".
assert.ok(!text.includes('本周'), 'a plan that has not started marks no week: ' + text)

route('/coros-sport/plan/preview?lang=zh', previewOk)
const liveView = mount(PlanPage, { t, locale: 'zh', today: '2026-11-10', onBack: () => {}, onWritten: () => {} })
await flush()
liveView.act(() => {})
const liveText = texts(liveView.tree).join(' | ')
const liveClasses = classes(liveView.tree)
assert.ok(liveText.includes('本周'), 'the current week must be labelled: ' + liveText)
assert.equal(
  liveClasses.filter((name) => name.includes('is-live')).length,
  1,
  'exactly one week may be marked as current, got: ' + JSON.stringify(liveClasses),
)
assert.ok(liveClasses.some((name) => name === 'cv2-plan-week is-live'), 'the mark must sit on the week section')
console.log('live week ok')

// --- confirm gate -------------------------------------------------------
// The whole point of the two-step flow: the plan is on screen, and the first
// click changes only local state. Counted from here so the page views mounted
// above do not have to be accounted for.
let mark = calls.length
view.act(() => findButton(view.tree, '创建训练计划').props.onClick())
assert.equal(calls.length, mark, 'the first click must NOT write')
text = texts(view.tree).join(' | ')
assert.ok(text.includes('确认创建，写入 16 节'), 'the confirm button must name the count: ' + text)
assert.ok(text.includes('无法撤销'), 'the confirm step must warn that it is permanent')
console.log('confirm gate ok — no request yet')

// Cancelling returns to the preview without touching the account.
view.act(() => findButton(view.tree, '取消').props.onClick())
assert.equal(calls.length, mark, 'cancelling must not write')
assert.ok(hasButton(view.tree, '创建训练计划'), 'cancelling returns to the create button')
assert.ok(!hasButton(view.tree, '确认创建，写入 16 节'), 'cancelling drops the confirm button')

// --- write --------------------------------------------------------------
route('/coros-sport/plan/write', {
  plan,
  report: { created: true, planName: '4 周日常健康跑计划', startDate: '2026-11-02', endDate: '2026-11-29', totalWeeks: 4, sessionCount: 16 },
})
mark = calls.length
view.act(() => findButton(view.tree, '创建训练计划').props.onClick())
view.act(() => findButton(view.tree, '确认创建，写入 16 节').props.onClick())
await flush()
view.act(() => {})

const write = calls[calls.length - 1]
assert.equal(calls.length, mark + 1, 'confirming sends exactly one request, the write')
assert.equal(write.url, '/coros-sport/plan/write')
assert.equal(write.method, 'POST')
const sent = JSON.parse(write.body)
assert.equal(sent.confirm, true, 'the write must carry an explicit confirm')
assert.equal(sent.startDate, '2026-11-02', 'the write must target the plan that was previewed')
assert.equal(sent.courseList, undefined, 'the client must not send course payloads — the host rebuilds them')
assert.equal(sent.sections, undefined, 'there is no per-day payload any more')
// The panel passes no onWritten today, but the page still calls one if it is
// given: that is what makes the hook usable by a future owner.
assert.equal(wroteCallback, 1, 'a successful write must tell whoever asked to be told')

text = texts(view.tree).join(' | ')
assert.ok(text.includes('已创建「4 周日常健康跑计划」，16 节'), 'the result must report what landed: ' + text)
console.log('write state ok')

// --- rejected write -----------------------------------------------------
// COROS refusing the plan is not an exception: the route reports
// created:false, and that must read as a failure, not a success.
route('/coros-sport/plan/write', { plan, report: { created: false, reason: 'planStartDate out of range' } })
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
route('/coros-sport/plan/write', { ok: false, error: 'server said no', code: 'invalid-plan' }, { ok: false, status: 400 })
route('/coros-sport/plan/preview?lang=zh', previewOk)
view.act(() => findButton(view.tree, '重新读取').props.onClick())
await flush()
view.act(() => {})
view.act(() => findButton(view.tree, '创建训练计划').props.onClick())
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
route('/coros-sport/plan/preview?lang=zh', {
  plan,
  preview: {
    ok: true,
    problems: [],
    writable: true,
    library: { conflicts: [{ title: '旧计划', startDate: '2026-11-02', endDate: '2026-11-15' }] },
  },
})
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
routes.set('/coros-sport/plan/preview?lang=zh', { ok: false, status: 500, body: { ok: false, error: 'boom' } })
view.act(() => findButton(view.tree, '重新读取').props.onClick())
await flush()
view.act(() => {})
text = texts(view.tree).join(' | ')
assert.ok(text.includes('boom'), 'a failed check must show the error: ' + text)
assert.ok(hasButton(view.tree, '重新读取'), 'a failed check must offer a retry: ' + text)
assert.ok(!hasButton(view.tree, '创建训练计划'), 'a failed check must not leave a create button behind')
assert.ok(!text.includes('第 1 周'), 'a failed check must not leave a stale plan on screen')
console.log('failed-check path ok')

// --- an expired session is not a failed check ---------------------------
// The page reads the account, so it can be the first to notice the session is
// gone. Offering 重新读取 there would be offering a button that cannot ever
// work; the panel owns the session, so the page has to hand it up.
routes.set('/coros-sport/plan/preview?lang=zh', {
  ok: false,
  status: 401,
  body: { ok: false, code: 'unauthenticated', error: 'session gone' },
})
let expiredCalls = 0
const expiredView = mount(PlanPage, {
  t,
  locale: 'zh',
  today: '2026-10-30',
  onBack: () => {},
  onExpired: () => { expiredCalls += 1 },
})
await settle(expiredView)
assert.equal(expiredCalls, 1, 'a dead session must be handed to the panel, not swallowed')
assert.ok(hasButton(expiredView.tree, '返回看板'), 'the back row stays: the page is still reachable')
assert.ok(!hasButton(expiredView.tree, '创建训练计划'), 'a dead session must not offer the write')

// Without an owner to hand the session to, the page must not hang on "正在
// 读取…": an unhandled 401 has to look like any other failed read.
const orphanView = mount(PlanPage, { t, locale: 'zh', today: '2026-10-30', onBack: () => {} })
await settle(orphanView)
text = texts(orphanView.tree).join(' | ')
assert.ok(text.includes('session gone'), 'an orphaned 401 must surface as an error: ' + text)
assert.ok(!text.includes('正在读取'), 'an orphaned 401 must not leave the page loading forever: ' + text)
assert.ok(hasButton(orphanView.tree, '重新读取'), 'the failed read keeps its retry')
console.log('expired session ok')

/* ==================================== the panel: dashboard <-> plan page */

// The user's requirement, end to end: the dashboard must not carry the plan,
// the schedule header must lead to it, and the back button must return.
route('/coros-sport/status', { state: 'authenticated' })
const schedule = {
  empty: false,
  entries: [
    { date: '2026-11-02', title: '轻松跑 40 分钟', Distance: '5.82 km', 'Estimated Time': '40:00' },
    { date: '2026-11-05', title: '阈值课 3 × 8 分钟', Distance: '9.81 km', 'Estimated Time': '1:01:52' },
  ],
  raw: '',
}
const library = {
  conclusive: true,
  empty: false,
  total: 1,
  plans: [{ title: '4 周日常健康跑计划', status: 'In progress', startDate: '2026-11-02', endDate: '2026-11-29' }],
}
route('/coros-sport/overview', {
  sections: { schedule, planLibrary: library, profile: { nickname: '跑者' } },
  errors: [],
  range: { days: 7 },
  fetchedAt: '2026-11-02T10:00:00+08:00',
})
route('/coros-sport/plan/preview?lang=zh', previewOk)

const panel = mount(RegisteredPanel, { t, locale: 'zh', getUiWorkspace: () => null })
await settle(panel)

let panelText = texts(panel.tree).join(' | ')
assert.ok(panelText.includes('跑者'), 'the dashboard must render once signed in: ' + panelText.slice(0, 120))
// 5.82 km is the scheduled run's distance, and 近期运动 the activities heading:
// both belong to the dashboard alone, so they mark it on screen later too.
// (The plan's own week 1 also says 轻松跑 40 分钟, which is why the session name
// alone cannot stand for "the dashboard is showing".)
assert.ok(panelText.includes('5.82 km'), 'the schedule must show this week')
assert.ok(panelText.includes('近期运动'), 'the dashboard must keep its other sections')
// Cutting the plan out of the dashboard is the ask: the block, its weeks, its
// warnings and its write button may not appear while scanning today's numbers.
assert.ok(!panelText.includes('写入不可撤销'), 'the dashboard must not show the plan warnings: ' + panelText)
assert.ok(!panelText.includes('接口没有开始时间字段'), 'the dashboard must not show the plan caveats: ' + panelText)
assert.ok(!panelText.includes('第 1 周'), 'no plan week may be rendered on the dashboard: ' + panelText)
assert.ok(!hasButton(panel.tree, '创建训练计划'), 'the dashboard must not offer the plan write: ' + panelText)
console.log('dashboard stripped of the plan ok')

// The door itself: one button in the schedule header, labelled 详细.
const detailButton = findButton(panel.tree, '详细')
const beforeOpen = calls.length
panel.act(() => detailButton.props.onClick())
await settle(panel)
assert.ok(calls.length > beforeOpen, 'opening the page must read the plan')
const openCall = calls.slice(beforeOpen).find((call) => call.url.startsWith('/coros-sport/plan/preview'))
assert.ok(openCall, 'the page must load its own plan, not borrow the dashboard data')

panelText = texts(panel.tree).join(' | ')
assert.ok(panelText.includes('4 周日常健康跑计划'), 'the plan page must show the plan a name: ' + panelText.slice(0, 200))
assert.ok(panelText.includes('第 4 周'), 'the plan page must show every week: ' + panelText)
assert.ok(panelText.includes('写入不可撤销'), 'the plan page must carry the permanence warning: ' + panelText)
assert.ok(hasButton(panel.tree, '创建训练计划'), 'the plan page must offer the write')
assert.ok(!panelText.includes('近期运动'), 'the dashboard must be gone while the page is open: ' + panelText)
assert.ok(!panelText.includes('5.82 km'), 'the dashboard schedule must be gone while the page is open: ' + panelText)
console.log('schedule header opens the plan page ok')

// ...and back again, which is the second half of the requirement.
const callsBeforeBack = calls.length
panel.act(() => findButton(panel.tree, '返回看板').props.onClick())
await settle(panel)
panelText = texts(panel.tree).join(' | ')
assert.ok(panelText.includes('近期运动'), 'going back must return to the dashboard: ' + panelText.slice(0, 200))
assert.ok(panelText.includes('5.82 km'), 'going back must bring the schedule with it: ' + panelText.slice(0, 200))
assert.ok(!panelText.includes('写入不可撤销'), 'the plan must be gone on the way back: ' + panelText)
assert.ok(hasButton(panel.tree, '详细'), 'the door must still be there after coming back')
assert.ok(!hasButton(panel.tree, '返回看板'), 'there is nowhere to go back to from the dashboard')
// The dashboard reloads on return rather than keeping a stale copy, so the
// schedule can show a plan written a moment earlier.
assert.ok(
  calls.slice(callsBeforeBack).some((call) => call.url === '/coros-sport/overview'),
  'returning must reload the dashboard, in case a plan was just written',
)
console.log('back to dashboard ok')

/* ================================== the schedule header, in isolation */

// No handler means no door: a component rendered without one (a future caller,
// a test) must not draw a button that goes nowhere.
let opens = 0
const openSection = mount(ScheduleSection, {
  t,
  today: '2026-10-30',
  data: schedule,
  library,
  loading: false,
  onOpenPlan: () => { opens += 1 },
})
assert.ok(hasButton(openSection.tree, '详细'), 'the schedule header must carry the way in')
findButton(openSection.tree, '详细').props.onClick()
assert.equal(opens, 1, 'the detail button must open the plan page')
assert.ok(texts(openSection.tree).join(' | ').includes('轻松跑 40 分钟'), 'the schedule rows must stay put')

const closedSection = mount(ScheduleSection, { t, today: '2026-10-30', data: schedule, library, loading: false })
assert.ok(!hasButton(closedSection.tree, '详细'), 'without a handler the header must carry no button')

// A fresh account is exactly where the plan page has something to offer, so
// the door is open in the empty state too.
const emptySection = mount(ScheduleSection, {
  t,
  today: '2026-10-30',
  data: { empty: true, entries: [], raw: '' },
  library: { conclusive: true, empty: true },
  loading: false,
  onCreatePlan: () => {},
  onOpenPlan: () => {},
})
assert.ok(hasButton(emptySection.tree, '详细'), 'the empty state must still lead to the plan page')

// ...but not when the schedule could not be read at all: the section's one job
// then is to offer a retry, and a door beside an error reads as if the plan
// were the problem.
const errorSection = mount(ScheduleSection, {
  t,
  today: '2026-10-30',
  data: undefined,
  loading: false,
  error: 'boom',
  onRetry: () => {},
  onOpenPlan: () => {},
})
assert.ok(!hasButton(errorSection.tree, '详细'), 'a failed schedule must not offer the plan page')
console.log('schedule entry ok')

/* ----------------------------------------------- dict completeness checks */

// A missing key falls back to the key name itself, which renders as `planTitle`
// in the middle of a sentence — so assert every key the page can reach is
// translated in both locales, not just the one this machine happens to use.
const PLAN_KEYS = [
  'planTitle',
  'planDetail',
  'planBack',
  'planPageSub',
  'planThisWeek',
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

// The keys from abandoned flows must be gone, not merely unused: a leftover
// string is how a dead feature gets resurrected by accident. The week pager is
// the newest of them — the page shows every week, so nothing pages.
const dictSource = source.slice(source.indexOf('var DICT'), source.indexOf('function makeT'))
assert.ok(dictSource.length > 0, 'DICT must be findable')
for (const stale of [
  'planWritableCount',
  'planStatusWillWrite',
  'planWriteAction',
  'planReasonDayOccupied',
  'planPrevWeek',
  'planNextWeek',
  'planWeekPos',
]) {
  assert.equal(dictSource.includes(stale + ':'), false, `stale dict key ${stale} must be removed`)
}

/* ============================ dashboard cache and refresh feedback */

// The dashboard is the expensive part of entering the panel. These tests pin
// the two asks: a remount paints the previous response before the network
// answers, and a manual refresh shows a busy icon plus a success/failure toast.
clearCachedOverview()

const overviewA = {
  sections: { schedule, planLibrary: library, profile: { nickname: '跑者 A' } },
  errors: [],
  range: { days: 7 },
  fetchedAt: '2026-11-02T10:00:00+08:00',
}
const overviewB = {
  sections: { schedule, planLibrary: library, profile: { nickname: '跑者 B' } },
  errors: [],
  range: { days: 7 },
  fetchedAt: '2026-11-02T11:00:00+08:00',
}

route('/coros-sport/overview', overviewA)
const dashboard = mount(Dashboard, { t, locale: 'zh', onSignOut: () => {}, onExpired: () => {}, onOpenPlan: () => {}, getUiWorkspace: () => null })
let dashboardText = texts(dashboard.tree).join(' | ')
assert.ok(dashboardText.includes('正在读取高驰数据'), 'the first-ever open still has a skeleton while /overview answers: ' + dashboardText)
await settle(dashboard)
dashboardText = texts(dashboard.tree).join(' | ')
assert.ok(dashboardText.includes('跑者 A'), 'the live response must replace the skeleton: ' + dashboardText)
const storedOverview = JSON.parse(sandbox.localStorage.getItem('dsh-coros-sport:overview:v1'))
assert.equal(storedOverview.data.sections.profile.nickname, '跑者 A', 'a successful overview must be cached for the next open')

const remount = mount(Dashboard, { t, locale: 'zh', onSignOut: () => {}, onExpired: () => {}, onOpenPlan: () => {}, getUiWorkspace: () => null })
const firstFrame = texts(remount.tree).join(' | ')
assert.ok(firstFrame.includes('跑者 A'), 'a remount must paint the cached profile before /overview answers: ' + firstFrame)
assert.ok(!firstFrame.includes('正在读取高驰数据'), 'a remount with a cache must not show the first-load skeleton: ' + firstFrame)
await settle(remount)
assert.ok(texts(remount.tree).join(' | ').includes('跑者 A'), 'the background refresh keeps the cached content: ' + texts(remount.tree).join(' | '))

// Manual refresh: the icon gets the busy class immediately, and the response
// produces the toast. The route changes to B so the assertion proves the panel
// actually painted the new response, not just re-rendered old data.
route('/coros-sport/overview', overviewB)
const refreshMark = calls.length
remount.act(() => findButton(remount.tree, '刷新').props.onClick())
const busyClasses = classes(remount.tree)
assert.ok(busyClasses.some((name) => name.includes('cv2-refresh') && name.includes('is-refreshing')), 'clicking refresh must spin the icon: ' + JSON.stringify(busyClasses))
assert.equal(findButton(remount.tree, '刷新').props['aria-disabled'], 'true', 'the refresh button must report its busy state while the request runs')
assert.ok(texts(remount.tree).join(' | ').includes('刷新中…'), 'the busy state must also be available to assistive tech')
await flush()
remount.act(() => {})
dashboardText = texts(remount.tree).join(' | ')
assert.ok(dashboardText.includes('跑者 B'), 'the refreshed response must land on the dashboard: ' + dashboardText)
assert.ok(dashboardText.includes('数据已更新'), 'a successful refresh must show its toast: ' + dashboardText)
assert.equal(calls.slice(refreshMark).filter((call) => call.url === '/coros-sport/overview').length, 1, 'one click costs one request')
assert.ok(!classes(remount.tree).some((name) => name.includes('is-refreshing')), 'the spinner must stop when the request finishes')
assert.equal(JSON.parse(sandbox.localStorage.getItem('dsh-coros-sport:overview:v1')).data.sections.profile.nickname, '跑者 B', 'a refresh must overwrite the cached overview')

// Failure: the old data stays, and the toast says so rather than pretending
// the refresh worked. This is the complement the old UI was missing.
route('/coros-sport/overview', { error: 'boom' }, { ok: false, status: 500 })
remount.act(() => findButton(remount.tree, '刷新').props.onClick())
await flush()
remount.act(() => {})
dashboardText = texts(remount.tree).join(' | ')
assert.ok(dashboardText.includes('跑者 B'), 'a failed refresh must keep the last data: ' + dashboardText)
assert.ok(dashboardText.includes('刷新失败，已保留上次数据'), 'a failed refresh must show a failure toast: ' + dashboardText)
assert.ok(dashboardText.includes('读取失败，已保留上次数据'), 'the existing retained-data banner must remain: ' + dashboardText)

// Dismissing the toast clears it without touching the dashboard.
const beforeDismiss = calls.length
remount.act(() => findButton(remount.tree, '×').props.onClick())
dashboardText = texts(remount.tree).join(' | ')
assert.ok(!dashboardText.includes('刷新失败，已保留上次数据'), 'the toast must be dismissible: ' + dashboardText)
assert.equal(calls.length, beforeDismiss, 'dismissing a toast must not refetch anything')
console.log('dashboard cache + refresh feedback ok')

console.log('\nok — the plan page renders, gates and writes; the dashboard links in and back')
