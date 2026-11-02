/**
 * Read-only probe: what does queryTrainingPlanLibrary return for this account?
 *
 *   node scripts/probe-plan-library.mjs
 *
 * Development only. Never writes to the account.
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { callTool, mcpUrlFor, parseTrainingPlanLibrary, resolveIssuer } from '../lib/coros-api.js'

const token = JSON.parse(await readFile(join(homedir(), '.dsh-coros-sport', 'token.json'), 'utf8'))
const mcpUrl = mcpUrlFor(resolveIssuer(token.region ?? 'cn', token.issuer))

const result = await callTool(mcpUrl, token.access_token, 'queryTrainingPlanLibrary', { statusList: [0, 1, 2] })
console.log('--- isError:', result.isError)
console.log('--- raw ---')
console.log(result.text)
const parsed = parseTrainingPlanLibrary(result.text, { allStatuses: true })
console.log('--- parsed ---')
console.log(JSON.stringify({ empty: parsed.empty, conclusive: parsed.conclusive, total: parsed.total, inProgress: parsed.inProgress }, null, 2))
console.log('--- plans ---')
console.log(JSON.stringify(parsed.plans, null, 2))
