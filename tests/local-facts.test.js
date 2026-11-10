import { describe, it, expect } from 'vitest'
import { buildCityNicheMatrix, validateFactSheet } from '../lib/local-facts.js'

describe('buildCityNicheMatrix', () => {
  const makePack = (niche, displayName, standardVars, nicheSpecificVars) => ({
    niche,
    display_name: displayName,
    local_variables: {
      standard: standardVars.map(v => ({ var: v, research_question: `Q about ${v}?` })),
      niche_specific: nicheSpecificVars.map(v => ({ var: v, research_question: `Q about ${v}?` })),
    },
  })

  const packsByNiche = new Map([
    ['epoxy-flooring', makePack('epoxy-flooring', 'Epoxy Flooring', ['neighborhoods', 'climate_factors'], ['concrete_condition', 'humidity_impact'])],
    ['paver-sealing', makePack('paver-sealing', 'Paver Sealing', ['neighborhoods', 'climate_factors'], ['soil_type', 'paver_styles'])],
    ['junk-removal', makePack('junk-removal', 'Junk Removal', ['neighborhoods', 'climate_factors'], ['landfill_location', 'recycling_programs'])],
  ])

  it('returns Map keyed by city with state and niches array', () => {
    const candidates = [
      { niche: 'epoxy-flooring', area: 'Miami', region: 'Florida (city-list)', status: 'briefed' },
    ]
    const result = buildCityNicheMatrix(candidates, packsByNiche)
    expect(result).toBeInstanceOf(Map)
    expect(result.has('Miami')).toBe(true)
    const miami = result.get('Miami')
    expect(miami.state).toBe('Florida')
    expect(miami.niches).toHaveLength(1)
    expect(miami.niches[0].slug).toBe('epoxy-flooring')
    expect(miami.niches[0].displayName).toBe('Epoxy Flooring')
  })

  it('deduplicates cities across niches', () => {
    const candidates = [
      { niche: 'epoxy-flooring', area: 'Goodyear', region: 'Arizona (local-discover)', status: 'briefed' },
      { niche: 'paver-sealing', area: 'Goodyear', region: 'Arizona (local-discover)', status: 'briefed' },
      { niche: 'junk-removal', area: 'Goodyear', region: 'Arizona (local-discover)', status: 'briefed' },
    ]
    const result = buildCityNicheMatrix(candidates, packsByNiche)
    expect(result.size).toBe(1)
    const goodyear = result.get('Goodyear')
    expect(goodyear.niches).toHaveLength(3)
    expect(goodyear.niches.map(n => n.slug)).toEqual(['epoxy-flooring', 'paver-sealing', 'junk-removal'])
  })

  it('only includes candidates with status=briefed', () => {
    const candidates = [
      { niche: 'epoxy-flooring', area: 'Miami', region: 'Florida (city-list)', status: 'briefed' },
      { niche: 'paver-sealing', area: 'Orlando', region: 'Florida (city-list)', status: 'walk_away' },
      { niche: 'junk-removal', area: 'Austin', region: 'Texas (local-discover)', status: 'validated' },
    ]
    const result = buildCityNicheMatrix(candidates, packsByNiche)
    expect(result.size).toBe(1)
    expect(result.has('Miami')).toBe(true)
    expect(result.has('Orlando')).toBe(false)
    expect(result.has('Austin')).toBe(false)
  })

  it('each niche entry includes standard and niche-specific variable definitions', () => {
    const candidates = [
      { niche: 'epoxy-flooring', area: 'Miami', region: 'Florida (city-list)', status: 'briefed' },
    ]
    const result = buildCityNicheMatrix(candidates, packsByNiche)
    const niche = result.get('Miami').niches[0]
    expect(niche.standardVars).toEqual([
      { var: 'neighborhoods', research_question: 'Q about neighborhoods?' },
      { var: 'climate_factors', research_question: 'Q about climate_factors?' },
    ])
    expect(niche.nicheSpecificVars).toEqual([
      { var: 'concrete_condition', research_question: 'Q about concrete_condition?' },
      { var: 'humidity_impact', research_question: 'Q about humidity_impact?' },
    ])
  })

  it('returns empty Map for empty input', () => {
    const result = buildCityNicheMatrix([], packsByNiche)
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })
})

describe('validateFactSheet', () => {
  const validSheet = `# Local Facts: Miami, Florida

**Researched:** 2026-11-09
**Niches:** epoxy-flooring
**County:** Miami-Dade County
**Population:** 442,241 (2020) — [Census](https://census.gov)

## City Overview

### Neighborhoods and Districts
- Downtown: Urban core. [Miami Gov](https://miami.gov)
- Brickell: Financial district. [Miami Gov](https://miami.gov)
- Little Havana: Cultural hub. [Miami Gov](https://miami.gov)

### Climate
- Average high of 91°F in summer. [NOAA](https://noaa.gov)
- Hurricane season June-November. [NOAA](https://noaa.gov)

### Nearby Cities
- Hialeah (north)
- Coral Gables (south)
- Miami Beach (east)

## Niche: epoxy-flooring

### Permit Requirements
- Building permit required for commercial epoxy work. [Miami Building](https://miami.gov/building)

### Local Regulations
- VOC limits per Miami-Dade regulations. [Miami-Dade](https://miamidade.gov)

### Concrete Condition
- Slab-on-grade common due to high water table. [UF Extension](https://ufl.edu)

### Humidity Impact
- 75% avg humidity affects curing times. [NOAA](https://noaa.gov)

### Garage Usage
- Multi-use garages common in suburban areas. [Census](https://census.gov)
`

  it('returns valid when all sections present with 5+ sourced facts per niche', () => {
    const result = validateFactSheet(validSheet, ['epoxy-flooring'])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns invalid when a niche section is missing', () => {
    const sheetMissingNiche = validSheet.replace(/## Niche: epoxy-flooring[\s\S]*$/, '')
    const result = validateFactSheet(sheetMissingNiche, ['epoxy-flooring'])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('epoxy-flooring'))).toBe(true)
  })

  it('returns invalid when fact count below minimum', () => {
    const sparseSheet = validSheet.replace(
      /### Concrete Condition\n- Slab-on-grade.*\n\n### Humidity Impact\n- 75% avg.*\n\n### Garage Usage\n- Multi-use garages.*/,
      '### Concrete Condition\n- Slab info. [Source](https://example.com)'
    )
    const result = validateFactSheet(sparseSheet, ['epoxy-flooring'])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('facts') || e.includes('minimum'))).toBe(true)
  })

  it('detects [source needed] markers and includes them in errors', () => {
    const sheetWithMissing = validSheet.replace(
      '- Building permit required for commercial epoxy work. [Miami Building](https://miami.gov/building)',
      '- Building permit required for commercial epoxy work. [source needed]'
    )
    const result = validateFactSheet(sheetWithMissing, ['epoxy-flooring'])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('source needed'))).toBe(true)
  })

  it('returns invalid for facts missing [Source](url) pattern', () => {
    const sheetUnsourced = validSheet.replace(
      '- Building permit required for commercial epoxy work. [Miami Building](https://miami.gov/building)',
      '- Building permit required for commercial epoxy work.'
    )
    const result = validateFactSheet(sheetUnsourced, ['epoxy-flooring'])
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('source') || e.includes('citation'))).toBe(true)
  })
})
