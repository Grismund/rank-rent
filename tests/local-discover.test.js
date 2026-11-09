import { describe, it, expect } from 'vitest'
import {
  buildLocalSeedRequests,
  estimateLocalDiscoveryCost,
  processLocalResults,
  localClusterToCandidate,
} from '../lib/local-discover.js'
import { CANDIDATES_CSV_COLUMNS, DISCOVERY_SEED_GROUPS } from '../lib/constants.js'

describe('buildLocalSeedRequests', () => {
  const cityInfo = { city: 'Georgetown', state: 'Texas', pop_2026: 115088 }

  it('flattens seed groups into batches of batchSize (default 20)', () => {
    const requests = buildLocalSeedRequests(DISCOVERY_SEED_GROUPS, cityInfo)
    // 8 groups, 35 total words → ceil(35/20) = 2 batches
    expect(requests).toHaveLength(2)
    expect(requests[0].keywords).toHaveLength(20)
    expect(requests[1].keywords).toHaveLength(15)
  })

  it('each request has location_name, language_code, sort_by, no location_code', () => {
    const requests = buildLocalSeedRequests(DISCOVERY_SEED_GROUPS, cityInfo)
    for (const req of requests) {
      expect(req.location_name).toBe('Georgetown,Texas,United States')
      expect(req.language_code).toBe('en')
      expect(req.sort_by).toBe('search_volume')
      expect(req).not.toHaveProperty('location_code')
    }
  })

  it('custom batchSize option works', () => {
    const groups = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]
    const requests = buildLocalSeedRequests(groups, cityInfo, { batchSize: 4 })
    expect(requests).toHaveLength(2)
    for (const req of requests) {
      expect(req.keywords).toHaveLength(4)
    }
  })

  it('empty input returns empty output', () => {
    expect(buildLocalSeedRequests([], cityInfo)).toEqual([])
  })
})

describe('estimateLocalDiscoveryCost', () => {
  it('10 cities × 2 batches × $0.09 = $1.80', () => {
    expect(estimateLocalDiscoveryCost(10, 2)).toBeCloseTo(1.80)
  })

  it('0 cities returns $0', () => {
    expect(estimateLocalDiscoveryCost(0, 2)).toBe(0)
  })

  it('custom costPerRequest works', () => {
    expect(estimateLocalDiscoveryCost(5, 2, 0.10)).toBeCloseTo(1.00)
  })
})

describe('processLocalResults', () => {
  const cityInfo = { city: 'Georgetown', state: 'Texas', pop_2026: 115088 }

  // keywords_data/google_ads/keywords_for_keywords response format: flat result[]
  const fakeApiResults = [
    {
      tasks: [{
        result: [
          { keyword: 'epoxy flooring near me', search_volume: 120, cpc: 8.50 },
          { keyword: 'epoxy flooring cost', search_volume: 80, cpc: 9.00 },
          { keyword: 'gutter installation near me', search_volume: 90, cpc: 7.00 },
          { keyword: 'gutter installation cost', search_volume: 60, cpc: 7.50 },
          { keyword: 'yoga classes near me', search_volume: 200, cpc: 3.00 },
        ],
      }],
    },
  ]

  it('returns clusters with city metadata attached', () => {
    const results = processLocalResults(fakeApiResults, cityInfo)
    for (const cluster of results) {
      expect(cluster.city).toBe('Georgetown')
      expect(cluster.state).toBe('Texas')
      expect(cluster.population).toBe(115088)
    }
  })

  it('filters non-home-service niches', () => {
    const results = processLocalResults(fakeApiResults, cityInfo)
    const niches = results.map(r => r.niche)
    expect(niches).not.toContain('yoga classes')
  })

  it('respects custom minVolume/minCpc', () => {
    // epoxy flooring: vol=200, avg_cpc=8.75 → passes minVol=150, minCpc=8
    // gutter installation: vol=150, avg_cpc=7.25 → fails minCpc=8
    const results = processLocalResults(fakeApiResults, cityInfo, { minVolume: 150, minCpc: 8 })
    const niches = results.map(r => r.niche)
    expect(niches).toContain('epoxy flooring')
    expect(niches).not.toContain('gutter installation')
  })

  it('uses defaults of minVolume=50, minCpc=6', () => {
    const lowResults = [
      {
        tasks: [{
          result: [
            { keyword: 'deck staining near me', search_volume: 30, cpc: 8.00 },
          ],
        }],
      },
    ]
    const results = processLocalResults(lowResults, cityInfo)
    expect(results).toHaveLength(0)
  })

  it('empty/null API results return empty array', () => {
    expect(processLocalResults([], cityInfo)).toEqual([])
    expect(processLocalResults([{ tasks: [{ result: null }] }], cityInfo)).toEqual([])
  })
})

describe('localClusterToCandidate', () => {
  const cluster = {
    niche: 'epoxy flooring',
    city: 'Georgetown',
    state: 'Texas',
    population: 115088,
    total_volume: 200,
    avg_cpc: 8.75,
    keyword_count: 2,
    top_keywords: [
      { keyword: 'epoxy flooring near me', search_volume: 120, cpc: 8.50 },
      { keyword: 'epoxy flooring cost', search_volume: 80, cpc: 9.00 },
    ],
  }

  it('generates correct slug', () => {
    const candidate = localClusterToCandidate(cluster)
    expect(candidate.slug).toBe('epoxy-flooring-georgetown')
  })

  it('sets region to "State (local-discover)"', () => {
    const candidate = localClusterToCandidate(cluster)
    expect(candidate.region).toBe('Texas (local-discover)')
  })

  it('sets status to "discovered" with empty scoring fields', () => {
    const candidate = localClusterToCandidate(cluster)
    expect(candidate.status).toBe('discovered')
    expect(candidate.score_total).toBe('')
    expect(candidate.score_vol).toBe('')
    expect(candidate.validated_date).toBe('')
  })

  it('has all CANDIDATES_CSV_COLUMNS keys', () => {
    const candidate = localClusterToCandidate(cluster)
    for (const col of CANDIDATES_CSV_COLUMNS) {
      expect(candidate).toHaveProperty(col)
    }
  })

  it('populates volume and cpc from cluster', () => {
    const candidate = localClusterToCandidate(cluster)
    expect(candidate.vol_total).toBe(200)
    expect(candidate.cpc).toBe(8.75)
  })
})
