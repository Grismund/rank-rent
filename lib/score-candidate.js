import {
  scoreSearchVolume, scoreCPC, scoreMapPackWeakness, scoreOrganicWeakness,
  scoreRenterAvailability, scoreLicenseBarrier, scoreSeasonality,
  estimateRent, scoreRentPotential, totalScore,
} from './scoring.js'
import { DIRECTORY_DOMAINS } from './constants.js'

/**
 * Score a candidate from its raw validation data.
 * Extracts volumes, organic, maps, trends from the raw data object
 * and computes all 8 scoring signals + totals.
 *
 * @param {Object} candidate - Candidate row with slug, primary_phrase, phrases, license_barrier
 * @param {Object} raw - Raw validation data (volumes, organic, maps, trends)
 * @returns {Object} Scored fields to merge onto the candidate
 */
export function scoreCandidateFromRaw(candidate, raw) {
  const phrases = (candidate.phrases || '').split('|').filter(Boolean)

  // Aggregate volumes
  let volTotal = 0, maxCpc = 0, primaryVol = 0
  for (const p of phrases) {
    const v = raw.volumes?.[p]
    if (v) {
      volTotal += v.search_volume
      if (v.cpc > maxCpc) maxCpc = v.cpc
      if (p === candidate.primary_phrase) primaryVol = v.search_volume
    }
  }

  // Maps
  const topThree = raw.maps?.topThree || []
  const renterCount = raw.maps?.totalCount || 0

  // Organic — deduplicated domains across all SERP pulls
  const orgDomains = []
  for (const o of (raw.organic || [])) {
    for (const d of (o.topDomains || [])) {
      if (!orgDomains.includes(d)) orgDomains.push(d)
    }
  }

  // Seasonality
  const monthly = raw.trends || []

  // Rent
  const rentEst = estimateRent(primaryVol, maxCpc)

  // 8 scores
  const signals = {
    volume: scoreSearchVolume(primaryVol),
    cpc: scoreCPC(maxCpc),
    mapPack: scoreMapPackWeakness(topThree),
    organic: scoreOrganicWeakness(orgDomains.slice(0, 5), DIRECTORY_DOMAINS),
    renters: scoreRenterAvailability(renterCount),
    license: scoreLicenseBarrier(candidate.license_barrier),
    seasonality: scoreSeasonality(monthly),
    rent: scoreRentPotential(rentEst),
  }
  const { total } = totalScore(signals)
  const status = total >= 8 ? 'validated' : 'walk_away'

  return {
    vol_total: volTotal,
    vol_primary: primaryVol,
    cpc: maxCpc,
    map_pack_weak: topThree.map((m) => `${m.reviews}r/${m.rating}`).join('|'),
    renter_count: renterCount,
    organic_weak: orgDomains.slice(0, 5).join('|'),
    seasonality: monthly.join('|'),
    rent_estimate: Math.round(rentEst * 100) / 100,
    score_vol: signals.volume,
    score_cpc: signals.cpc,
    score_map: signals.mapPack,
    score_organic: signals.organic,
    score_renters: signals.renters,
    score_license: signals.license,
    score_season: signals.seasonality,
    score_rent: signals.rent,
    score_total: total,
    status,
  }
}
