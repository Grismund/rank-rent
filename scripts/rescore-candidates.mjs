#!/usr/bin/env node
// scripts/rescore-candidates.mjs
// Re-scores validated candidates using saved raw data (no API calls)
// Fixes the shared-phrase overwrite issue from validate-candidates.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import {
  scoreSearchVolume, scoreCPC, scoreMapPackWeakness, scoreOrganicWeakness,
  scoreRenterAvailability, scoreLicenseBarrier, scoreSeasonality,
  estimateRent, scoreRentPotential, totalScore,
} from '../lib/scoring.js'
import { DIRECTORY_DOMAINS } from '../lib/constants.js'

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

  // Recompute volumes from per-candidate raw data
  const phrases = (c.phrases || '').split('|').filter(Boolean)
  let totalVol = 0, maxCpc = 0, primaryVol = 0
  for (const p of phrases) {
    const v = raw.volumes[p]
    if (v) {
      totalVol += v.search_volume
      if (v.cpc > maxCpc) maxCpc = v.cpc
      if (p === c.primary_phrase) primaryVol = v.search_volume
    }
  }

  // Maps
  const topThree = raw.maps?.topThree || []
  const renterCount = raw.maps?.totalCount || 0

  // Organic
  const orgDomains = []
  for (const o of (raw.organic || [])) {
    for (const d of o.topDomains) {
      if (!orgDomains.includes(d)) orgDomains.push(d)
    }
  }

  // Seasonality
  const monthly = raw.trends || []

  // Rent
  const rentEst = estimateRent(primaryVol, maxCpc)

  // Score
  const signals = {
    volume: scoreSearchVolume(primaryVol),
    cpc: scoreCPC(maxCpc),
    mapPack: scoreMapPackWeakness(topThree),
    organic: scoreOrganicWeakness(orgDomains.slice(0, 5), DIRECTORY_DOMAINS),
    renters: scoreRenterAvailability(renterCount),
    license: scoreLicenseBarrier(c.license_barrier),
    seasonality: scoreSeasonality(monthly),
    rent: scoreRentPotential(rentEst),
  }
  const { total, status } = totalScore(signals)
  const newStatus = total >= 8 ? 'validated' : 'walk_away'

  // Check for changes
  const oldTotal = Number(c.score_total)
  if (total !== oldTotal || c.cpc !== String(maxCpc)) {
    console.log(`${c.slug}: cpc ${c.cpc}→${maxCpc}, score ${oldTotal}→${total}, status ${c.status}→${newStatus}`)
    changed++
  }

  // Update
  c.vol_total = totalVol
  c.vol_primary = primaryVol
  c.cpc = maxCpc
  c.map_pack_weak = topThree.map((m) => `${m.reviews}r/${m.rating}`).join('|')
  c.renter_count = renterCount
  c.organic_weak = orgDomains.slice(0, 5).join('|')
  c.seasonality = monthly.join('|')
  c.rent_estimate = Math.round(rentEst * 100) / 100
  c.score_vol = signals.volume
  c.score_cpc = signals.cpc
  c.score_map = signals.mapPack
  c.score_organic = signals.organic
  c.score_renters = signals.renters
  c.score_license = signals.license
  c.score_season = signals.seasonality
  c.score_rent = signals.rent
  c.score_total = total
  c.status = newStatus
}

writeFileSync('data/candidates.csv', serializeCandidatesCsv(allCandidates))
console.log(`\n${changed} candidates had score changes`)
console.log('CSV updated')
