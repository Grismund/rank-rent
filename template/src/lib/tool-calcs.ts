/**
 * Tool calculator functions — pure logic for all 8 niche tools.
 * Data tables sourced from niches/<niche>/brief.md "Job Economics"
 * and reference/niche-economics.md.
 */

interface Range { low: number; high: number }

// --- Epoxy Flooring ---
// Source: niches/epoxy-flooring/brief.md — Job Economics
// Solid $3–7/sqft, Flake $3–7, Metallic $5–12, Polyaspartic $4–9
// Condition: new 1×, minor cracks 1.1×, oil stains/old coating 1.2×

const GARAGE_SIZES: Record<number, number> = { 1: 250, 2: 450, 3: 700 }
const EPOXY_FINISH_RATES: Record<string, Range> = {
  solid: { low: 3, high: 7 },
  flake: { low: 3, high: 7 },
  metallic: { low: 5, high: 12 },
  polyaspartic: { low: 4, high: 9 },
}
const EPOXY_CONDITION_MULT: Record<string, number> = {
  new: 1.0,
  minor_cracks: 1.1,
  oil_stains: 1.2,
}

export interface EpoxyCostInput {
  garageCars?: number
  customSqFt?: number
  finish: string
  condition: string
}

export interface EpoxyCostResult {
  sqFt: number
  perSqFt: Range
  total: Range
  days: number
}

export function calcEpoxyCost(input: EpoxyCostInput): EpoxyCostResult {
  const sqFt = input.customSqFt ?? GARAGE_SIZES[input.garageCars ?? 2] ?? 450
  const rate = EPOXY_FINISH_RATES[input.finish] ?? EPOXY_FINISH_RATES.solid
  const mult = EPOXY_CONDITION_MULT[input.condition] ?? 1.0
  const days = sqFt <= 300 ? 1 : sqFt <= 500 ? 2 : 3
  return {
    sqFt,
    perSqFt: { low: rate.low, high: rate.high },
    total: {
      low: Math.round(sqFt * rate.low * mult),
      high: Math.round(sqFt * rate.high * mult),
    },
    days,
  }
}

// --- Bathroom Remodel ---
// Source: niches/bathroom-remodel/brief.md — Job Economics
// Avg $6K–$15K, ~$10K average, 25–40% margin, 2–4 week timeline

const BATH_TYPE_MULT: Record<string, number> = { half: 0.5, full: 1.0, master: 1.5 }
const BATH_SCOPE_MULT: Record<string, number> = { cosmetic: 0.5, standard: 1.0, full: 1.6 }
const BATH_TIER_RANGE: Record<string, Range> = {
  budget: { low: 3000, high: 6000 },
  mid: { low: 6000, high: 10000 },
  premium: { low: 10000, high: 15000 },
}

export interface BathBudgetInput {
  type: string
  scope: string
  tier: string
}

export interface BathBudgetResult {
  total: Range
  timelineWeeks: number
  permitRequired: boolean
}

export function calcBathBudget(input: BathBudgetInput): BathBudgetResult {
  const base = BATH_TIER_RANGE[input.tier] ?? BATH_TIER_RANGE.mid
  const typeMult = BATH_TYPE_MULT[input.type] ?? 1.0
  const scopeMult = BATH_SCOPE_MULT[input.scope] ?? 1.0
  const weeks = input.scope === 'cosmetic' ? 1 : input.scope === 'standard' ? 2 : 4
  return {
    total: {
      low: Math.round(base.low * typeMult * scopeMult),
      high: Math.round(base.high * typeMult * scopeMult),
    },
    timelineWeeks: weeks,
    permitRequired: input.scope === 'full',
  }
}

// --- Window Tinting: Legality ---
// Source: niches/window-tinting/brief.md, state statutes
// TX: Transportation Code §547.613 — front side 25%, rear any
// FL: F.S. §316.2953 — front side 28%, rear 15%
// AZ: ARS §28-959.01 — front side 33%, rear any

interface TintLimits {
  windshield: number
  front_side: number
  rear_side: number | null  // null = any
  rear: number | null       // null = any
  statute: string
}

const TINT_LAWS: Record<string, TintLimits> = {
  TX: {
    windshield: 25,
    front_side: 25,
    rear_side: null,
    rear: null,
    statute: 'TX Transportation Code §547.613',
  },
  FL: {
    windshield: 28,
    front_side: 28,
    rear_side: 15,
    rear: 15,
    statute: 'FL Statute §316.2953',
  },
  AZ: {
    windshield: 33,
    front_side: 33,
    rear_side: null,
    rear: null,
    statute: 'AZ ARS §28-959.01',
  },
}

export interface TintLegalityInput {
  state: string
  window: string
  desiredVLT: number
}

export interface TintLegalityResult {
  legal: boolean
  limit: number | null
  statute: string
}

export function calcTintLegality(input: TintLegalityInput): TintLegalityResult {
  const law = TINT_LAWS[input.state]
  if (!law) {
    return { legal: false, limit: null, statute: 'Unknown state' }
  }
  const limit = law[input.window as keyof TintLimits] as number | null
  const legal = limit === null ? true : input.desiredVLT >= limit
  return {
    legal,
    limit: limit ?? 0,
    statute: law.statute,
  }
}

// --- Window Tinting: Cost ---
// Source: niches/window-tinting/brief.md — $200–$600 residential/automotive
// Film types: dyed (cheapest), carbon (mid), ceramic (premium)

const TINT_VEHICLE_MULT: Record<string, number> = {
  sedan: 1.0,
  coupe: 0.9,
  suv: 1.3,
  truck: 1.15,
  van: 1.4,
}

const TINT_FILM_RANGE: Record<string, Range> = {
  dyed: { low: 150, high: 300 },
  carbon: { low: 250, high: 450 },
  ceramic: { low: 350, high: 600 },
}

const TINT_REMOVAL_COST: Range = { low: 75, high: 150 }

export interface TintCostInput {
  vehicle: string
  film: string
  removal?: boolean
}

export interface TintCostResult {
  total: Range
}

export function calcTintCost(input: TintCostInput): TintCostResult {
  const filmRange = TINT_FILM_RANGE[input.film] ?? TINT_FILM_RANGE.dyed
  const vehicleMult = TINT_VEHICLE_MULT[input.vehicle] ?? 1.0
  let low = Math.round(filmRange.low * vehicleMult)
  let high = Math.round(filmRange.high * vehicleMult)
  if (input.removal) {
    low += TINT_REMOVAL_COST.low
    high += TINT_REMOVAL_COST.high
  }
  return { total: { low, high } }
}

// --- Junk Removal: Load Size ---
// Source: niches/junk-removal/brief.md — $300–$500 avg job, $100 min single item
// Truck capacity ~15 cubic yards

const ITEM_VOLUMES: Record<string, number> = {
  couch: 2.0,
  mattress: 1.5,
  dresser: 1.2,
  table: 1.0,
  chair: 0.5,
  desk: 1.2,
  appliance: 1.5,
  tv: 0.4,
  boxes: 0.3,
  tires: 0.3,
  yard_waste: 1.0,
  misc_bag: 0.2,
}

const TRUCK_CAPACITY = 15  // cubic yards
const JUNK_BASE_PRICE: Range = { low: 100, high: 150 } // minimum
const JUNK_PER_YARD: Range = { low: 30, high: 45 }
const STAIRS_SURCHARGE: Range = { low: 50, high: 75 }

export interface LoadItem { type: string; qty: number }

export interface LoadSizeInput {
  items: LoadItem[]
  stairsFlag?: boolean
}

export interface LoadSizeResult {
  cubicYards: number
  truckFraction: number
  priceRange: Range
  extraCostItems: string[]
}

export function calcLoadSize(input: LoadSizeInput): LoadSizeResult {
  const totalYards = input.items.reduce((sum, item) => {
    const vol = ITEM_VOLUMES[item.type] ?? 0.5
    return sum + vol * item.qty
  }, 0)

  if (totalYards === 0) {
    return { cubicYards: 0, truckFraction: 0, priceRange: { low: 0, high: 0 }, extraCostItems: [] }
  }

  // Round truck fraction to nearest 1/8
  const rawFraction = totalYards / TRUCK_CAPACITY
  const truckFraction = Math.round(rawFraction * 8) / 8

  let low = JUNK_BASE_PRICE.low + Math.round(totalYards * JUNK_PER_YARD.low)
  let high = JUNK_BASE_PRICE.high + Math.round(totalYards * JUNK_PER_YARD.high)

  const extraCostItems: string[] = []
  if (input.stairsFlag) {
    low += STAIRS_SURCHARGE.low
    high += STAIRS_SURCHARGE.high
    extraCostItems.push('Stairs surcharge')
  }

  return {
    cubicYards: Math.round(totalYards * 10) / 10,
    truckFraction,
    priceRange: { low, high },
    extraCostItems,
  }
}

// --- Kitchen Remodel ---
// Source: niches/kitchen-remodel/brief.md — $12K–$35K avg, ~$20K, 20–35% margin, 4–8 weeks

const KITCHEN_SIZE_MULT: Record<string, number> = { small: 0.7, medium: 1.0, large: 1.4 }
const KITCHEN_SCOPE_MULT: Record<string, number> = { cosmetic: 0.5, standard: 1.0, full: 1.5 }
const KITCHEN_TIER_RANGE: Record<string, Range> = {
  budget: { low: 8000, high: 15000 },
  mid: { low: 12000, high: 25000 },
  premium: { low: 20000, high: 35000 },
}

export interface KitchenBudgetInput {
  size: string
  scope: string
  tier: string
}

export interface KitchenBudgetResult {
  total: Range
  timelineWeeks: number
  permitRequired: boolean
}

export function calcKitchenBudget(input: KitchenBudgetInput): KitchenBudgetResult {
  const base = KITCHEN_TIER_RANGE[input.tier] ?? KITCHEN_TIER_RANGE.mid
  const sizeMult = KITCHEN_SIZE_MULT[input.size] ?? 1.0
  const scopeMult = KITCHEN_SCOPE_MULT[input.scope] ?? 1.0
  const weeks = input.scope === 'cosmetic' ? 2 : input.scope === 'standard' ? 5 : 8
  return {
    total: {
      low: Math.round(base.low * sizeMult * scopeMult),
      high: Math.round(base.high * sizeMult * scopeMult),
    },
    timelineWeeks: weeks,
    permitRequired: input.scope === 'full',
  }
}

// --- Pool Builders ---
// Source: niches/pool-builders/brief.md — $25K–$65K, 15–25% margin
// Types: concrete/gunite (premium), fiberglass (mid), vinyl (budget)

const POOL_TYPE_RANGE: Record<string, Range> = {
  concrete: { low: 35000, high: 65000 },
  fiberglass: { low: 25000, high: 45000 },
  vinyl: { low: 20000, high: 35000 },
}
const POOL_SIZE_MULT: Record<string, number> = { small: 0.75, medium: 1.0, large: 1.35 }

const POOL_FEATURES: Record<string, Range> = {
  screen_enclosure: { low: 5000, high: 12000 },
  decking: { low: 3000, high: 8000 },
  landscaping: { low: 2000, high: 6000 },
  lighting: { low: 1000, high: 3000 },
  heater: { low: 2000, high: 5000 },
  spa: { low: 5000, high: 15000 },
}

const POOL_FEATURE_LABELS: Record<string, string> = {
  screen_enclosure: 'Screen Enclosure',
  decking: 'Pool Decking',
  landscaping: 'Landscaping',
  lighting: 'Lighting',
  heater: 'Pool Heater',
  spa: 'Spa / Hot Tub',
}

export interface PoolCostInput {
  type: string
  size: string
  features: string[]
}

export interface PoolFeatureAdd { label: string; low: number; high: number }

export interface PoolCostResult {
  baseRange: Range
  featureAdds: PoolFeatureAdd[]
  total: Range
  timelineWeeks: number
  permitRequired: boolean
}

export function calcPoolCost(input: PoolCostInput): PoolCostResult {
  const typeRange = POOL_TYPE_RANGE[input.type] ?? POOL_TYPE_RANGE.fiberglass
  const sizeMult = POOL_SIZE_MULT[input.size] ?? 1.0
  const baseRange: Range = {
    low: Math.round(typeRange.low * sizeMult),
    high: Math.round(typeRange.high * sizeMult),
  }

  const featureAdds: PoolFeatureAdd[] = input.features
    .filter((f) => POOL_FEATURES[f])
    .map((f) => ({
      label: POOL_FEATURE_LABELS[f] ?? f,
      low: POOL_FEATURES[f].low,
      high: POOL_FEATURES[f].high,
    }))

  const featureLow = featureAdds.reduce((s, f) => s + f.low, 0)
  const featureHigh = featureAdds.reduce((s, f) => s + f.high, 0)

  const weeks = input.type === 'concrete' ? 12 : input.type === 'fiberglass' ? 6 : 8
  return {
    baseRange,
    featureAdds,
    total: { low: baseRange.low + featureLow, high: baseRange.high + featureHigh },
    timelineWeeks: weeks,
    permitRequired: true,
  }
}

// --- Paver Sealing ---
// Source: niches/paver-sealing/brief.md — $400–$1,200 avg, ~$700, 45–60% margin
// Material $0.30–$1.00/sqft; sealer types: wet-look, matte, penetrating

const PAVER_BASE_PER_SQFT: Range = { low: 0.80, high: 1.60 }
const PAVER_CONDITION_MULT: Record<string, number> = { good: 1.0, fair: 1.15, poor: 1.3 }
const PAVER_FINISH_ADD: Record<string, number> = { wet_look: 0, matte: 0, penetrating: 0.10 }
const PAVER_RESAND_PER_SQFT: Range = { low: 0.25, high: 0.50 }
const PAVER_RESEAL_YEARS: Record<string, number> = { wet_look: 3, matte: 3, penetrating: 5 }
const PAVER_MINIMUM: number = 300

export interface PaverSealingInput {
  areaSqFt: number
  condition: string
  finish: string
  resand?: boolean
}

export interface PaverSealingResult {
  total: Range
  resealIntervalYears: number
}

export function calcPaverSealing(input: PaverSealingInput): PaverSealingResult {
  const condMult = PAVER_CONDITION_MULT[input.condition] ?? 1.0
  const finishAdd = PAVER_FINISH_ADD[input.finish] ?? 0
  const baseLow = input.areaSqFt * (PAVER_BASE_PER_SQFT.low + finishAdd) * condMult
  const baseHigh = input.areaSqFt * (PAVER_BASE_PER_SQFT.high + finishAdd) * condMult

  let low = Math.max(Math.round(baseLow), PAVER_MINIMUM)
  let high = Math.max(Math.round(baseHigh), PAVER_MINIMUM)

  if (input.resand) {
    low += Math.round(input.areaSqFt * PAVER_RESAND_PER_SQFT.low)
    high += Math.round(input.areaSqFt * PAVER_RESAND_PER_SQFT.high)
  }

  return {
    total: { low, high },
    resealIntervalYears: PAVER_RESEAL_YEARS[input.finish] ?? 3,
  }
}

// --- Pressure Washing: Surface Cost ---
// Source: niches/pressure-washing/brief.md — $275–$425 residential, $850–$3,500 commercial

const SURFACE_RATES: Record<string, Range> = {
  driveway: { low: 0.10, high: 0.20 },
  house: { low: 0.15, high: 0.30 },
  deck: { low: 0.20, high: 0.40 },
  patio: { low: 0.10, high: 0.20 },
  fence: { low: 0.15, high: 0.30 },
  roof: { low: 0.25, high: 0.50 },
}

const SURFACE_MINIMUMS: Record<string, number> = {
  driveway: 100,
  house: 150,
  deck: 100,
  patio: 75,
  fence: 100,
  roof: 200,
}

const SURFACE_FREQUENCY: Record<string, number> = {
  driveway: 12,
  house: 18,
  deck: 12,
  patio: 12,
  fence: 18,
  roof: 24,
}

export interface SurfaceItem { type: string; sqFt: number }

export interface SurfaceCostInput {
  surfaces: SurfaceItem[]
}

export interface SurfaceCostResult {
  perSurface: Array<{ label: string; low: number; high: number }>
  total: Range
  frequencyMonths: number
}

export function calcSurfaceCost(input: SurfaceCostInput): SurfaceCostResult {
  if (input.surfaces.length === 0) {
    return { perSurface: [], total: { low: 0, high: 0 }, frequencyMonths: 12 }
  }

  const perSurface = input.surfaces.map((s) => {
    const rate = SURFACE_RATES[s.type] ?? { low: 0.15, high: 0.30 }
    const min = SURFACE_MINIMUMS[s.type] ?? 75
    return {
      label: s.type,
      low: Math.max(Math.round(s.sqFt * rate.low), min),
      high: Math.max(Math.round(s.sqFt * rate.high), min),
    }
  })

  const total: Range = {
    low: perSurface.reduce((s, p) => s + p.low, 0),
    high: perSurface.reduce((s, p) => s + p.high, 0),
  }

  // Shortest recommended frequency among selected surfaces
  const frequencies = input.surfaces.map((s) => SURFACE_FREQUENCY[s.type] ?? 12)
  const frequencyMonths = Math.min(...frequencies)

  return { perSurface, total, frequencyMonths }
}
