import { describe, it, expect } from 'vitest'
import {
  buildSeedRequests,
  processRawResults,
  discoverNewNiches,
  formatNicheTable,
} from '../lib/discover.js'

describe('buildSeedRequests', () => {
  it('returns one request body per seed group', () => {
    const groups = [
      ['removal', 'demolition'],
      ['installation', 'replacement'],
    ]
    const requests = buildSeedRequests(groups)
    expect(requests).toHaveLength(2)
  })

  it('each request has correct structure', () => {
    const groups = [['removal', 'hauling']]
    const requests = buildSeedRequests(groups)
    expect(requests[0]).toEqual({
      keywords: ['removal', 'hauling'],
      location_code: 2840,
      language_code: 'en',
      sort_by: 'search_volume',
      search_partners: false,
    })
  })

  it('returns empty array for empty input', () => {
    expect(buildSeedRequests([])).toEqual([])
  })
})

describe('processRawResults', () => {
  it('extracts keyword, search_volume, cpc from API response', () => {
    const apiResults = [
      {
        tasks: [{
          result: [
            { keyword: 'junk removal', search_volume: 691300, cpc: 14.08 },
            { keyword: 'tree removal', search_volume: 500000, cpc: 12.50 },
          ],
        }],
      },
    ]
    const results = processRawResults(apiResults)
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ keyword: 'junk removal', search_volume: 691300, cpc: 14.08 })
    expect(results[1]).toEqual({ keyword: 'tree removal', search_volume: 500000, cpc: 12.50 })
  })

  it('flattens results from multiple API responses', () => {
    const apiResults = [
      { tasks: [{ result: [{ keyword: 'a', search_volume: 100, cpc: 5 }] }] },
      { tasks: [{ result: [{ keyword: 'b', search_volume: 200, cpc: 10 }] }] },
    ]
    const results = processRawResults(apiResults)
    expect(results).toHaveLength(2)
  })

  it('handles missing/null fields gracefully', () => {
    const apiResults = [
      {
        tasks: [{
          result: [
            { keyword: 'test kw', search_volume: null, cpc: null },
          ],
        }],
      },
    ]
    const results = processRawResults(apiResults)
    expect(results[0]).toEqual({ keyword: 'test kw', search_volume: 0, cpc: 0 })
  })

  it('skips responses with no result array', () => {
    const apiResults = [
      { tasks: [{ result: null }] },
      { tasks: [{ result: [{ keyword: 'ok', search_volume: 100, cpc: 5 }] }] },
    ]
    const results = processRawResults(apiResults)
    expect(results).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    expect(processRawResults([])).toEqual([])
  })
})

describe('discoverNewNiches', () => {
  const existingNiches = [
    { niche: 'junk removal', nat_vol: 691300, avg_cpc: 14.08 },
    { niche: 'pressure washing', nat_vol: 561000, avg_cpc: 11.32 },
  ]

  it('filters out existing niches and non-home-service terms', () => {
    const rawKeywords = [
      { keyword: 'junk removal near me', search_volume: 100000, cpc: 14 },
      { keyword: 'bathroom remodeling cost', search_volume: 50000, cpc: 33 },
      { keyword: 'colonoscopy near me', search_volume: 80000, cpc: 50 },
    ]
    const result = discoverNewNiches(rawKeywords, existingNiches, { minVolume: 0, minCpc: 0 })
    const niches = result.map(r => r.niche)
    expect(niches).toContain('bathroom remodeling')
    expect(niches).not.toContain('junk removal')
    expect(niches).not.toContain('colonoscopy')
  })

  it('returns results sorted by total_volume * avg_cpc descending', () => {
    const rawKeywords = [
      { keyword: 'bathroom remodeling', search_volume: 50000, cpc: 33 },
      { keyword: 'driveway paving cost', search_volume: 30000, cpc: 12 },
      { keyword: 'crawl space encapsulation', search_volume: 33000, cpc: 33 },
    ]
    const result = discoverNewNiches(rawKeywords, existingNiches, { minVolume: 0, minCpc: 0 })
    // bathroom: 50000*33=1650000, crawl: 33000*33=1089000, driveway: 30000*12=360000
    expect(result[0].niche).toBe('bathroom remodeling')
    expect(result[1].niche).toBe('crawl space encapsulation')
    expect(result[2].niche).toBe('driveway paving')
  })

  it('returns empty array when all niches already exist', () => {
    const rawKeywords = [
      { keyword: 'junk removal dallas', search_volume: 5000, cpc: 14 },
      { keyword: 'pressure washing houston', search_volume: 3000, cpc: 11 },
    ]
    const result = discoverNewNiches(rawKeywords, existingNiches, { minVolume: 0, minCpc: 0 })
    expect(result).toHaveLength(0)
  })
})

describe('formatNicheTable', () => {
  it('returns a formatted string with header and rows', () => {
    const niches = [
      { niche: 'bathroom remodeling', total_volume: 439240, avg_cpc: 33.31 },
      { niche: 'driveway paving', total_volume: 32140, avg_cpc: 11.81 },
    ]
    const table = formatNicheTable(niches)
    expect(table).toContain('bathroom remodeling')
    expect(table).toContain('driveway paving')
    expect(table).toContain('439240')
    expect(table).toContain('33.31')
  })

  it('returns header only for empty input', () => {
    const table = formatNicheTable([])
    expect(table).toContain('Niche')
    expect(table.split('\n').length).toBeLessThanOrEqual(3)
  })
})
