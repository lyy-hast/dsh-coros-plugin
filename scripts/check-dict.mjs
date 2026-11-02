import { readFileSync } from 'node:fs'

// Every t('key') call must exist in both dictionaries, and every plan* key in
// the dictionaries must actually be used — a dead key is copy that silently
// rots, which is exactly how the old "no start-time field" line survived a
// product change.

const src = readFileSync('lib/client.js', 'utf8')

const used = new Set()
for (const match of src.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)) used.add(match[1])

function dictKeys(anchor) {
  const start = src.indexOf(anchor)
  if (start < 0) throw new Error('anchor missing: ' + anchor)
  const end = src.indexOf('\n      }', start)
  const block = src.slice(start, end)
  return new Set([...block.matchAll(/^\s{8}([A-Za-z0-9_]+):/gm)].map((m) => m[1]))
}

const zh = dictKeys('var DICT = {')
// DICT.zh starts right after; find the en table separately.
const enStart = src.indexOf('en: {', src.indexOf("zh: {"))
const enEnd = src.indexOf('\n      }', enStart)
const en = new Set([...src.slice(enStart, enEnd).matchAll(/^\s{8}([A-Za-z0-9_]+):/gm)].map((m) => m[1]))

let failed = 0

const missingZh = [...used].filter((k) => !zh.has(k))
const missingEn = [...used].filter((k) => !en.has(k))
if (missingZh.length) { console.log('MISSING in zh:', missingZh); failed += 1 }
if (missingEn.length) { console.log('MISSING in en:', missingEn); failed += 1 }

const onlyZh = [...zh].filter((k) => !en.has(k) && k !== 'zh')
const onlyEn = [...en].filter((k) => !zh.has(k) && k !== 'en')
if (onlyZh.length) { console.log('only in zh:', onlyZh); failed += 1 }
if (onlyEn.length) { console.log('only in en:', onlyEn); failed += 1 }

// Plan-specific keys: used and defined in both.
const planKeys = [...zh, ...en].filter((k) => k.startsWith('plan'))
const unusedPlan = planKeys.filter((k) => !used.has(k))
if (unusedPlan.length) { console.log('unused plan keys:', [...new Set(unusedPlan)]); failed += 1 }

console.log('zh keys:', zh.size, '| en keys:', en.size, '| used by t():', used.size)
if (failed) { console.log('FAIL'); process.exit(1) }
console.log('ok — dictionaries consistent')
