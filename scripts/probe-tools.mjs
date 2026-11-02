/**
 * Read-only MCP introspection helper (development only, never shipped).
 *
 *   node scripts/probe-tools.mjs            # tools/list
 *   node scripts/probe-tools.mjs <toolName> # tools/list filtered, full schema
 *
 * It reuses the token this plugin already stored, so run it only on a machine
 * where the panel is signed in. It never prints the token and never calls a
 * mutating tool.
 */
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { mcpRequest, mcpUrlFor, resolveIssuer } from '../lib/coros-api.js'

const tokenPath = join(homedir(), '.dsh-coros-sport', 'token.json')
const token = JSON.parse(await readFile(tokenPath, 'utf8'))
const issuer = resolveIssuer(token.region ?? 'cn', token.issuer)
const mcpUrl = mcpUrlFor(issuer)

const result = await mcpRequest(mcpUrl, token.access_token, 'tools/list', {})

const tools = Array.isArray(result?.tools) ? result.tools : []
const filter = process.argv[2]

if (!filter) {
  console.log(`issuer: ${issuer}`)
  console.log(`tools: ${tools.length}`)
  for (const tool of tools) {
    const summary = String(tool.description ?? '').replace(/\s+/g, ' ').slice(0, 110)
    console.log(`- ${tool.name}: ${summary}`)
  }
} else {
  const matches = tools.filter((t) => t.name === filter || t.name.includes(filter))
  if (matches.length === 0) {
    console.log(`no tool matched "${filter}"`)
    process.exit(1)
  }
  console.log(JSON.stringify(matches, null, 2))
}
