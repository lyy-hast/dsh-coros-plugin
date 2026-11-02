/**
 * Read-only probe: what does the weekly schedule look like for a date range?
 *
 *   node scripts/probe-schedule.mjs 20261102 20261108
 *
 * Development only. Never writes to the account.
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { callTool, mcpUrlFor, parseTrainingSchedule, resolveIssuer } from '../lib/coros-api.js'

const tokenPath = join(homedir(), '.dsh-coros-sport', 'token.json')
const token = JSON.parse(await readFile(tokenPath, 'utf8'))
const mcpUrl = mcpUrlFor(resolveIssuer(token.region ?? 'cn', token.issuer))

const startDate = process.argv[2]
const endDate = process.argv[3]
const args = startDate ? { startDate, ...(endDate ? { endDate } : {}) } : {}

const result = await callTool(mcpUrl, token.access_token, 'queryTrainingSchedule', args)
console.log('--- isError:', result.isError)
console.log('--- raw text ---')
console.log(result.text)

// The parser is the thing that was wrong, so print what the panel would get.
const parsed = parseTrainingSchedule(result.text)
console.log('--- parsed:', parsed.empty ? 'empty' : parsed.entries.length + ' entries', '---')
for (const entry of parsed.entries) {
  console.log(' ', entry.date, '|', entry.title, '|', entry.Distance ?? '', '|', entry['Estimated Time'] ?? '')
}
