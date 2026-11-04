#!/usr/bin/env node
// scripts/shortlist.mjs
// Produces the Gate 1 shortlist memo from torn_down candidates
// Zero API calls — reads existing data only

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import { estimateRent } from '../lib/scoring.js'

const csv = readFileSync('data/candidates.csv', 'utf8')
const allCandidates = parseCandidatesCsv(csv)
const tornDown = allCandidates.filter((c) => c.status === 'torn_down')

// Read verdicts and exclude SKIP
const candidates = []
for (const c of tornDown) {
  const tdPath = `research/${c.slug}/teardown.md`
  if (!existsSync(tdPath)) continue
  const td = readFileSync(tdPath, 'utf8')
  const verdictMatch = td.match(/## Verdict: (\w+)/)
  const verdict = verdictMatch ? verdictMatch[1] : 'unknown'
  if (verdict === 'SKIP') continue

  // Extract key weakness from teardown
  const weaknessMatch = td.match(/## Weaknesses Found\n\n([\s\S]*?)(?=\n## )/)
  const weaknesses = weaknessMatch ? weaknessMatch[1].trim() : 'See teardown'

  candidates.push({ ...c, verdict, weaknesses })
}

console.log(`${candidates.length} candidates for shortlist (${tornDown.length} torn down, excluding SKIP)`)
if (candidates.length === 0) { console.log('Nothing to shortlist.'); process.exit(0) }

// Sort: score desc, rent desc, BEATABLE > TOUGH
candidates.sort((a, b) => {
  const scoreDiff = Number(b.score_total) - Number(a.score_total)
  if (scoreDiff !== 0) return scoreDiff
  const rentDiff = Number(b.rent_estimate) - Number(a.rent_estimate)
  if (rentDiff !== 0) return rentDiff
  if (a.verdict === 'BEATABLE' && b.verdict !== 'BEATABLE') return -1
  if (b.verdict === 'BEATABLE' && a.verdict !== 'BEATABLE') return 1
  return 0
})

// Generate domain proposals
function proposeDomains(niche, area) {
  const n = niche.replace(/\s+/g, '').toLowerCase()
  const a = area.replace(/\s+/g, '').toLowerCase()
  // Shorten common words
  const nShort = n.replace('installation', '').replace('cleaning', 'clean').replace('removal', '')
  const proposals = [
    `${a}${n}.com`,
    `${n}${a}.com`,
    `${a}${nShort || n}pro.com`,
  ]
  // Ensure all under 25 chars (excl TLD)
  return proposals.map((d) => {
    const name = d.replace(/\.(com|net|co)$/, '')
    if (name.length > 25) {
      return `${a}${nShort || n}.net`
    }
    return d
  })
}

const today = new Date().toISOString().split('T')[0]
const totalRent = candidates.reduce((s, c) => s + Number(c.rent_estimate), 0)
const domainCost = candidates.length * 11
const phoneCost = candidates.length * 1.15

// Build memo
let md = `# Shortlist — Gate 1 Decision Memo

**Date:** ${today}
**Regions:** Permian Basin, Oklahoma, Arizona, New Mexico, Houston Metro
**Candidates evaluated:** ${allCandidates.filter((c) => c.validated_date).length} validated → ${tornDown.length} torn down → ${candidates.length} shortlisted

## Executive Summary

${candidates.length} candidates survive validation and teardown with combined estimated monthly rent of $${Math.round(totalRent).toLocaleString()}. Total upfront investment for domains: ~$${domainCost}, plus ~$${phoneCost.toFixed(2)}/mo for tracking numbers. Top opportunity is ${candidates[0].niche} in ${candidates[0].area} (score ${candidates[0].score_total}/16, est. $${candidates[0].rent_estimate}/mo rent).

## Recommended Candidates

`

for (let i = 0; i < candidates.length; i++) {
  const c = candidates[i]
  const calls = Math.round(Number(c.vol_primary) * 0.15)
  const domains = proposeDomains(c.niche, c.area)

  // Get first weakness line
  const weakLines = c.weaknesses.split('\n').filter((l) => l.startsWith('-')).slice(0, 2)
  const keyWeakness = weakLines.join('; ').replace(/^- /gm, '') || 'See teardown'

  md += `### ${i + 1}. ${c.niche} in ${c.area} — Score: ${c.score_total}/16

| Metric | Value |
|--------|-------|
| Monthly search volume | ${c.vol_primary} |
| CPC | $${c.cpc} |
| Estimated monthly calls | ${calls} |
| Estimated monthly rent | $${c.rent_estimate} |
| Teardown verdict | ${c.verdict} |
| Competitor weakness | ${keyWeakness} |

**Proposed domains:**

| # | Domain | Notes |
|---|--------|-------|
| 1 | ${domains[0]} | Best option |
| 2 | ${domains[1]} | Alternate word order |
| 3 | ${domains[2]} | Fallback |

---

`
}

// Marginal candidates (score 8-10, not torn down)
const marginals = allCandidates
  .filter((c) => c.status === 'validated' && Number(c.score_total) >= 8 && Number(c.score_total) <= 10)
  .sort((a, b) => Number(b.score_total) - Number(a.score_total))

if (marginals.length > 0) {
  md += `## Marginal Candidates (score 8–10, not yet torn down)

| Slug | Score | Vol | CPC | Est. Rent |
|------|-------|-----|-----|-----------|
`
  for (const c of marginals.slice(0, 15)) {
    md += `| ${c.slug} | ${c.score_total} | ${c.vol_primary} | $${c.cpc} | $${c.rent_estimate} |
`
  }
  if (marginals.length > 15) {
    md += `| ... and ${marginals.length - 15} more | | | | |
`
  }
  md += '\n'
}

md += `## Investment Summary

| Item | Count | Unit Cost | Total |
|------|-------|-----------|-------|
| Domain registrations | ${candidates.length} | ~$11 | $${domainCost} |
| Twilio phone numbers | ${candidates.length} | ~$1.15/mo | $${phoneCost.toFixed(2)}/mo |
| **Total upfront** | | | **$${domainCost}** |
| **Monthly recurring** | | | **$${phoneCost.toFixed(2)}/mo** |

## Gate 1 Question

**Which candidates should we purchase domains and phone numbers for?**

Please reply with the candidate numbers to proceed, or "none" to pass.
`

writeFileSync(`research/shortlist-${today}.md`, md)
console.log(`\nWrote research/shortlist-${today}.md`)

// Update CSV
for (const c of candidates) {
  const orig = allCandidates.find((o) => o.slug === c.slug)
  if (orig) orig.status = 'shortlisted'
}
writeFileSync('data/candidates.csv', serializeCandidatesCsv(allCandidates))
console.log('CSV updated — shortlisted:', candidates.length)
