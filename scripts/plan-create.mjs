/**
 * Preview or create the four-week training plan, straight from the command line.
 *
 *   node scripts/plan-create.mjs                    # 只读：列出整份计划与冲突
 *   node scripts/plan-create.mjs --start 2026-11-16
 *   node scripts/plan-create.mjs --yes              # 真写
 *
 * Same code path as the panel (`lib/plan-writer.js`), so what is printed here is
 * the outcome of the real writer, not a second implementation. It exists because
 * the panel's routes only load after the host restarts, and because a CLI is
 * easier to inspect when a write is rejected.
 *
 * Nothing here deletes: the MCP surface has no tool for it.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { callTool, mcpUrlFor, resolveIssuer } from '../lib/coros-api.js'
import { buildTrainingPlan, normalizeStartDate } from '../lib/plan-workouts.js'
import { previewTrainingPlan, writeTrainingPlan } from '../lib/plan-writer.js'

const argv = process.argv.slice(2)
const confirmed = argv.includes('--yes')
const startFlag = argv.indexOf('--start')
const startValue = startFlag === -1 ? '' : argv[startFlag + 1]
if (startFlag !== -1 && (startValue === undefined || startValue.startsWith('--'))) {
  console.error('--start 需要一个日期：YYYY-MM-DD 或 yyyyMMdd')
  process.exit(2)
}

const tokenPath = join(homedir(), '.dsh-coros-sport', 'token.json')
const saved = JSON.parse(readFileSync(tokenPath, 'utf8'))
// A stored token may carry a bare region name or a full issuer URL; only the
// URL is a valid MCP endpoint, so resolve it the same way the host does.
const url = mcpUrlFor(resolveIssuer(saved.region ?? 'cn', saved.issuer))
const runTool = (name, args) => callTool(url, saved.access_token, name, args ?? {})

// normalizeStartDate signals a malformed date by returning undefined, not by
// throwing — an empty argument legitimately means "next Monday", but a date
// that is present and unparseable must not silently fall back to a week the
// athlete did not ask for.
const startDate = normalizeStartDate(startValue, new Date())
if (!startDate) {
  console.error('无效的 --start：', startValue, '（需要 YYYY-MM-DD 或 yyyyMMdd）')
  process.exit(2)
}

const plan = buildTrainingPlan({ startDate, lang: 'zh' })
console.log(`计划 ${plan.planName}`)
console.log(`${plan.startDate} → ${plan.endDate} · ${plan.totalWeeks} 周 ${plan.sessionCount} 节 · 约 ${plan.totalDistanceKm} km\n`)
for (const week of plan.weeks) {
  console.log(`${week.label}  ${week.theme}  ${week.distanceKm} km`)
  for (const row of week.sessions) {
    console.log(`  ${row.dateLabel} ${row.weekday} ${row.time}  ${row.name}  ${row.detail} · ${row.distanceKm} km`)
  }
}
console.log('')

const preview = await previewTrainingPlan({ runTool, plan, today: new Date() })
if (!preview.ok) {
  console.error('计划无法创建：')
  for (const problem of preview.problems) console.error('  - ' + problem)
  process.exit(1)
}

const conflicts = preview.library?.conflicts ?? []
if (conflicts.length > 0) {
  console.warn('已有计划覆盖同一段时间（高驰不会合并，同一天会出现两节课）：')
  for (const entry of conflicts) console.warn(`  - ${entry.title} ${entry.startDate} → ${entry.endDate}`)
} else if (preview.library && preview.library.conclusive === false) {
  console.warn('（计划库读取不完整，可能还有未列出的重叠计划）')
}

if (!confirmed) {
  console.log('\n只读预览。写入请加 --yes（高驰接口无法删除计划，建完只能逐节改）。')
  process.exit(0)
}

console.log('\n创建中…')
const report = await writeTrainingPlan({ runTool, plan, confirm: true, today: new Date() })
if (!report.created) {
  console.error(`高驰没有接受这份计划：${report.reason ?? ''}`)
  process.exit(1)
}
console.log(`已创建「${report.planName}」，${report.totalWeeks} 周 ${report.sessionCount} 节（${report.startDate} → ${report.endDate}）。`)
