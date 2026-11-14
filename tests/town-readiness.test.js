import { describe, it, expect } from 'vitest'
import { checkTownReadiness, summarizeReadiness } from '../lib/town-readiness.js'

// --- Fixtures ---

const FULL_TOWN_MD = `# Local Facts: Seguin, Texas

**Researched:** 2026-11-09
**County:** Guadalupe County

## City Overview

### Neighborhoods and Districts
- Downtown Seguin: Historic courthouse square district with shops and restaurants.
- River Bend: Residential subdivision along the Guadalupe River.

### Nearby Cities
- New Braunfels (16 miles west)
- San Marcos (20 miles north)

## Niche: epoxy-flooring

### Permit Requirements
- The City of Seguin requires permits for construction work. Residential epoxy over existing concrete generally does not require a building permit. [City of Seguin](https://seguintexas.gov)

### Local Regulations
- Texas does not require a specific epoxy certification; no local licensing beyond general contractor registration.

### Concrete Condition
- Seguin sits on expansive Blackland Prairie clay that causes slab movement and cracking.

### Humidity Impact
- Epoxy installs best when concrete moisture is below 75% RH. The humid subtropical climate means summer installs require dehumidification.

### Garage Usage
- Seguin's growing subdivisions feature two- and three-car garages used for vehicle parking and recreation storage.
`

const NO_PERMIT_MD = `# Local Facts: Faketown, Texas

## Niche: epoxy-flooring

### Concrete Condition
- Standard concrete in the area.

### Humidity Impact
- Moderate humidity year-round.

### Garage Usage
- Typical suburban garages.
`

const NO_NEIGHBORHOODS_MD = `# Local Facts: Faketown, Texas

## Niche: bathroom-remodel

### Plumbing Codes
- Faketown follows the 2021 IPC code.

### Typical Home Age
- Median home built in 2005.

### Water Quality
- Hard water at 18 GPG.
`

const MISSING_DISTANCE_MD = `# Local Facts: Faketown, Texas

## Niche: epoxy-flooring

### Permit Requirements
- No permit required for residential epoxy work.

### Local Regulations
- No specific licensing needed.
`

const RICH_TOWN_MD = `# Local Facts: Canyon Lake, Texas

**Researched:** 2026-11-09
**County:** Comal County

## City Overview

### Neighborhoods and Districts
- Hancock Park: Older residential neighborhood near the dam with mature trees.
- Cranes Mill: Lakefront community on the north shore.
- Sattler: Small community at the lake's eastern edge along FM 2673.

### Nearby Cities
- New Braunfels (15 miles southeast)
- San Marcos (20 miles east)

## Niche: epoxy-flooring

### Permit Requirements
- Canyon Lake is unincorporated Comal County; most residential projects only need a septic permit from the county. [Comal County](https://www.co.comal.tx.us)

### Local Regulations
- No HOA restrictions on garage floor coatings in most subdivisions.

### Concrete Condition
- Hill Country limestone base provides stable foundations but homes closer to the lake face higher moisture from the water table.

### Humidity Impact
- Lake-effect humidity means summer concrete moisture can exceed safe levels for epoxy application without dehumidification.

### Garage Usage
- Vacation homes and lake cabins around Canyon Lake store boats, kayaks, and outdoor recreation equipment. Garages double as workshop and storage spaces.
`

// --- Tests ---

describe('checkTownReadiness', () => {
  it('returns ready for a town with all required sections', () => {
    const result = checkTownReadiness(FULL_TOWN_MD, 'epoxy-flooring', 'San Antonio')
    expect(result.ready).toBe(true)
    expect(result.missing).toHaveLength(0)
  })

  it('returns failure when permit info is absent', () => {
    const result = checkTownReadiness(NO_PERMIT_MD, 'epoxy-flooring', 'San Antonio')
    expect(result.ready).toBe(false)
    expect(result.missing.some(m => /permit/i.test(m))).toBe(true)
  })

  it('returns failure when neighborhoods section is missing', () => {
    const result = checkTownReadiness(NO_NEIGHBORHOODS_MD, 'bathroom-remodel', 'San Antonio')
    expect(result.ready).toBe(false)
    expect(result.missing.some(m => /neighborhood/i.test(m))).toBe(true)
  })

  it('returns failure when distance/logistics from hub is missing', () => {
    const result = checkTownReadiness(MISSING_DISTANCE_MD, 'epoxy-flooring', 'San Antonio')
    expect(result.ready).toBe(false)
    expect(result.missing.some(m => /distance|logistic|nearby|neighborhood/i.test(m))).toBe(true)
  })

  it('handles empty string gracefully', () => {
    const result = checkTownReadiness('', 'epoxy-flooring', 'San Antonio')
    expect(result.ready).toBe(false)
    expect(result.missing.length).toBeGreaterThan(0)
  })

  it('handles null/undefined gracefully', () => {
    const result = checkTownReadiness(null, 'epoxy-flooring', 'San Antonio')
    expect(result.ready).toBe(false)
    expect(result.missing.length).toBeGreaterThan(0)
  })

  it('detects rich content with neighborhoods and nearby cities as ready', () => {
    const result = checkTownReadiness(RICH_TOWN_MD, 'epoxy-flooring', 'New Braunfels')
    expect(result.ready).toBe(true)
    expect(result.missing).toHaveLength(0)
  })

  it('checks niche-specific section, not other niches', () => {
    // FULL_TOWN_MD has epoxy-flooring section but not bathroom-remodel
    const result = checkTownReadiness(FULL_TOWN_MD, 'bathroom-remodel', 'San Antonio')
    expect(result.ready).toBe(false)
  })
})

describe('summarizeReadiness', () => {
  it('counts total ready vs total checked', () => {
    const results = [
      { town: 'Seguin', ready: true, missing: [] },
      { town: 'Schertz', ready: true, missing: [] },
      { town: 'Faketown', ready: false, missing: ['permit info'] },
    ]
    const summary = summarizeReadiness(results)
    expect(summary.total).toBe(3)
    expect(summary.readyCount).toBe(2)
    expect(summary.failedCount).toBe(1)
  })

  it('handles empty array', () => {
    const summary = summarizeReadiness([])
    expect(summary.total).toBe(0)
    expect(summary.readyCount).toBe(0)
    expect(summary.failedCount).toBe(0)
  })

  it('handles all ready', () => {
    const results = [
      { town: 'A', ready: true, missing: [] },
      { town: 'B', ready: true, missing: [] },
    ]
    const summary = summarizeReadiness(results)
    expect(summary.total).toBe(2)
    expect(summary.readyCount).toBe(2)
    expect(summary.failedCount).toBe(0)
  })
})
