import { describe, it, expect } from 'vitest'
import {
  calcEpoxyCost,
  calcBathBudget,
  calcTintLegality,
  calcTintCost,
  calcLoadSize,
  calcKitchenBudget,
  calcPoolCost,
  calcPaverSealing,
  calcSurfaceCost,
} from '../src/lib/tool-calcs'

// --- calcEpoxyCost ---

describe('calcEpoxyCost', () => {
  it('maps 1-car garage to ~250 sqft', () => {
    const r = calcEpoxyCost({ garageCars: 1, finish: 'solid', condition: 'new' })
    expect(r.sqFt).toBe(250)
  })

  it('maps 2-car garage to ~450 sqft', () => {
    const r = calcEpoxyCost({ garageCars: 2, finish: 'solid', condition: 'new' })
    expect(r.sqFt).toBe(450)
  })

  it('maps 3-car garage to ~700 sqft', () => {
    const r = calcEpoxyCost({ garageCars: 3, finish: 'solid', condition: 'new' })
    expect(r.sqFt).toBe(700)
  })

  it('accepts custom sqft', () => {
    const r = calcEpoxyCost({ customSqFt: 1000, finish: 'solid', condition: 'new' })
    expect(r.sqFt).toBe(1000)
  })

  it('solid finish returns $3-7/sqft range', () => {
    const r = calcEpoxyCost({ garageCars: 2, finish: 'solid', condition: 'new' })
    expect(r.perSqFt.low).toBe(3)
    expect(r.perSqFt.high).toBe(7)
  })

  it('metallic finish returns $5-12/sqft range', () => {
    const r = calcEpoxyCost({ garageCars: 2, finish: 'metallic', condition: 'new' })
    expect(r.perSqFt.low).toBe(5)
    expect(r.perSqFt.high).toBe(12)
  })

  it('condition multipliers: new=1x, minor_cracks=1.1x, oil_stains=1.2x', () => {
    const base = calcEpoxyCost({ garageCars: 2, finish: 'solid', condition: 'new' })
    const cracks = calcEpoxyCost({ garageCars: 2, finish: 'solid', condition: 'minor_cracks' })
    const oil = calcEpoxyCost({ garageCars: 2, finish: 'solid', condition: 'oil_stains' })
    expect(cracks.total.low).toBeCloseTo(base.total.low * 1.1, 0)
    expect(oil.total.low).toBeCloseTo(base.total.low * 1.2, 0)
  })

  it('returns range where low < high', () => {
    const r = calcEpoxyCost({ garageCars: 2, finish: 'flake', condition: 'new' })
    expect(r.total.low).toBeLessThan(r.total.high)
  })

  it('returns estimated days', () => {
    const r = calcEpoxyCost({ garageCars: 2, finish: 'solid', condition: 'new' })
    expect(r.days).toBeGreaterThan(0)
  })

  it('different finishes produce different ranges', () => {
    const solid = calcEpoxyCost({ garageCars: 2, finish: 'solid', condition: 'new' })
    const metallic = calcEpoxyCost({ garageCars: 2, finish: 'metallic', condition: 'new' })
    expect(solid.total.low).not.toBe(metallic.total.low)
  })
})

// --- calcBathBudget ---

describe('calcBathBudget', () => {
  const types = ['half', 'full', 'master'] as const
  const scopes = ['cosmetic', 'standard', 'full'] as const
  const tiers = ['budget', 'mid', 'premium'] as const

  it('all 27 combos produce different or valid ranges', () => {
    const results = new Set<string>()
    for (const type of types) {
      for (const scope of scopes) {
        for (const tier of tiers) {
          const r = calcBathBudget({ type, scope, tier })
          expect(r.total.low).toBeLessThan(r.total.high)
          results.add(`${r.total.low}-${r.total.high}`)
        }
      }
    }
    // At least 9 distinct ranges (not all identical)
    expect(results.size).toBeGreaterThanOrEqual(9)
  })

  it('returns timeline in weeks', () => {
    const r = calcBathBudget({ type: 'full', scope: 'standard', tier: 'mid' })
    expect(r.timelineWeeks).toBeGreaterThan(0)
  })

  it('permit flag true when scope=full', () => {
    const r = calcBathBudget({ type: 'full', scope: 'full', tier: 'mid' })
    expect(r.permitRequired).toBe(true)
  })

  it('permit flag false when scope=cosmetic', () => {
    const r = calcBathBudget({ type: 'full', scope: 'cosmetic', tier: 'mid' })
    expect(r.permitRequired).toBe(false)
  })

  it('master bath costs more than half bath same scope/tier', () => {
    const half = calcBathBudget({ type: 'half', scope: 'standard', tier: 'mid' })
    const master = calcBathBudget({ type: 'master', scope: 'standard', tier: 'mid' })
    expect(master.total.low).toBeGreaterThan(half.total.low)
  })
})

// --- calcTintLegality ---

describe('calcTintLegality', () => {
  it('TX front side limit is 25% VLT', () => {
    const r = calcTintLegality({ state: 'TX', window: 'front_side', desiredVLT: 20 })
    expect(r.limit).toBe(25)
    expect(r.legal).toBe(false)
  })

  it('TX windshield allows above AS-1 line', () => {
    const r = calcTintLegality({ state: 'TX', window: 'windshield', desiredVLT: 25 })
    expect(r.limit).toBe(25)
  })

  it('FL front side limit is 28% VLT', () => {
    const r = calcTintLegality({ state: 'FL', window: 'front_side', desiredVLT: 30 })
    expect(r.limit).toBe(28)
    expect(r.legal).toBe(true)
  })

  it('AZ front side limit is 33% VLT', () => {
    const r = calcTintLegality({ state: 'AZ', window: 'front_side', desiredVLT: 35 })
    expect(r.limit).toBe(33)
    expect(r.legal).toBe(true)
  })

  it('AZ front side rejects VLT below 33%', () => {
    const r = calcTintLegality({ state: 'AZ', window: 'front_side', desiredVLT: 30 })
    expect(r.legal).toBe(false)
  })

  it('AZ rear window has no limit (any%)', () => {
    const r = calcTintLegality({ state: 'AZ', window: 'rear', desiredVLT: 5 })
    expect(r.legal).toBe(true)
  })

  it('returns statute reference', () => {
    const r = calcTintLegality({ state: 'TX', window: 'front_side', desiredVLT: 25 })
    expect(r.statute).toBeTruthy()
    expect(typeof r.statute).toBe('string')
  })

  it('checks all window positions', () => {
    const positions = ['windshield', 'front_side', 'rear_side', 'rear'] as const
    for (const window of positions) {
      const r = calcTintLegality({ state: 'TX', window, desiredVLT: 50 })
      expect(typeof r.legal).toBe('boolean')
    }
  })
})

// --- calcTintCost ---

describe('calcTintCost', () => {
  it('returns range where low < high', () => {
    const r = calcTintCost({ vehicle: 'sedan', film: 'dyed' })
    expect(r.total.low).toBeLessThan(r.total.high)
  })

  it('removal adds to cost', () => {
    const without = calcTintCost({ vehicle: 'sedan', film: 'dyed' })
    const withRemoval = calcTintCost({ vehicle: 'sedan', film: 'dyed', removal: true })
    expect(withRemoval.total.low).toBeGreaterThan(without.total.low)
  })

  it('ceramic film costs more than dyed', () => {
    const dyed = calcTintCost({ vehicle: 'sedan', film: 'dyed' })
    const ceramic = calcTintCost({ vehicle: 'sedan', film: 'ceramic' })
    expect(ceramic.total.low).toBeGreaterThan(dyed.total.low)
  })

  it('SUV costs more than sedan', () => {
    const sedan = calcTintCost({ vehicle: 'sedan', film: 'dyed' })
    const suv = calcTintCost({ vehicle: 'suv', film: 'dyed' })
    expect(suv.total.low).toBeGreaterThan(sedan.total.low)
  })
})

// --- calcLoadSize ---

describe('calcLoadSize', () => {
  it('returns cubic yards and truck fraction', () => {
    const r = calcLoadSize({
      items: [{ type: 'couch', qty: 1 }, { type: 'mattress', qty: 1 }],
    })
    expect(r.cubicYards).toBeGreaterThan(0)
    expect(r.truckFraction).toBeGreaterThan(0)
  })

  it('truck fraction rounds to nearest 1/8', () => {
    const r = calcLoadSize({
      items: [{ type: 'couch', qty: 1 }],
    })
    const fraction = r.truckFraction * 8
    expect(fraction).toBeCloseTo(Math.round(fraction), 5)
  })

  it('stairs surcharge adds to price range', () => {
    const noStairs = calcLoadSize({
      items: [{ type: 'couch', qty: 1 }],
    })
    const withStairs = calcLoadSize({
      items: [{ type: 'couch', qty: 1 }],
      stairsFlag: true,
    })
    expect(withStairs.priceRange.low).toBeGreaterThan(noStairs.priceRange.low)
  })

  it('reports extra cost items for stairs', () => {
    const r = calcLoadSize({
      items: [{ type: 'couch', qty: 1 }],
      stairsFlag: true,
    })
    expect(r.extraCostItems.length).toBeGreaterThan(0)
  })

  it('empty items returns zero', () => {
    const r = calcLoadSize({ items: [] })
    expect(r.cubicYards).toBe(0)
    expect(r.truckFraction).toBe(0)
  })

  it('output varies with quantity', () => {
    const one = calcLoadSize({ items: [{ type: 'couch', qty: 1 }] })
    const three = calcLoadSize({ items: [{ type: 'couch', qty: 3 }] })
    expect(three.cubicYards).toBeGreaterThan(one.cubicYards)
  })
})

// --- calcKitchenBudget ---

describe('calcKitchenBudget', () => {
  it('returns range where low < high', () => {
    const r = calcKitchenBudget({ size: 'medium', scope: 'standard', tier: 'mid' })
    expect(r.total.low).toBeLessThan(r.total.high)
  })

  it('returns timeline in weeks', () => {
    const r = calcKitchenBudget({ size: 'medium', scope: 'standard', tier: 'mid' })
    expect(r.timelineWeeks).toBeGreaterThan(0)
  })

  it('permit required when scope=full', () => {
    const r = calcKitchenBudget({ size: 'medium', scope: 'full', tier: 'mid' })
    expect(r.permitRequired).toBe(true)
  })

  it('large kitchen costs more than small', () => {
    const small = calcKitchenBudget({ size: 'small', scope: 'standard', tier: 'mid' })
    const large = calcKitchenBudget({ size: 'large', scope: 'standard', tier: 'mid' })
    expect(large.total.low).toBeGreaterThan(small.total.low)
  })

  it('premium tier costs more than budget', () => {
    const budget = calcKitchenBudget({ size: 'medium', scope: 'standard', tier: 'budget' })
    const premium = calcKitchenBudget({ size: 'medium', scope: 'standard', tier: 'premium' })
    expect(premium.total.low).toBeGreaterThan(budget.total.low)
  })
})

// --- calcPoolCost ---

describe('calcPoolCost', () => {
  it('returns range where low < high', () => {
    const r = calcPoolCost({ type: 'fiberglass', size: 'medium', features: [] })
    expect(r.total.low).toBeLessThan(r.total.high)
  })

  it('features add to base cost', () => {
    const base = calcPoolCost({ type: 'fiberglass', size: 'medium', features: [] })
    const withFeatures = calcPoolCost({
      type: 'fiberglass',
      size: 'medium',
      features: ['screen_enclosure', 'decking'],
    })
    expect(withFeatures.total.low).toBeGreaterThan(base.total.low)
  })

  it('returns feature add-on breakdown', () => {
    const r = calcPoolCost({
      type: 'fiberglass',
      size: 'medium',
      features: ['screen_enclosure'],
    })
    expect(r.featureAdds.length).toBe(1)
    expect(r.featureAdds[0].label).toBeTruthy()
  })

  it('concrete costs more than fiberglass', () => {
    const fiber = calcPoolCost({ type: 'fiberglass', size: 'medium', features: [] })
    const concrete = calcPoolCost({ type: 'concrete', size: 'medium', features: [] })
    expect(concrete.baseRange.low).toBeGreaterThan(fiber.baseRange.low)
  })

  it('returns timeline and permit flag', () => {
    const r = calcPoolCost({ type: 'fiberglass', size: 'medium', features: [] })
    expect(r.timelineWeeks).toBeGreaterThan(0)
    expect(r.permitRequired).toBe(true)
  })
})

// --- calcPaverSealing ---

describe('calcPaverSealing', () => {
  it('returns range where low < high', () => {
    const r = calcPaverSealing({ areaSqFt: 500, condition: 'good', finish: 'wet_look' })
    expect(r.total.low).toBeLessThan(r.total.high)
  })

  it('larger area costs more', () => {
    const small = calcPaverSealing({ areaSqFt: 200, condition: 'good', finish: 'wet_look' })
    const large = calcPaverSealing({ areaSqFt: 1000, condition: 'good', finish: 'wet_look' })
    expect(large.total.low).toBeGreaterThan(small.total.low)
  })

  it('resand adds to cost', () => {
    const without = calcPaverSealing({ areaSqFt: 500, condition: 'good', finish: 'wet_look' })
    const withResand = calcPaverSealing({ areaSqFt: 500, condition: 'good', finish: 'wet_look', resand: true })
    expect(withResand.total.low).toBeGreaterThan(without.total.low)
  })

  it('returns reseal interval in years', () => {
    const r = calcPaverSealing({ areaSqFt: 500, condition: 'good', finish: 'wet_look' })
    expect(r.resealIntervalYears).toBeGreaterThan(0)
  })

  it('poor condition costs more than good', () => {
    const good = calcPaverSealing({ areaSqFt: 500, condition: 'good', finish: 'wet_look' })
    const poor = calcPaverSealing({ areaSqFt: 500, condition: 'poor', finish: 'wet_look' })
    expect(poor.total.low).toBeGreaterThan(good.total.low)
  })
})

// --- calcSurfaceCost ---

describe('calcSurfaceCost', () => {
  it('returns per-surface and total ranges', () => {
    const r = calcSurfaceCost({
      surfaces: [
        { type: 'driveway', sqFt: 600 },
        { type: 'house', sqFt: 2000 },
      ],
    })
    expect(r.perSurface.length).toBe(2)
    expect(r.total.low).toBeLessThan(r.total.high)
  })

  it('total is sum of per-surface ranges', () => {
    const r = calcSurfaceCost({
      surfaces: [
        { type: 'driveway', sqFt: 600 },
        { type: 'deck', sqFt: 400 },
      ],
    })
    const sumLow = r.perSurface.reduce((s, p) => s + p.low, 0)
    const sumHigh = r.perSurface.reduce((s, p) => s + p.high, 0)
    expect(r.total.low).toBe(sumLow)
    expect(r.total.high).toBe(sumHigh)
  })

  it('different surface types have different per-sqft rates', () => {
    const driveway = calcSurfaceCost({ surfaces: [{ type: 'driveway', sqFt: 1000 }] })
    const deck = calcSurfaceCost({ surfaces: [{ type: 'deck', sqFt: 1000 }] })
    // Rates may differ
    expect(driveway.perSurface[0].low).not.toBe(deck.perSurface[0].low)
  })

  it('returns recommended frequency', () => {
    const r = calcSurfaceCost({
      surfaces: [{ type: 'house', sqFt: 2000 }],
    })
    expect(r.frequencyMonths).toBeGreaterThan(0)
  })

  it('empty surfaces returns zero total', () => {
    const r = calcSurfaceCost({ surfaces: [] })
    expect(r.total.low).toBe(0)
    expect(r.total.high).toBe(0)
  })
})
