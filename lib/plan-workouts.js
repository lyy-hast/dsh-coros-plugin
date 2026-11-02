/**
 * The training plan this plugin offers, expressed as a `createTrainingPlan`
 * payload.
 *
 * Pure data + payload construction: no I/O, no Cordis, no filesystem, so a plain
 * node script can exercise all of it. The shapes below are built against the
 * `createTrainingPlan` input schema read from `tools/list`, and
 * `validateTrainingPlan` re-checks every rule that schema states, so a malformed
 * section is caught here instead of costing a round trip that comes back as a
 * prose error.
 *
 * What the athlete agreed to (and the reason for each choice is in the plan
 * overview, which COROS shows in the app):
 *
 *   - Goal is maintaining half-marathon fitness for everyday health running,
 *     not racing. So: no VO2max intervals, no marathon build, one quality
 *     session a week.
 *   - Four weeks, then repeat. Week 4 is a deload; the cycle restarts at week 1.
 *   - Wednesday, Friday and Saturday are rest days: the athlete asked for
 *     Wednesday off, and five days at this volume would be filler.
 *   - Intensity is prescribed as heart-rate bands for aerobic work (the ceiling
 *     is the binding constraint) and as pace for threshold work (that is what
 *     makes it threshold). Strides get a relaxed fast band, never a sprint.
 *
 * Two constraints the API imposes are handled here rather than in the panel:
 *
 *   1. A course carries a day offset but no time of day — the schema has no time
 *      field at all. The athlete's 18:30 / 17:30 window therefore lives in the
 *      course text; `time` below is display metadata for the panel and never
 *      reaches COROS.
 *   2. Each section may declare exactly one intensity format, and an interval
 *      group container must declare none at all — only its member sets carry
 *      targets. Mixing the two is the most common way this payload is rejected.
 */

export const SPORT_RUNNING = 1
const SECTION_WARMUP = 1
const SECTION_TRAINING = 2
const SECTION_RECOVERY = 3
const SECTION_COOLDOWN = 4
const TARGET_DISTANCE = 1
const TARGET_TIME = 2
const INTENSITY_HEART_RATE = 1
const INTENSITY_PACE = 2

/** Pace bands, in whole seconds per kilometre (the unit the API expects). */
const PACE = {
  threshold: [295, 305], // 4:55–5:05
  rep1000: [288, 295], // 4:48–4:55, a touch faster than threshold
  stride: [270, 285], // 4:30–4:45, relaxed fast — not a sprint
}

const HR = {
  warmup: [130, 150],
  easyA: [141, 152], // Monday: the week's calmest aerobic ceiling
  easyB: [141, 155], // Tuesday / Thursday: strides make the ceiling a little looser
  float: [130, 145], // jog recovery between strides
  floatThreshold: [130, 148], // jog recovery between threshold reps
  longRun: [145, 160],
  cooldown: [125, 145],
}

/* ------------------------------------------------------------- the sessions */

/** One plain aerobic block, used by most sessions. */
function easyBlock(seconds, band) {
  return {
    sectionType: SECTION_TRAINING,
    targetType: TARGET_TIME,
    targetValue: seconds,
    intensityType: INTENSITY_HEART_RATE,
    intensityValueStart: band[0],
    intensityValueEnd: band[1],
  }
}

/** `count` strides of `strideSeconds`, each followed by an easy jog. */
function strideGroup(count, strideSeconds, jogSeconds) {
  return {
    intervalGroup: true,
    repeats: count,
    sets: [
      {
        sectionType: SECTION_TRAINING,
        targetType: TARGET_TIME,
        targetValue: strideSeconds,
        intensityType: INTENSITY_PACE,
        intensityValueStart: PACE.stride[0],
        intensityValueEnd: PACE.stride[1],
      },
      {
        sectionType: SECTION_RECOVERY,
        targetType: TARGET_TIME,
        targetValue: jogSeconds,
        intensityType: INTENSITY_HEART_RATE,
        intensityValueStart: HR.float[0],
        intensityValueEnd: HR.float[1],
      },
    ],
  }
}

/**
 * The four-week cycle.
 *
 * Every week keeps the same shape — Monday easy, Tuesday easy + strides,
 * Thursday quality, Sunday long — so the athlete learns one rhythm instead of
 * re-reading a schedule. What changes week to week is only the quality session
 * and the aerobic volume.
 */
const WEEKS = [
  {
    theme: { zh: '建立节奏', en: 'Establish the rhythm' },
    sessions: [
      {
        dayIndex: 0,
        time: '18:30',
        minutes: 40,
        distanceKm: 6.4,
        name: { zh: '轻松跑 40 分钟', en: 'Easy run 40 min' },
        description: {
          zh: '18:30 开跑。全程轻松到能说完整句子：心率 141–152，配速 6:05–6:30。今天只积累有氧，不追速度；心率到 152 就走坡或降速。',
          en: 'Start 18:30. Conversational the whole way: heart rate 141–152, pace 6:05–6:30 /km. Pure aerobic volume today — if heart rate reaches 152, ease off.',
        },
        sections: () => [easyBlock(2400, HR.easyA)],
      },
      {
        dayIndex: 1,
        time: '18:30',
        minutes: 45,
        distanceKm: 7.3,
        name: { zh: '轻松跑 + 4 组加速跑', en: 'Easy run + 4 strides' },
        description: {
          zh: '18:30 开跑。先轻松跑 40 分钟（心率 141–155），再做 4 组 20 秒加速跑，每组之间慢跑 60 秒。加速跑是放松地快，不是冲刺：步子轻、频率高、身体不紧绷。心率超过 155 就立刻降速。',
          en: 'Start 18:30. 40 minutes easy first (heart rate 141–155), then 4 x 20 s strides with 60 s easy jog between. A stride is relaxed speed, not a sprint: light feet, quick turnover, shoulders loose. Above 155 bpm, slow down immediately.',
        },
        sections: () => [easyBlock(2400, HR.easyB), strideGroup(4, 20, 60)],
      },
      {
        dayIndex: 3,
        time: '18:30',
        minutes: 58,
        distanceKm: 10.0,
        name: { zh: '阈值课 3 × 8 分钟', en: 'Threshold 3 x 8 min' },
        description: {
          zh: '18:30 开跑。热身 2 公里，然后 3 组 8 分钟阈值跑：配速 4:55–5:05，心率 178–186，组间慢跑 2 分 30 秒，最后放松跑 2 公里。这是本周唯一一节强度课，配速掉了就提前结束，不要硬撑完第 3 组。',
          en: 'Start 18:30. 2 km warm-up, then 3 x 8 min at threshold: pace 4:55–5:05 /km, heart rate 178–186, 2 min 30 s easy jog between, 2 km cool-down. This is the week\'s only hard session — if the pace slips, stop early rather than forcing the third rep.',
        },
        sections: () => [
          { sectionType: SECTION_WARMUP, targetType: TARGET_DISTANCE, targetValue: 2000, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.warmup[0], intensityValueEnd: HR.warmup[1] },
          {
            intervalGroup: true,
            repeats: 3,
            sets: [
              { sectionType: SECTION_TRAINING, targetType: TARGET_TIME, targetValue: 480, intensityType: INTENSITY_PACE, intensityValueStart: PACE.threshold[0], intensityValueEnd: PACE.threshold[1] },
              { sectionType: SECTION_RECOVERY, targetType: TARGET_TIME, targetValue: 150, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.floatThreshold[0], intensityValueEnd: HR.floatThreshold[1] },
            ],
          },
          { sectionType: SECTION_COOLDOWN, targetType: TARGET_DISTANCE, targetValue: 2000, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.cooldown[0], intensityValueEnd: HR.cooldown[1] },
        ],
      },
      {
        dayIndex: 6,
        time: '17:30',
        minutes: 90,
        distanceKm: 14.0,
        name: { zh: '长距离 90 分钟', en: 'Long run 90 min' },
        description: {
          zh: '17:30 开跑。心率压在 160 以内，前 10 公里不超过 155，配速 6:10–6:35。出门前 2 小时吃一顿正餐补碳水。这个时间点多数地区已经天黑，穿反光背心或带头灯，尽量选熟悉、有路灯的路线。',
          en: 'Start 17:30. Keep heart rate under 160, and under 155 for the first 10 km; pace 6:10–6:35 /km. Eat a proper meal about two hours before. It will be dark by then — wear something reflective or a headlamp, and pick a familiar, lit route.',
        },
        sections: () => [easyBlock(5400, HR.longRun)],
      },
    ],
  },
  {
    theme: { zh: '加长阈值', en: 'Longer threshold' },
    sessions: [
      {
        dayIndex: 0,
        time: '18:30',
        minutes: 45,
        distanceKm: 7.2,
        name: { zh: '轻松跑 45 分钟', en: 'Easy run 45 min' },
        description: {
          zh: '18:30 开跑。心率 141–152，配速 6:05–6:30。上周的长距离还没完全消化，今天宁慢勿快。',
          en: 'Start 18:30. Heart rate 141–152, pace 6:05–6:30 /km. Last week\'s long run is not fully absorbed yet, so err on the slow side today.',
        },
        sections: () => [easyBlock(2700, HR.easyA)],
      },
      {
        dayIndex: 1,
        time: '18:30',
        minutes: 50,
        distanceKm: 8.1,
        name: { zh: '轻松跑 + 4 组加速跑', en: 'Easy run + 4 strides' },
        description: {
          zh: '18:30 开跑。轻松跑 45 分钟（心率 141–155），再 4 组 20 秒加速跑，组间慢跑 60 秒。加速跑只是让腿记得快的感觉，不影响明天的课。',
          en: 'Start 18:30. 45 minutes easy (heart rate 141–155), then 4 x 20 s strides with 60 s jog between. The strides only remind the legs what fast feels like; they must not affect tomorrow.',
        },
        sections: () => [easyBlock(2700, HR.easyB), strideGroup(4, 20, 60)],
      },
      {
        dayIndex: 3,
        time: '18:30',
        minutes: 62,
        distanceKm: 10.9,
        name: { zh: '阈值课 2 × 15 分钟', en: 'Threshold 2 x 15 min' },
        description: {
          zh: '18:30 开跑。热身 2 公里，然后 2 组 15 分钟阈值跑：配速 4:55–5:05，心率 178–186，组间慢跑 3 分钟，最后放松跑 2 公里。两组各 15 分钟，比上周的 3 × 8 分钟更考验耐心：前半段一定要忍住，别用 4:45 起步。',
          en: 'Start 18:30. 2 km warm-up, then 2 x 15 min at threshold: pace 4:55–5:05 /km, heart rate 178–186, 3 min easy jog between, 2 km cool-down. Fifteen minutes twice tests patience more than 3 x 8 did — hold back early, do not open at 4:45.',
        },
        sections: () => [
          { sectionType: SECTION_WARMUP, targetType: TARGET_DISTANCE, targetValue: 2000, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.warmup[0], intensityValueEnd: HR.warmup[1] },
          {
            intervalGroup: true,
            repeats: 2,
            sets: [
              { sectionType: SECTION_TRAINING, targetType: TARGET_TIME, targetValue: 900, intensityType: INTENSITY_PACE, intensityValueStart: PACE.threshold[0], intensityValueEnd: PACE.threshold[1] },
              { sectionType: SECTION_RECOVERY, targetType: TARGET_TIME, targetValue: 180, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.floatThreshold[0], intensityValueEnd: HR.floatThreshold[1] },
            ],
          },
          { sectionType: SECTION_COOLDOWN, targetType: TARGET_DISTANCE, targetValue: 2000, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.cooldown[0], intensityValueEnd: HR.cooldown[1] },
        ],
      },
      {
        dayIndex: 6,
        time: '17:30',
        minutes: 95,
        distanceKm: 14.8,
        name: { zh: '长距离 95 分钟', en: 'Long run 95 min' },
        description: {
          zh: '17:30 开跑。心率 ≤160，前 10 公里 ≤155，配速 6:10–6:35。比上周多 5 分钟即可，不要贪多。天黑请在熟悉的路线上跑，带反光装备。',
          en: 'Start 17:30. Heart rate at or under 160, and under 155 for the first 10 km; pace 6:10–6:35 /km. Five minutes more than last week is the whole point — do not add more. It will be dark, so stay on a familiar route with something reflective.',
        },
        sections: () => [easyBlock(5700, HR.longRun)],
      },
    ],
  },
  {
    theme: { zh: '短间歇', en: 'Short repetitions' },
    sessions: [
      {
        dayIndex: 0,
        time: '18:30',
        minutes: 45,
        distanceKm: 7.2,
        name: { zh: '轻松跑 45 分钟', en: 'Easy run 45 min' },
        description: {
          zh: '18:30 开跑。心率 141–152，配速 6:05–6:30。本周四有 1000 米间歇，今天必须跑得干净。',
          en: 'Start 18:30. Heart rate 141–152, pace 6:05–6:30 /km. Thursday brings 1000 m repetitions, so today has to stay genuinely easy.',
        },
        sections: () => [easyBlock(2700, HR.easyA)],
      },
      {
        dayIndex: 1,
        time: '18:30',
        minutes: 50,
        distanceKm: 8.1,
        name: { zh: '轻松跑 + 4 组加速跑', en: 'Easy run + 4 strides' },
        description: {
          zh: '18:30 开跑。轻松跑 45 分钟（心率 141–155），再 4 组 20 秒加速跑。这周的加速跑更重要：让腿在周四之前重新熟悉快频率。',
          en: 'Start 18:30. 45 minutes easy (heart rate 141–155), then 4 x 20 s strides. This week the strides matter more: they re-teach fast turnover before Thursday.',
        },
        sections: () => [easyBlock(2700, HR.easyB), strideGroup(4, 20, 60)],
      },
      {
        dayIndex: 3,
        time: '18:30',
        minutes: 53,
        distanceKm: 9.2,
        name: { zh: '间歇课 4 × 1000 米', en: 'Intervals 4 x 1000 m' },
        description: {
          zh: '18:30 开跑。热身 2 公里，然后 4 组 1000 米：每组配速 4:48–4:55，心率可到 190 上下，组间慢跑 2 分钟，最后放松跑 2 公里。跑不动就减一组，不要把配速掉到 5:05 以外。',
          en: 'Start 18:30. 2 km warm-up, then 4 x 1000 m at 4:48–4:55 /km with heart rate around 190, 2 min easy jog between, 2 km cool-down. If it falls apart, drop a rep rather than letting the pace drift past 5:05.',
        },
        sections: () => [
          { sectionType: SECTION_WARMUP, targetType: TARGET_DISTANCE, targetValue: 2000, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.warmup[0], intensityValueEnd: HR.warmup[1] },
          {
            intervalGroup: true,
            repeats: 4,
            sets: [
              { sectionType: SECTION_TRAINING, targetType: TARGET_DISTANCE, targetValue: 1000, intensityType: INTENSITY_PACE, intensityValueStart: PACE.rep1000[0], intensityValueEnd: PACE.rep1000[1] },
              { sectionType: SECTION_RECOVERY, targetType: TARGET_TIME, targetValue: 120, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.floatThreshold[0], intensityValueEnd: HR.floatThreshold[1] },
            ],
          },
          { sectionType: SECTION_COOLDOWN, targetType: TARGET_DISTANCE, targetValue: 2000, intensityType: INTENSITY_HEART_RATE, intensityValueStart: HR.cooldown[0], intensityValueEnd: HR.cooldown[1] },
        ],
      },
      {
        dayIndex: 6,
        time: '17:30',
        minutes: 100,
        distanceKm: 15.6,
        name: { zh: '长距离 100 分钟', en: 'Long run 100 min' },
        description: {
          zh: '17:30 开跑。心率 ≤160，前 10 公里 ≤155，配速 6:10–6:35。这是本周期最长的一节课，跑完就该减量了，所以不要在这节课上额外加码。',
          en: 'Start 17:30. Heart rate at or under 160, and under 155 for the first 10 km; pace 6:10–6:35 /km. This is the longest run of the cycle and a deload follows, so add nothing extra here.',
        },
        sections: () => [easyBlock(6000, HR.longRun)],
      },
    ],
  },
  {
    theme: { zh: '减量恢复', en: 'Deload' },
    sessions: [
      {
        dayIndex: 0,
        time: '18:30',
        minutes: 35,
        distanceKm: 5.6,
        name: { zh: '轻松跑 35 分钟', en: 'Easy run 35 min' },
        description: {
          zh: '18:30 开跑。心率 141–152，配速 6:10–6:35。减量周的第一天，跑得比平时更慢都没关系——这周的目的是把前三周的疲劳放掉。',
          en: 'Start 18:30. Heart rate 141–152, pace 6:10–6:35 /km. First day of the deload: running slower than usual is fine. The job this week is shedding the fatigue of the previous three.',
        },
        sections: () => [easyBlock(2100, HR.easyA)],
      },
      {
        dayIndex: 1,
        time: '18:30',
        minutes: 40,
        distanceKm: 6.5,
        name: { zh: '轻松跑 + 4 组加速跑', en: 'Easy run + 4 strides' },
        description: {
          zh: '18:30 开跑。轻松跑 35 分钟（心率 141–155），再 4 组 20 秒加速跑。减量周保留加速跑，是为了下周恢复时腿不至于变钝。',
          en: 'Start 18:30. 35 minutes easy (heart rate 141–155), then 4 x 20 s strides. Keep the strides in a deload week so the legs do not go flat when training resumes.',
        },
        sections: () => [easyBlock(2100, HR.easyB), strideGroup(4, 20, 60)],
      },
      {
        dayIndex: 3,
        time: '18:30',
        minutes: 49,
        distanceKm: 8.0,
        name: { zh: '轻松跑 + 6 组加速跑', en: 'Easy run + 6 strides' },
        description: {
          zh: '18:30 开跑。轻松跑 40 分钟（心率 141–152），再 6 组 30 秒加速跑，组间慢跑 60 秒。这周没有阈值课，用加速跑代替强度，不要自己加练。',
          en: 'Start 18:30. 40 minutes easy (heart rate 141–152), then 6 x 30 s strides with 60 s jog between. There is no threshold session this week — the strides take its place, so do not add one yourself.',
        },
        sections: () => [easyBlock(2400, HR.easyA), strideGroup(6, 30, 60)],
      },
      {
        dayIndex: 6,
        time: '17:30',
        minutes: 70,
        distanceKm: 10.5,
        name: { zh: '长距离 70 分钟', en: 'Long run 70 min' },
        description: {
          zh: '17:30 开跑。心率 ≤155，配速 6:15–6:40，比上周短 30 分钟。下周从头开始，所以这周最后一天只求舒服，不求距离。',
          en: 'Start 17:30. Heart rate at or under 155, pace 6:15–6:40 /km, about 30 minutes shorter than last week. The cycle restarts next week, so the last day of this one only has to feel comfortable.',
        },
        sections: () => [easyBlock(4200, HR.longRun)],
      },
    ],
  },
]

const PLAN_TEXT = {
  name: { zh: '4 周日常健康跑计划', en: '4-week everyday running plan' },
  overview: {
    zh: '为「日常健康跑、保持半马水平」设计的四周循环，跑完从第一周重新开始。每周四节课：周一轻松跑、周二轻松跑加加速跑、周四一节强度课、周日长距离；周三、周五、周六休息。强度以心率为准，阈值课用配速控制。四周依次是建立节奏、加长阈值、短间歇、减量恢复，整体不追成绩，只维持有氧和阈值能力。',
    en: 'A four-week cycle for everyday health running that holds half-marathon fitness, restarting at week one when it ends. Four sessions a week: easy on Monday, easy plus strides on Tuesday, one quality session on Thursday, a long run on Sunday; Wednesday, Friday and Saturday are rest. Aerobic work is prescribed by heart rate, the threshold work by pace. The weeks run establish, longer threshold, short repetitions, deload — nothing here chases a personal best; it maintains aerobic and threshold fitness.',
  },
  rationale: {
    zh: '上个月那场半马是全力跑的，所以第一个月只安排一节强度课，先把每周四次、约 38 公里的节奏站稳。第四周减量，是为了让前三周的负荷真正变成能力。',
    en: 'Last month\'s half marathon was raced all out, so the first block carries a single quality session and focuses on making four runs a week at about 38 km the normal rhythm. Week four deloads so the previous three weeks actually turn into fitness.',
  },
  themeLabel: { zh: '第 {n} 周', en: 'Week {n}' },
}

const WEEKDAY = {
  zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

/* ---------------------------------------------------------------- date math */

/** Parse `YYYY-MM-DD` into a UTC-midnight Date, so no local offset can drift it. */
function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  // `Date.UTC` rolls 2026-13-45 over into 2027-02-14 instead of rejecting it, so
  // a typo would silently become a week the athlete never asked for. Compare the
  // round trip to catch that.
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return undefined
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return undefined
  }
  return date
}

export function toIso(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** The `yyyyMMdd` form the COROS API takes. */
export function toCompact(date) {
  return toIso(date).replace(/-/g, '')
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

/**
 * The Monday of the next week — the default start of a plan created today.
 *
 * A plan written on Saturday should start on the coming Monday, not tomorrow;
 * "next week" is the week the athlete is about to plan, so the target is always
 * the Monday after the current week began.
 */
export function nextMonday(from = new Date()) {
  const today = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()))
  const weekday = today.getUTCDay() // 0 = Sunday
  const daysToNextMonday = ((8 - weekday) % 7) || 7
  return addDays(today, daysToNextMonday)
}

/**
 * The Monday on or before `date`.
 *
 * Courses are defined as offsets from the plan's start, and COROS requires the
 * plan to be read as natural Monday–Sunday weeks. Snapping keeps that true even
 * when someone passes a mid-week date.
 */
export function mondayOf(date) {
  const dow = date.getUTCDay() // 0 = Sunday
  return addDays(date, -((dow + 6) % 7))
}

/** Accept `YYYY-MM-DD`, `yyyyMMdd` or a Date; return the UTC Date or undefined. */
export function normalizeStartDate(value, fallback = new Date()) {
  // A Date is accepted because buildTrainingPlan re-normalises whatever it is
  // handed, and callers that already parsed one should not have to stringify it
  // back just to get through that second pass.
  if (value instanceof Date) return mondayOf(value)
  const text = String(value ?? '').trim()
  if (!text) return nextMonday(fallback)
  const dashed = parseIsoDate(text)
  if (dashed) return mondayOf(dashed)
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  if (compact) return mondayOf(parseIsoDate(`${compact[1]}-${compact[2]}-${compact[3]}`))
  return undefined
}

/* ------------------------------------------------------------- plan builder */

function pick(record, lang) {
  return record[lang] ?? record.zh
}

/**
 * Build the four-week plan: display rows for the panel plus the exact
 * `createTrainingPlan` payload.
 *
 * Display strings are pre-formatted here so the panel never has to know what a
 * heart-rate band or a pace unit means — it renders text and calls it a day.
 */
export function buildTrainingPlan({ startDate, lang = 'zh' } = {}) {
  const start = normalizeStartDate(startDate)
  if (!start) throw new Error('startDate must be YYYY-MM-DD or yyyyMMdd')
  const language = lang === 'en' ? 'en' : 'zh'
  const totalWeeks = WEEKS.length
  const end = addDays(start, totalWeeks * 7 - 1)

  const courseList = []
  const weeks = WEEKS.map((week, weekIndex) => {
    const weekStart = addDays(start, weekIndex * 7)
    const sessions = week.sessions.map((session) => {
      const date = addDays(weekStart, session.dayIndex)
      const dayNo = weekIndex * 7 + session.dayIndex
      const courseName = pick(session.name, language)
      const courseDescription = pick(session.description, language)
      const sections = session.sections()
      courseList.push({
        dayNo,
        sportType: SPORT_RUNNING,
        courseName,
        courseDescription,
        sections,
      })
      return {
        dayNo,
        date: toCompact(date),
        dateLabel: toIso(date).slice(5),
        weekday: WEEKDAY[language][date.getUTCDay()],
        time: session.time,
        name: courseName,
        detail: describeSession(session, language),
        minutes: session.minutes,
        distanceKm: session.distanceKm,
        course: { sportType: SPORT_RUNNING, courseName, courseDescription, sections },
      }
    })
    return {
      index: weekIndex + 1,
      label: pick(PLAN_TEXT.themeLabel, language).replace('{n}', String(weekIndex + 1)),
      theme: pick(week.theme, language),
      weekStart: toIso(weekStart),
      weekEnd: toIso(addDays(weekStart, 6)),
      distanceKm: Math.round(sessions.reduce((sum, s) => sum + s.distanceKm, 0) * 10) / 10,
      sessions,
    }
  })

  return {
    planName: pick(PLAN_TEXT.name, language),
    planOverview: pick(PLAN_TEXT.overview, language),
    planRationale: pick(PLAN_TEXT.rationale, language),
    planStartDate: Number(toCompact(start)),
    startDate: toIso(start),
    endDate: toIso(end),
    totalWeeks,
    lang: language,
    sessionCount: courseList.length,
    totalDistanceKm: Math.round(weeks.reduce((sum, w) => sum + w.distanceKm, 0) * 10) / 10,
    weeks,
    periodization: buildPeriodization(start, language),
    courseList,
  }
}

/**
 * Human-readable session length.
 *
 * `minutes` is declared on each session rather than summed from the sections:
 * a distance-targeted section (the warm-up, the 1000 m reps) has no time value
 * to add up, so a sum would silently under-report the very sessions where the
 * length matters most.
 */
function describeSession(session, language) {
  return language === 'en' ? `about ${session.minutes} min` : `约 ${session.minutes} 分钟`
}

/**
 * Base → build → deload, anchored at the plan start.
 *
 * COROS wants contiguous phases that begin on the start date and end on a Sunday,
 * with the durations summing to the plan length.
 */
function buildPeriodization(start, language) {
  const spans = [
    { phaseType: 2, weeks: 2, label: { zh: '基础', en: 'Base' } },
    { phaseType: 3, weeks: 1, label: { zh: '强化', en: 'Build' } },
    { phaseType: 6, weeks: 1, label: { zh: '恢复', en: 'Deload' } },
  ]
  const phases = []
  let cursor = start
  for (const span of spans) {
    const end = addDays(cursor, span.weeks * 7 - 1)
    phases.push({
      phaseType: span.phaseType,
      startDate: Number(toCompact(cursor)),
      endDate: Number(toCompact(end)),
      durationWeeks: span.weeks,
      label: pick(span.label, language),
    })
    cursor = addDays(cursor, span.weeks * 7)
  }
  return phases
}

/** The exact `createTrainingPlan` input, with display-only fields stripped. */
export function toCreatePlanPayload(plan) {
  return {
    planInfo: {
      planName: plan.planName,
      planOverview: plan.planOverview,
      planStartDate: plan.planStartDate,
      totalWeeks: plan.totalWeeks,
    },
    phaseInfo: {
      planRationale: plan.planRationale,
      periodization: plan.periodization.map((phase) => ({
        phaseType: phase.phaseType,
        startDate: phase.startDate,
        endDate: phase.endDate,
        durationWeeks: phase.durationWeeks,
      })),
    },
    courseList: plan.courseList.map((course) => ({
      dayNo: course.dayNo,
      sportType: course.sportType,
      courseName: course.courseName,
      courseDescription: course.courseDescription,
      sections: JSON.parse(JSON.stringify(course.sections)),
    })),
  }
}

/** The plan as the panel renders it — no course payloads, no internal ids. */
export function summarizePlan(plan) {
  return {
    planName: plan.planName,
    planOverview: plan.planOverview,
    startDate: plan.startDate,
    endDate: plan.endDate,
    totalWeeks: plan.totalWeeks,
    sessionCount: plan.sessionCount,
    totalDistanceKm: plan.totalDistanceKm,
    weeks: plan.weeks.map((week) => ({
      index: week.index,
      label: week.label,
      theme: week.theme,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      distanceKm: week.distanceKm,
      sessions: week.sessions.map((session) => ({
        date: session.date,
        dateLabel: session.dateLabel,
        weekday: session.weekday,
        time: session.time,
        name: session.name,
        detail: session.detail,
        distanceKm: session.distanceKm,
      })),
    })),
  }
}

/* --------------------------------------------------------------- validation */

const INTENSITY_FORMATS = ['sectionIntensity', 'intensityPercent', 'intensityValue']

function intensityFormats(section) {
  const present = []
  if (Number.isInteger(section.sectionIntensity)) present.push('sectionIntensity')
  if (Number.isInteger(section.intensityPercentStart) || Number.isInteger(section.intensityPercentEnd)) present.push('intensityPercent')
  if (Number.isInteger(section.intensityValueStart) || Number.isInteger(section.intensityValueEnd)) present.push('intensityValue')
  return present
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0
}

function validatePlainSection(section, path, issues) {
  if (![SECTION_WARMUP, SECTION_TRAINING, SECTION_RECOVERY, SECTION_COOLDOWN].includes(section.sectionType)) {
    issues.push(`${path}.sectionType must be 1-4`)
  }
  if (![TARGET_DISTANCE, TARGET_TIME].includes(section.targetType)) {
    issues.push(`${path}.targetType must be 1 (distance) or 2 (time) for running`)
  } else if (!isPositiveInt(section.targetValue)) {
    issues.push(`${path}.targetValue must be a positive integer`)
  }

  if (section.intensityType === undefined) {
    // Only legal when the athlete explicitly asked for no intensity target; the
    // plan never does, so an absent intensityType here is a bug worth failing.
    issues.push(`${path}.intensityType is required`)
    return
  }
  if (![INTENSITY_HEART_RATE, INTENSITY_PACE].includes(section.intensityType)) {
    issues.push(`${path}.intensityType must be 1 (heart rate) or 2 (pace) for running`)
  }

  const formats = intensityFormats(section)
  if (formats.length !== 1 || formats[0] !== 'intensityValue') {
    issues.push(`${path} must declare exactly one absolute intensity range (found: ${formats.join(', ') || 'none'})`)
    return
  }

  const start = section.intensityValueStart
  const end = section.intensityValueEnd
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    issues.push(`${path} needs both intensityValueStart and intensityValueEnd`)
    return
  }
  if (section.intensityType === INTENSITY_HEART_RATE) {
    for (const [name, value] of [['start', start], ['end', end]]) {
      if (value < 30 || value > 240) issues.push(`${path}.intensityValue${name} (${value}) must be within 30-240 bpm`)
    }
  } else {
    for (const [name, value] of [['start', start], ['end', end]]) {
      if (value < 120 || value > 1499) issues.push(`${path}.intensityValue${name} (${value}) must be within 120-1499 s/km`)
    }
  }
}

function validateSection(section, path, issues) {
  if (!section || typeof section !== 'object') {
    issues.push(`${path} must be an object`)
    return
  }
  if (section.intervalGroup === true) {
    // A container carries repeats and nothing else: no target, no intensity.
    for (const key of ['targetType', 'targetValue', 'intensityType', 'sectionIntensity', 'intensityPercentStart', 'intensityPercentEnd', 'intensityValueStart', 'intensityValueEnd']) {
      if (section[key] !== undefined) issues.push(`${path} is an interval group and must not set ${key}`)
    }
    if (!Number.isInteger(section.repeats) || section.repeats < 1 || section.repeats > 20) {
      issues.push(`${path}.repeats must be an integer within 1-20`)
    }
    if (!Array.isArray(section.sets) || section.sets.length === 0) {
      issues.push(`${path}.sets must be a non-empty array`)
      return
    }
    section.sets.forEach((member, index) => {
      const memberPath = `${path}.sets[${index}]`
      if (member?.intervalGroup === true) issues.push(`${memberPath} must not be an interval group (no nesting)`)
      if (![SECTION_TRAINING, SECTION_RECOVERY].includes(member?.sectionType)) {
        issues.push(`${memberPath}.sectionType must be 2 or 3 inside a set`)
      }
      validatePlainSection(member, memberPath, issues)
    })
    return
  }
  validatePlainSection(section, path, issues)
}

/**
 * Check one course against every rule the MCP schema states.
 *
 * `dayNo` is required here — unlike a scheduled workout, a plan course is placed
 * by its offset from the plan start, not by a date.
 */
export function validateCourse(course, { requireDayNo = true } = {}) {
  const issues = []
  if (!course || typeof course !== 'object') return ['course must be an object']

  const name = String(course.courseName ?? '').trim()
  const description = String(course.courseDescription ?? '').trim()
  if (!name) issues.push('courseName is required')
  if (!description) issues.push('courseDescription is required')
  if (name.length > 100) issues.push('courseName must be at most 100 characters')
  if (course.sportType !== SPORT_RUNNING) issues.push(`sportType must be ${SPORT_RUNNING} (running)`)
  if (course.strengthBodypart !== undefined && course.strengthBodypart !== null) {
    issues.push('strengthBodypart must stay null')
  }
  if (requireDayNo) {
    if (!Number.isInteger(course.dayNo) || course.dayNo < 0) issues.push('dayNo must be a non-negative integer')
  } else if (course.dayNo !== undefined) {
    issues.push('dayNo must not be set for a scheduled workout')
  }

  // The schema is `additionalProperties: false`, so an unknown key is a rejection.
  const allowed = new Set(['sportType', 'courseName', 'courseDescription', 'sections', 'dayNo', 'strengthBodypart'])
  for (const key of Object.keys(course)) {
    if (!allowed.has(key)) issues.push(`unexpected field ${key}`)
  }

  if (!Array.isArray(course.sections) || course.sections.length === 0) {
    issues.push('sections must be a non-empty array')
    return issues
  }
  course.sections.forEach((section, index) => validateSection(section, `sections[${index}]`, issues))
  return issues
}

/**
 * Validate a built plan against the `createTrainingPlan` contract.
 *
 * Returns a list of human-readable problems; empty means the payload is safe to
 * send. This is defence in depth, not the only gate: the server still validates,
 * but a rejection there costs a request and reads as prose. A plan is also
 * permanent — there is no delete tool — so a malformed one is not recoverable
 * from the panel.
 */
export function validateTrainingPlan(plan, today = new Date()) {
  const issues = []

  const name = String(plan.planName ?? '').trim()
  const overview = String(plan.planOverview ?? '').trim()
  if (!name) issues.push('planName is required')
  if (!overview) issues.push('planOverview is required')
  if (name.length > 60) issues.push(`planName is ${name.length} characters, max 60`)
  if (overview.length > 266) issues.push(`planOverview is ${overview.length} characters, max 266`)
  if (!Number.isInteger(plan.totalWeeks) || plan.totalWeeks < 4 || plan.totalWeeks > 16) {
    issues.push('totalWeeks must be an integer within 4-16')
  }

  issues.push(...assertStartWindow(plan, today))

  // Periodization: contiguous, anchored at the start date, ending on Sundays,
  // durations summing to the plan length. COROS rejects anything else.
  const start = parseIsoDate(plan.startDate)
  let cursor = start
  let weeks = 0
  for (const [index, phase] of (plan.periodization ?? []).entries()) {
    if (phase.startDate !== Number(toCompact(cursor))) {
      issues.push(`periodization[${index}].startDate must be ${toCompact(cursor)}`)
    }
    const expectedEnd = addDays(cursor, phase.durationWeeks * 7 - 1)
    if (phase.endDate !== Number(toCompact(expectedEnd))) {
      issues.push(`periodization[${index}].endDate must be ${toCompact(expectedEnd)} (a Sunday)`)
    }
    if (expectedEnd.getUTCDay() !== 0) {
      issues.push(`periodization[${index}] would not end on a Sunday`)
    }
    cursor = addDays(cursor, phase.durationWeeks * 7)
    weeks += phase.durationWeeks
  }
  if ((plan.periodization ?? []).length === 0) issues.push('periodization must not be empty')
  else if (weeks !== plan.totalWeeks) issues.push(`periodization spans ${weeks} weeks, expected ${plan.totalWeeks}`)

  // Courses.
  const maxDayNo = plan.totalWeeks * 7 - 1
  const lastWeekStart = maxDayNo - 6
  let hasFinalWeek = false
  for (const [index, course] of (plan.courseList ?? []).entries()) {
    for (const issue of validateCourse(course)) issues.push(`courseList[${index}]: ${issue}`)
    if (Number.isInteger(course.dayNo)) {
      if (course.dayNo < 0 || course.dayNo > maxDayNo) issues.push(`courseList[${index}].dayNo (${course.dayNo}) must be within 0-${maxDayNo}`)
      if (course.dayNo >= lastWeekStart) hasFinalWeek = true
    }
  }
  if ((plan.courseList ?? []).length === 0) issues.push('courseList must not be empty')
  // COROS derives the displayed plan length from the last real workout, so a
  // plan whose final week is empty would be stored shorter than it claims.
  if (!hasFinalWeek) issues.push('the final week must contain at least one workout')

  return issues
}

/** The API window: a plan may start at most 14 days out. */
export function assertStartWindow(plan, today = new Date()) {
  const start = parseIsoDate(plan.startDate)
  if (!start) return [`startDate ${plan.startDate} is not a date`]
  const midnight = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const horizon = addDays(midnight, 14)
  const problems = []
  if (start.getTime() < midnight.getTime()) {
    problems.push(`${plan.startDate} is in the past; a plan can only start today or later`)
  }
  if (start.getTime() > horizon.getTime()) {
    problems.push(`${plan.startDate} is more than 14 days out; move the start closer`)
  }
  return problems
}
