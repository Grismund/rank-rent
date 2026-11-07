import { describe, it, expect } from 'vitest'
import { scoreCandidateFromRaw } from '../lib/score-candidate.js'

describe('scoreCandidateFromRaw', () => {
  const baseCandidate = {
    slug: 'junk-removal-houston',
    niche: 'junk removal',
    area: 'Houston',
    primary_phrase: 'junk removal houston',
    phrases: 'junk removal houston|junk removal houston tx|junk removal near me',
    license_barrier: 'none',
  }

  const baseRaw = {
    volumes: {
      'junk removal houston': { search_volume: 600, cpc: 15 },
      'junk removal houston tx': { search_volume: 200, cpc: 12 },
      'junk removal near me': { search_volume: 100, cpc: 14 },
    },
    organic: [
      { keyword: 'junk removal houston', topDomains: ['yelp.com', 'angi.com', 'thumbtack.com', 'localjunk.com', 'junkbros.com'] },
    ],
    maps: {
      keyword: 'junk removal houston',
      topThree: [
        { name: 'Biz A', reviews: 30, rating: 3.5 },
        { name: 'Biz B', reviews: 120, rating: 4.8 },
        { name: 'Biz C', reviews: 10, rating: 3.2 },
      ],
      totalCount: 18,
    },
    trends: [70, 65, 80, 90, 85, 75, 60, 55, 70, 80, 90, 85],
  }

  it('returns all score fields', () => {
    const result = scoreCandidateFromRaw(baseCandidate, baseRaw)
    expect(result).toHaveProperty('vol_total')
    expect(result).toHaveProperty('vol_primary')
    expect(result).toHaveProperty('cpc')
    expect(result).toHaveProperty('map_pack_weak')
    expect(result).toHaveProperty('renter_count')
    expect(result).toHaveProperty('organic_weak')
    expect(result).toHaveProperty('seasonality')
    expect(result).toHaveProperty('rent_estimate')
    expect(result).toHaveProperty('score_vol')
    expect(result).toHaveProperty('score_cpc')
    expect(result).toHaveProperty('score_map')
    expect(result).toHaveProperty('score_organic')
    expect(result).toHaveProperty('score_renters')
    expect(result).toHaveProperty('score_license')
    expect(result).toHaveProperty('score_season')
    expect(result).toHaveProperty('score_rent')
    expect(result).toHaveProperty('score_total')
    expect(result).toHaveProperty('status')
  })

  it('computes correct volume totals', () => {
    const result = scoreCandidateFromRaw(baseCandidate, baseRaw)
    expect(result.vol_total).toBe(900) // 600 + 200 + 100
    expect(result.vol_primary).toBe(600)
    expect(result.cpc).toBe(15) // max across phrases
  })

  it('computes correct maps data', () => {
    const result = scoreCandidateFromRaw(baseCandidate, baseRaw)
    expect(result.renter_count).toBe(18)
    expect(result.map_pack_weak).toBe('30r/3.5|120r/4.8|10r/3.2')
  })

  it('deduplicates organic domains', () => {
    const raw = {
      ...baseRaw,
      organic: [
        { keyword: 'a', topDomains: ['yelp.com', 'angi.com'] },
        { keyword: 'b', topDomains: ['yelp.com', 'other.com'] },
      ],
    }
    const result = scoreCandidateFromRaw(baseCandidate, raw)
    // organic_weak should have unique domains, max 5
    expect(result.organic_weak.split('|')).toEqual(['yelp.com', 'angi.com', 'other.com'])
  })

  it('assigns validated status for score >= 8', () => {
    const result = scoreCandidateFromRaw(baseCandidate, baseRaw)
    expect(result.score_total).toBeGreaterThanOrEqual(8)
    expect(result.status).toBe('validated')
  })

  it('assigns walk_away status for low scores', () => {
    const lowRaw = {
      volumes: {
        'junk removal houston': { search_volume: 50, cpc: 3 },
        'junk removal houston tx': { search_volume: 10, cpc: 2 },
        'junk removal near me': { search_volume: 5, cpc: 1 },
      },
      organic: [{ keyword: 'a', topDomains: ['localbiz.com', 'anotherbiz.com'] }],
      maps: { topThree: [
        { name: 'A', reviews: 200, rating: 4.9 },
        { name: 'B', reviews: 150, rating: 4.7 },
        { name: 'C', reviews: 300, rating: 4.8 },
      ], totalCount: 3 },
      trends: [10, 10, 90, 90, 10, 10, 10, 10, 10, 10, 10, 10],
    }
    const result = scoreCandidateFromRaw(baseCandidate, lowRaw)
    expect(result.score_total).toBeLessThan(8)
    expect(result.status).toBe('walk_away')
  })

  it('handles missing volumes gracefully', () => {
    const raw = { ...baseRaw, volumes: {} }
    const result = scoreCandidateFromRaw(baseCandidate, raw)
    expect(result.vol_total).toBe(0)
    expect(result.vol_primary).toBe(0)
    expect(result.cpc).toBe(0)
  })

  it('handles missing organic data', () => {
    const raw = { ...baseRaw, organic: [] }
    const result = scoreCandidateFromRaw(baseCandidate, raw)
    expect(result.organic_weak).toBe('')
  })

  it('handles missing maps data', () => {
    const raw = { ...baseRaw, maps: null }
    const result = scoreCandidateFromRaw(baseCandidate, raw)
    expect(result.map_pack_weak).toBe('')
    expect(result.renter_count).toBe(0)
  })

  it('handles missing trends data', () => {
    const raw = { ...baseRaw, trends: [] }
    const result = scoreCandidateFromRaw(baseCandidate, raw)
    expect(result.seasonality).toBe('')
  })

  it('computes rent estimate correctly', () => {
    const result = scoreCandidateFromRaw(baseCandidate, baseRaw)
    // rent = vol_primary * 0.15 * 0.10 * cpc * 7.5 / 2 = 600 * 0.15 * 0.10 * 15 * 7.5 / 2
    const expected = 600 * 0.15 * 0.10 * 15 * 7.5 / 2
    expect(result.rent_estimate).toBe(Math.round(expected * 100) / 100)
  })
})
