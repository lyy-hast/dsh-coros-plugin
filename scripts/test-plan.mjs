/**
 * Offline checks for the training-plan modules. No network, no COROS account.
 *
 *   node scripts/test-plan.mjs
 *
 * The interesting assertions are about what must *not* leave this process. A
 * well-formed payload is easy to eyeball; a rejected one costs a round trip, and
 * a *stored* plan cannot be deleted, so the guards in front of the request are
 * the part worth testing.
 */
import assert from 'node:assert/strict'

import {
  buildTrainingPlan,
  validateCourse,
  validateTrainingPlan,
  toCreatePlanPayload,
  summarizePlan,
  normalizeStartDate,
  nextMonday,
  mondayOf,
  toCompact,
  toIso,
  SPORT_RUNNING,
} from '../lib/plan-workouts.js'
import { writeTrainingPlan, previewTrainingPlan } from '../lib/plan-writer.js'

const START = '2026-11-02'
const TODAY = new Date('2026-10-31T12:00:00+08:00')

let failures = 0
let checks = 0
const pending = []

function check(name, fn) {
  checks += 1
  try {
    const out = fn()
    if (out instanceof Promise) {
      pending.push(
        out.catch((err) => {
          failures += 1
          console.error(`FAIL ${name}\n  ${err.message}`)
        }),
      )
    }
  } catch (err) {
    failures += 1
    console.error(`FAIL ${name}\n  ${err.message}`)
  }
}

function throwsCode(fn, code) {
  try {
    fn()
  } catch (err) {
    assert.equal(err.code, code, `expected code ${code}, got ${err.code} (${err.message})`)
    return
  }
  assert.fail(`expected a throw with code ${code}`)
}

async function throwsCodeAsync(fn, code) {
  try {
    await fn()
  } catch (err) {
    assert.equal(err.code, code, `expected code ${code}, got ${err.code} (${err.message})`)
    return
  }
  assert.fail(`expected a throw with code ${code}`)
}

/* ------------------------------------------------------------------- dates */

check('nextMonday from a Saturday is the coming Monday', () => {
  assert.equal(toCompact(nextMonday(new Date('2026-10-31T19:00:00'))), '20261102')
})

check('nextMonday from a Monday is the following Monday', () => {
  assert.equal(toCompact(nextMonday(new Date('2026-11-02T09:00:00'))), '20261109')
})

check('nextMonday from a Sunday is the next day', () => {
  assert.equal(toCompact(nextMonday(new Date('2026-11-01T09:00:00'))), '20261102')
})

check('mondayOf pulls a mid-week date back to that week Monday', () => {
  assert.equal(toCompact(mondayOf(new Date('2026-11-05T09:00:00'))), '20261102')
})

check('normalizeStartDate accepts both date spellings', () => {
  assert.equal(toCompact(normalizeStartDate('2026-11-04', TODAY)), '20261102')
  assert.equal(toCompact(normalizeStartDate('20261104', TODAY)), '20261102')
})

check('normalizeStartDate defaults to the coming Monday', () => {
  assert.equal(toCompact(normalizeStartDate('', TODAY)), '20261102')
})

check('normalizeStartDate rejects a date that does not exist', () => {
  // A rolled-over Date would silently shift the whole plan by weeks.
  assert.equal(normalizeStartDate('2026-13-45', TODAY), undefined)
  assert.equal(normalizeStartDate('nonsense', TODAY), undefined)
})

/* -------------------------------------------------------------------- plan */

const plan = buildTrainingPlan({ startDate: START })

check('the built plan passes its own validation', () => {
  assert.deepEqual(validateTrainingPlan(plan, TODAY), [])
})

check('the plan is four weeks and sixteen sessions', () => {
  assert.equal(plan.totalWeeks, 4)
  assert.equal(plan.courseList.length, 16)
  assert.equal(plan.weeks.length, 4)
})

check('sessions land on Monday, Tuesday, Thursday and Sunday', () => {
  const days = plan.weeks[0].sessions.map((s) => s.dayNo)
  assert.deepEqual(days, [0, 1, 3, 6])
})

check('Wednesday and Saturday are rest days', () => {
  const dayNumbers = plan.courseList.map((c) => c.dayNo % 7)
  assert.equal(dayNumbers.includes(2), false, 'Wednesday must be free')
  assert.equal(dayNumbers.includes(5), false, 'Saturday must be free')
})

check('weekday sessions start at 18:30 and the long run at 17:30', () => {
  const times = plan.weeks.map((w) => w.sessions.map((s) => s.time))
  assert.deepEqual(times[0], ['18:30', '18:30', '18:30', '17:30'])
})

check('no course carries a start-time field', () => {
  // The API has no such field; a stray key would be rejected by the schema.
  for (const course of plan.courseList) {
    assert.deepEqual(Object.keys(course).sort(), ['courseDescription', 'courseName', 'dayNo', 'sections', 'sportType'])
  }
})

check('every course is a running course', () => {
  for (const course of plan.courseList) assert.equal(course.sportType, SPORT_RUNNING)
})

check('interval containers carry no target or intensity of their own', () => {
  for (const course of plan.courseList) {
    for (const section of course.sections) {
      if (section.intervalGroup !== true) continue
      for (const key of ['targetType', 'targetValue', 'intensityType', 'intensityValueStart', 'intensityValueEnd', 'sectionIntensity']) {
        assert.equal(section[key], undefined, `${course.courseName}: interval container has ${key}`)
      }
      for (const member of section.sets) assert.ok([2, 3].includes(member.sectionType))
    }
  }
})

check('weekly volume rises then deloads', () => {
  const km = plan.weeks.map((w) => w.distanceKm)
  assert.deepEqual(km, [37.7, 41, 40.1, 30.6])
  assert.ok(km[3] < km[0], 'the deload week must be the smallest')
})

check('every session has a duration and a distance', () => {
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      assert.ok(Number.isInteger(session.minutes) && session.minutes > 0, `${session.name} has no minutes`)
      assert.ok(session.distanceKm > 0, `${session.name} has no distance`)
      assert.match(session.detail, /\d+ 分钟/)
    }
  }
})

check('long runs grow to the third week and drop in the deload', () => {
  const longs = plan.weeks.map((w) => w.sessions[3].minutes)
  assert.deepEqual(longs, [90, 95, 100, 70])
})

check('the periodization covers exactly the plan and ends on a Sunday', () => {
  const total = plan.periodization.reduce((sum, p) => sum + p.durationWeeks, 0)
  assert.equal(total, plan.totalWeeks)
  assert.equal(toIso(new Date(Date.UTC(2026, 10, 2))), '2026-11-02')
  assert.equal(plan.periodization[0].startDate, Number(toCompact(new Date(Date.UTC(2026, 10, 2)))))
  for (const phase of plan.periodization) {
    const end = new Date(`${String(phase.endDate).slice(0, 4)}-${String(phase.endDate).slice(4, 6)}-${String(phase.endDate).slice(6, 8)}T00:00:00Z`)
    assert.equal(end.getUTCDay(), 0, `${phase.label} does not end on a Sunday`)
  }
  // Contiguous: each phase starts the day after the previous one ends.
  for (let i = 1; i < plan.periodization.length; i += 1) {
    const prevEnd = String(plan.periodization[i - 1].endDate)
    const y = Number(prevEnd.slice(0, 4))
    const m = Number(prevEnd.slice(4, 6)) - 1
    const d = Number(prevEnd.slice(6, 8))
    const next = new Date(Date.UTC(y, m, d + 1))
    assert.equal(String(plan.periodization[i].startDate), toCompact(next))
  }
})

check('the payload has the three keys the API requires', () => {
  const payload = toCreatePlanPayload(plan)
  assert.deepEqual(Object.keys(payload).sort(), ['courseList', 'phaseInfo', 'planInfo'])
  assert.ok(payload.planInfo.planName.length <= 60)
  assert.ok(payload.planInfo.planOverview.length <= 266)
  assert.equal(Number.isInteger(payload.planInfo.planStartDate), true)
  assert.equal(payload.planInfo.totalWeeks, 4)
})

check('the summary carries no section payloads', () => {
  const summary = summarizePlan(plan)
  const text = JSON.stringify(summary)
  assert.equal(text.includes('"sections"'), false)
  assert.equal(text.includes('"courseName"'), false)
  assert.equal(summary.weeks.length, 4)
})

/* -------------------------------------------------------------- validation */

check('a plan starting too far out is refused', () => {
  const far = buildTrainingPlan({ startDate: '2027-06-07' })
  const problems = validateTrainingPlan(far, TODAY)
  assert.ok(problems.some((p) => p.includes('14 days')), problems.join('; '))
})

check('a plan that does not start on a Monday is refused', () => {
  const bad = buildTrainingPlan({ startDate: '2026-11-05' })
  // buildTrainingPlan normalises to Monday, so force the broken shape instead.
  bad.startDate = '2026-11-05'
  bad.planStartDate = Number(toCompact(new Date(Date.UTC(2026, 10, 5))))
  const problems = validateTrainingPlan(bad, TODAY)
  assert.ok(problems.length > 0)
})

check('mixing two intensity formats in one section is refused', () => {
  const course = {
    dayNo: 0,
    sportType: SPORT_RUNNING,
    courseName: 'x',
    courseDescription: 'x',
    sections: [
      {
        sectionType: 2,
        targetType: 2,
        targetValue: 600,
        intensityType: 2,
        intensityValueStart: 300,
        intensityValueEnd: 310,
        sectionIntensity: 3,
      },
    ],
  }
  const problems = validateCourse(course)
  assert.ok(problems.some((p) => p.includes('intensity')), problems.join('; '))
})

check('a heart rate outside 30-240 is refused', () => {
  const course = {
    dayNo: 0,
    sportType: SPORT_RUNNING,
    courseName: 'x',
    courseDescription: 'x',
    sections: [{ sectionType: 2, targetType: 2, targetValue: 600, intensityType: 1, intensityValueStart: 120, intensityValueEnd: 300 }],
  }
  const problems = validateCourse(course)
  assert.ok(problems.some((p) => p.includes('240') || p.includes('heart')), problems.join('; '))
})

check('a pace outside 120-1499 s/km is refused', () => {
  const course = {
    dayNo: 0,
    sportType: SPORT_RUNNING,
    courseName: 'x',
    courseDescription: 'x',
    sections: [{ sectionType: 2, targetType: 2, targetValue: 600, intensityType: 2, intensityValueStart: 60, intensityValueEnd: 90 }],
  }
  const problems = validateCourse(course)
  assert.ok(problems.some((p) => p.includes('1499') || p.includes('120')), problems.join('; '))
})

check('a nested interval group is refused', () => {
  const course = {
    dayNo: 0,
    sportType: SPORT_RUNNING,
    courseName: 'x',
    courseDescription: 'x',
    sections: [
      {
        intervalGroup: true,
        repeats: 3,
        sets: [{ intervalGroup: true, repeats: 2, sets: [{ sectionType: 2, targetType: 2, targetValue: 60 }] }],
      },
    ],
  }
  const problems = validateCourse(course)
  assert.ok(problems.length > 0)
})

check('a running course with a free target is refused', () => {
  const course = {
    dayNo: 0,
    sportType: SPORT_RUNNING,
    courseName: 'x',
    courseDescription: 'x',
    sections: [{ sectionType: 2, targetType: 4, targetValue: 0, intensityType: 1, intensityValueStart: 140, intensityValueEnd: 150 }],
  }
  const problems = validateCourse(course)
  assert.ok(problems.some((p) => p.includes('targetType')), problems.join('; '))
})

check('a course without dayNo is refused for a plan', () => {
  const course = {
    sportType: SPORT_RUNNING,
    courseName: 'x',
    courseDescription: 'x',
    sections: [{ sectionType: 2, targetType: 2, targetValue: 600, intensityType: 1, intensityValueStart: 140, intensityValueEnd: 150 }],
  }
  const problems = validateCourse(course)
  assert.ok(problems.some((p) => p.includes('dayNo')), problems.join('; '))
})

/* ------------------------------------------------------------------ writer */

function makeRunner(handler) {
  const calls = []
  const runTool = async (name, args) => {
    calls.push({ name, args })
    return handler(name, args)
  }
  return { runTool, calls }
}

check('an unconfirmed write makes no network call at all', async () => {
  const { runTool, calls } = makeRunner(() => ({ text: '{}' }))
  await throwsCodeAsync(() => writeTrainingPlan({ runTool, plan, confirm: false, today: TODAY }), 'unconfirmed')
  assert.equal(calls.length, 0)
})

check('an invalid plan is refused before any network call', async () => {
  const { runTool, calls } = makeRunner(() => ({ text: '{}' }))
  const broken = buildTrainingPlan({ startDate: '2027-06-07' })
  await throwsCodeAsync(() => writeTrainingPlan({ runTool, plan: broken, confirm: true, today: TODAY }), 'invalid-plan')
  assert.equal(calls.length, 0, 'validation must happen before the request')
})

check('a confirmed write makes exactly one createTrainingPlan call', async () => {
  const { runTool, calls } = makeRunner((name) => {
    if (name === 'queryTrainingPlanLibrary') return { text: 'No training plan found.' }
    return { text: 'Training plan created successfully.' }
  })
  const report = await writeTrainingPlan({ runTool, plan, confirm: true, today: TODAY })
  assert.equal(report.created, true)
  const creates = calls.filter((c) => c.name === 'createTrainingPlan')
  assert.equal(creates.length, 1)
  assert.equal(calls.length, 2, 'one library read plus one create')
  assert.deepEqual(Object.keys(creates[0].args).sort(), ['courseList', 'phaseInfo', 'planInfo'])
})

check('the written payload has no display fields', async () => {
  let sent = null
  const { runTool } = makeRunner((name, args) => {
    if (name === 'createTrainingPlan') sent = args
    return { text: name === 'createTrainingPlan' ? 'created' : 'No training plan found.' }
  })
  await writeTrainingPlan({ runTool, plan, confirm: true, today: TODAY })
  const text = JSON.stringify(sent)
  for (const field of ['minutes', 'distanceKm', 'dateLabel', 'weekday', 'detail', 'time', 'weeks', 'theme', 'index']) {
    assert.equal(text.includes(`"${field}"`), false, `payload leaks ${field}`)
  }
})

check('a server rejection is reported, not thrown', async () => {
  const { runTool } = makeRunner((name) => {
    if (name === 'createTrainingPlan') return { text: 'courseList[0].sections: unknown field', isError: true }
    return { text: 'No training plan found.' }
  })
  const report = await writeTrainingPlan({ runTool, plan, confirm: true, today: TODAY })
  assert.equal(report.created, false)
  assert.match(report.reason, /unknown field/)
})

check('an existing overlapping plan is reported by the preview', async () => {
  const { runTool } = makeRunner((name) => {
    if (name === 'queryTrainingPlanLibrary') {
      return {
        text: '1. 秋训 4 周\nPlan ID: 12345\nStatus: In Progress\nRecord Role: Owner\nEditable: Yes\nStart Date: 2026-11-01\nEnd Date: 2026-11-28',
      }
    }
    return { text: 'created' }
  })
  const preview = await previewTrainingPlan({ runTool, plan, today: TODAY })
  assert.equal(preview.ok, true)
  assert.equal(preview.library.conflicts.length, 1)
  assert.match(preview.library.conflicts[0].title, /秋训/)
})

check('a plan in the live listing shape is still flagged as overlapping', async () => {
  // Copied from a real queryTrainingPlanLibrary reply: the status is a bracket
  // tag on the title instead of a field, the labels are sentence case, and both
  // ends of the plan arrive merged into one "Dates: a to b" line. Reading the
  // old field names yielded undefined dates, so `overlaps()` returned false and
  // the athlete was never warned before creating a second plan on top of this.
  const liveShape = [
    'Training Plan Library',
    '========================',
    'Status filter: not started, in progress, completed (all; statusList=[0,1,2])',
    'Plans on this page: 1',
    '',
    '1. 秋训 4 周 [In progress] [mcp]',
    '   Plan ID: 12345',
    '   Record role: execution',
    '   Editable via MCP: yes',
    '   Dates: 2026-11-01 to 2026-11-28',
    '   Weeks: 4',
    '   Frequency: 4.0 workouts/week',
  ].join('\n')
  const { runTool } = makeRunner((name) => {
    if (name === 'queryTrainingPlanLibrary') return { text: liveShape }
    return { text: 'created' }
  })
  const preview = await previewTrainingPlan({ runTool, plan, today: TODAY })
  assert.equal(preview.library.total, 1)
  assert.equal(preview.library.conflicts.length, 1, 'a live-shaped plan must still be seen as overlapping')
  assert.equal(preview.library.conflicts[0].title, '秋训 4 周', 'the [In progress] [mcp] tags must not leak into the name')
  assert.equal(preview.library.conflicts[0].startDate, '2026-11-01')
})

check('a plan that does not overlap is not flagged', async () => {
  const { runTool } = makeRunner((name) => {
    if (name === 'queryTrainingPlanLibrary') {
      return {
        text: '1. 春季 4 周\nPlan ID: 999\nStatus: Completed\nRecord Role: Owner\nEditable: No\nStart Date: 2026-03-02\nEnd Date: 2026-03-29',
      }
    }
    return { text: 'created' }
  })
  const preview = await previewTrainingPlan({ runTool, plan, today: TODAY })
  assert.equal(preview.library.conflicts.length, 0)
})

check('a failed library read does not block the preview', async () => {
  const { runTool } = makeRunner((name) => {
    if (name === 'queryTrainingPlanLibrary') throw new Error('network down')
    return { text: 'created' }
  })
  const preview = await previewTrainingPlan({ runTool, plan, today: TODAY })
  assert.equal(preview.ok, true)
  assert.equal(preview.writable, true)
  assert.equal(preview.library.conflicts.length, 0)
})

check('the preview never calls createTrainingPlan', async () => {
  const { runTool, calls } = makeRunner(() => ({ text: 'No training plan found.' }))
  await previewTrainingPlan({ runTool, plan, today: TODAY })
  assert.equal(calls.filter((c) => c.name === 'createTrainingPlan').length, 0)
})

/* ------------------------------------------------------------------- done */

await Promise.all(pending)

if (failures > 0) {
  console.error(`\n${failures} of ${checks} checks failed`)
  process.exit(1)
}
console.log(`ok — ${checks} checks passed`)
