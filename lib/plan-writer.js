/**
 * Writing the plan to COROS.
 *
 * Unlike a scheduled workout, a plan is one object created by a single
 * `createTrainingPlan` call: there is no per-day write to make idempotent, and
 * the whole thing lands or nothing does. What makes this module careful is that
 * the call is effectively permanent — the MCP surface has no delete tool and no
 * "replace this plan" — so every guard lives before the request:
 *
 *   - `confirm` must be true. The caller is a route that has already shown the
 *     athlete this exact plan, and this guard is what keeps a stray request from
 *     storing a plan they never saw.
 *   - Validation runs over the whole payload first, so a malformed section
 *     aborts before anything is written instead of leaving a half-built plan.
 *   - An existing overlapping plan is reported rather than silently stacked.
 *     COROS allows overlapping plans and does not merge them, so two plans
 *     covering the same days means two sessions on those days.
 *
 * The module takes `runTool` as a parameter rather than importing the MCP
 * client: that keeps it exercisable with a stub, and this file never touches the
 * network itself.
 */

import { toCreatePlanPayload, validateTrainingPlan } from './plan-workouts.js'
import { parseTrainingPlanLibrary } from './coros-api.js'

const CREATE_TOOL = 'createTrainingPlan'
const LIBRARY_TOOL = 'queryTrainingPlanLibrary'

/** Do two plan date ranges share any day? Dates arrive as `YYYY-MM-DD` text. */
function overlaps(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false
  return aStart <= bEnd && bStart <= aEnd
}

/** Normalise the library's date text to `YYYY-MM-DD` so string comparison is sound. */
function normalizeDate(value) {
  const text = String(value ?? '').trim()
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`
  return text || undefined
}

/**
 * Look for plans already covering the target window.
 *
 * This is informational, not a blocker: COROS explicitly allows an overlapping
 * plan and does not merge. The panel shows the conflict so the athlete decides,
 * because guessing which plan they meant would be worse than asking.
 */
export async function inspectLibrary({ runTool, plan }) {
  const result = await runTool(LIBRARY_TOOL, { statusList: [0, 1, 2] })
  const library = parseTrainingPlanLibrary(result?.text ?? '', { allStatuses: true })
  const conflicts = library.plans.filter((entry) => {
    const status = String(entry.status ?? '').toLowerCase()
    if (status.includes('completed')) return false
    return overlaps(plan.startDate, plan.endDate, normalizeDate(entry.startDate), normalizeDate(entry.endDate))
  })
  return {
    conclusive: library.conclusive,
    total: library.total,
    conflicts: conflicts.map((entry) => ({
      title: entry.title,
      status: entry.status,
      startDate: normalizeDate(entry.startDate),
      endDate: normalizeDate(entry.endDate),
    })),
  }
}

/**
 * Describe what a write *would* do, without writing.
 *
 * The panel calls this first so the confirmation the athlete reads is the real
 * outcome of the same code path — same validation, same library check — rather
 * than a second implementation that can disagree with the writer.
 */
export async function previewTrainingPlan({ runTool, plan, today = new Date() }) {
  const problems = validateTrainingPlan(plan, today)
  if (problems.length > 0) {
    return { ok: false, problems, library: null, writable: false }
  }
  let library
  try {
    library = await inspectLibrary({ runTool, plan })
  } catch (err) {
    // A failed library read must not block the write; it only removes the
    // overlap warning, which is advisory.
    library = { conclusive: false, total: 0, conflicts: [], error: String(err?.message ?? err) }
  }
  return { ok: true, problems, library, writable: true }
}

/**
 * Create the plan.
 *
 * `confirm` must be true. Returns a report rather than throwing on a server
 * rejection so the panel can show the server's own words — those carry the
 * specific schema complaint, which is more useful than a generic failure.
 */
export async function writeTrainingPlan({ runTool, plan, confirm, today = new Date() }) {
  if (confirm !== true) {
    throw Object.assign(new Error('write not confirmed'), { code: 'unconfirmed' })
  }

  const problems = validateTrainingPlan(plan, today)
  if (problems.length > 0) {
    throw Object.assign(new Error('plan failed validation'), { code: 'invalid-plan', problems })
  }

  // Report overlaps before writing, but do not refuse: COROS allows them and the
  // athlete was shown the conflict in the confirmation step.
  let library = null
  try {
    library = await inspectLibrary({ runTool, plan })
  } catch {
    library = null
  }

  const payload = toCreatePlanPayload(plan)
  const response = await runTool(CREATE_TOOL, payload)
  const text = String(response?.text ?? '').trim()

  if (response?.isError) {
    return {
      created: false,
      reason: text || 'the server rejected the plan',
      planName: plan.planName,
      startDate: plan.startDate,
      endDate: plan.endDate,
      library,
    }
  }

  return {
    created: true,
    planName: plan.planName,
    startDate: plan.startDate,
    endDate: plan.endDate,
    totalWeeks: plan.totalWeeks,
    sessionCount: plan.courseList.length,
    library,
    raw: text,
  }
}
