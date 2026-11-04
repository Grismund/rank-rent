#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs'
import { parseCandidatesCsv } from '../lib/candidates.js'

const csv = readFileSync('data/candidates.csv', 'utf8')
const all = parseCandidatesCsv(csv)
const byStatus = {}
for (const c of all) { byStatus[c.status] = (byStatus[c.status] || 0) + 1 }
console.log('Final candidate status counts:')
for (const [s, n] of Object.entries(byStatus).sort()) console.log(`  ${s}: ${n}`)

const validated = all.filter(c => c.validated_date)
let emptyOrg = 0, emptyMaps = 0, weeklyTrends = 0
for (const c of validated) {
  const rawPath = `research/${c.slug}/validation-data.json`
  if (!existsSync(rawPath)) continue
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
  if (raw.organic && raw.organic.every(o => !o.topDomains || o.topDomains.length === 0)) emptyOrg++
  if (!raw.maps || raw.maps.totalCount === 0) emptyMaps++
  if (raw.trends && raw.trends.length > 12) weeklyTrends++
}
console.log('\nData quality:')
console.log(`  Empty organic: ${emptyOrg} (1 is interior-painting-big-spring, genuinely empty SERP)`)
console.log(`  Empty maps: ${emptyMaps}`)
console.log(`  Weekly trends (>12): ${weeklyTrends}`)
