#!/usr/bin/env node
// scripts/rescore-candidates.mjs
// Re-scores validated candidates using saved raw data (no API calls)
// Fixes the shared-phrase overwrite issue from validate-candidates.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import { scoreCandidateFromRaw } from '../lib/score-candidate.js'

const csv = readFileSync('data/candidates.csv', 'utf8')
const allCandidates = parseCandidatesCsv(csv)
const today = new Date().toISOString().split('T')[0]

// Re-score candidates that have validation data but may have bad CPC from shared phrases
const toRescore = allCandidates.filter((c) => c.validated_date === today && c.status !== 'shortlisted')
console.log(`Re-scoring ${toRescore.length} candidates from raw data\n`)

let changed = 0
for (const c of toRescore) {
  const rawPath = `research/${c.slug}/validation-data.json`
  if (!existsSync(rawPath)) continue

  const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
  const scored = scoreCandidateFromRaw(c, raw)

  // Check for changes
  const oldTotal = Number(c.score_total)
  if (scored.score_total !== oldTotal || c.cpc !== String(scored.cpc)) {
    console.log(`${c.slug}: cpc ${c.cpc}→${scored.cpc}, score ${oldTotal}→${scored.score_total}, status ${c.status}→${scored.status}`)
    changed++
  }

  // Update
  Object.assign(c, scored)
}

writeFileSync('data/candidates.csv', serializeCandidatesCsv(allCandidates))
console.log(`\n${changed} candidates had score changes`)
console.log('CSV updated')
