import { describe, it, expect } from 'vitest'
import {
  estimateValidationCost,
  estimateTeardownCost,
  estimateViabilityCost,
} from '../lib/cost-estimator.js'

describe('estimateValidationCost', () => {
  it('estimates cost for a batch of candidates', () => {
    // Each candidate: ~2 keyword volume calls share batching, 2 organic SERP, 1 maps, ~1 trends
    // Keyword volume: $0.05 per task (up to 1000 keywords)
    // Organic SERP: $0.003 per task
    // Maps SERP: $0.003 per task
    // Trends: $0.01 per task (per unique niche)
    const candidates = [
      { slug: 'a', niche: 'house cleaning', phrases: 'a|b|c|d|e' },
      { slug: 'b', niche: 'house cleaning', phrases: 'a|b|c|d|e' },
      { slug: 'c', niche: 'lawn care', phrases: 'a|b|c|d|e' },
    ]
    const result = estimateValidationCost(candidates)
    expect(result.total).toBeGreaterThan(0)
    expect(result.total).toBeLessThan(1) // should be well under $1 for 3 candidates
    expect(result.breakdown).toBeDefined()
    expect(result.breakdown.keywordVolume).toBeGreaterThan(0)
    expect(result.breakdown.organicSerp).toBeGreaterThan(0)
    expect(result.breakdown.mapsSerp).toBeGreaterThan(0)
    expect(result.breakdown.trends).toBeGreaterThan(0)
  })

  it('returns zero for empty candidates', () => {
    const result = estimateValidationCost([])
    expect(result.total).toBe(0)
  })

  it('counts unique niches for trends cost', () => {
    const samNiche = [
      { slug: 'a', niche: 'house cleaning', phrases: 'a|b' },
      { slug: 'b', niche: 'house cleaning', phrases: 'a|b' },
      { slug: 'c', niche: 'house cleaning', phrases: 'a|b' },
    ]
    const mixedNiche = [
      { slug: 'a', niche: 'house cleaning', phrases: 'a|b' },
      { slug: 'b', niche: 'lawn care', phrases: 'a|b' },
      { slug: 'c', niche: 'pest control', phrases: 'a|b' },
    ]
    const samResult = estimateValidationCost(samNiche)
    const mixedResult = estimateValidationCost(mixedNiche)
    expect(mixedResult.breakdown.trends).toBeGreaterThan(samResult.breakdown.trends)
  })
})

describe('estimateTeardownCost', () => {
  it('estimates cost based on N candidates × 4 competitors × $0.02', () => {
    const candidates = [
      { slug: 'a' },
      { slug: 'b' },
      { slug: 'c' },
    ]
    const result = estimateTeardownCost(candidates)
    // 3 × 4 × $0.02 = $0.24
    expect(result).toBeCloseTo(0.24)
  })

  it('returns zero for empty candidates', () => {
    expect(estimateTeardownCost([])).toBe(0)
  })

  it('handles single candidate', () => {
    // 1 × 4 × $0.02 = $0.08
    expect(estimateTeardownCost([{ slug: 'a' }])).toBeCloseTo(0.08)
  })
})

describe('estimateViabilityCost', () => {
  it('estimates $0.01 per candidate needing API call', () => {
    const result = estimateViabilityCost(5, 2)
    // 5 total, 2 cached = 3 need API calls × $0.01
    expect(result.total).toBeCloseTo(0.03)
    expect(result.apiCalls).toBe(3)
    expect(result.cached).toBe(2)
  })

  it('returns zero when all are cached', () => {
    const result = estimateViabilityCost(5, 5)
    expect(result.total).toBe(0)
    expect(result.apiCalls).toBe(0)
  })

  it('returns zero for zero candidates', () => {
    const result = estimateViabilityCost(0, 0)
    expect(result.total).toBe(0)
  })

  it('handles no cache hits', () => {
    const result = estimateViabilityCost(10, 0)
    expect(result.total).toBeCloseTo(0.10)
    expect(result.apiCalls).toBe(10)
  })
})
