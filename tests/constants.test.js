import { describe, it, expect } from 'vitest'
import {
  DISCOVERY_SEED_GROUPS,
  SERVICE_NOISE_KEYWORDS,
  DISCOVERED_NICHES,
  VOLUME_SCAN_DEFAULTS,
} from '../lib/constants.js'

describe('DISCOVERY_SEED_GROUPS', () => {
  it('has 5 seed groups', () => {
    expect(DISCOVERY_SEED_GROUPS).toHaveLength(5)
  })

  it('each group is a non-empty array of strings', () => {
    for (const group of DISCOVERY_SEED_GROUPS) {
      expect(Array.isArray(group)).toBe(true)
      expect(group.length).toBeGreaterThan(0)
      for (const seed of group) {
        expect(typeof seed).toBe('string')
        expect(seed.length).toBeGreaterThan(0)
      }
    }
  })

  it('group 1 contains removal-related seeds', () => {
    const group = DISCOVERY_SEED_GROUPS[0]
    expect(group).toContain('removal')
    expect(group).toContain('demolition')
    expect(group).toContain('hauling')
    expect(group).toContain('disposal')
  })

  it('group 2 contains installation-related seeds', () => {
    const group = DISCOVERY_SEED_GROUPS[1]
    expect(group).toContain('installation')
    expect(group).toContain('replacement')
    expect(group).toContain('building')
    expect(group).toContain('construction')
  })

  it('group 3 contains repair-related seeds', () => {
    const group = DISCOVERY_SEED_GROUPS[2]
    expect(group).toContain('repair')
    expect(group).toContain('restoration')
    expect(group).toContain('refinishing')
    expect(group).toContain('resurfacing')
  })

  it('group 4 contains cleaning-related seeds', () => {
    const group = DISCOVERY_SEED_GROUPS[3]
    expect(group).toContain('cleaning')
    expect(group).toContain('washing')
    expect(group).toContain('sealing')
    expect(group).toContain('coating')
    expect(group).toContain('staining')
  })

  it('group 5 contains grinding-related seeds', () => {
    const group = DISCOVERY_SEED_GROUPS[4]
    expect(group).toContain('grinding')
    expect(group).toContain('polishing')
    expect(group).toContain('leveling')
    expect(group).toContain('grading')
    expect(group).toContain('mulching')
  })
})

describe('SERVICE_NOISE_KEYWORDS', () => {
  it('is a non-empty array of lowercase strings', () => {
    expect(Array.isArray(SERVICE_NOISE_KEYWORDS)).toBe(true)
    expect(SERVICE_NOISE_KEYWORDS.length).toBeGreaterThan(0)
    for (const term of SERVICE_NOISE_KEYWORDS) {
      expect(typeof term).toBe('string')
      expect(term).toBe(term.toLowerCase())
    }
  })

  it('excludes medical terms', () => {
    expect(SERVICE_NOISE_KEYWORDS).toContain('tattoo removal')
    expect(SERVICE_NOISE_KEYWORDS).toContain('hair removal')
    expect(SERVICE_NOISE_KEYWORDS).toContain('mole removal')
  })

  it('excludes software terms', () => {
    expect(SERVICE_NOISE_KEYWORDS).toContain('malware removal')
  })

  it('excludes cosmetic terms', () => {
    expect(SERVICE_NOISE_KEYWORDS).toContain('laser removal')
  })
})

describe('DISCOVERED_NICHES', () => {
  it('has exactly 20 entries', () => {
    expect(DISCOVERED_NICHES).toHaveLength(20)
  })

  it('each entry has niche (string), nat_vol (number > 0), avg_cpc (number > 0)', () => {
    for (const entry of DISCOVERED_NICHES) {
      expect(typeof entry.niche).toBe('string')
      expect(entry.niche.length).toBeGreaterThan(0)
      expect(typeof entry.nat_vol).toBe('number')
      expect(entry.nat_vol).toBeGreaterThan(0)
      expect(typeof entry.avg_cpc).toBe('number')
      expect(entry.avg_cpc).toBeGreaterThan(0)
    }
  })

  it('all niche names are unique', () => {
    const names = DISCOVERED_NICHES.map((e) => e.niche)
    expect(new Set(names).size).toBe(names.length)
  })

  it('contains known high-value niches', () => {
    const names = DISCOVERED_NICHES.map((e) => e.niche)
    expect(names).toContain('foundation repair')
    expect(names).toContain('air duct cleaning')
    expect(names).toContain('junk removal')
    expect(names).toContain('dryer vent cleaning')
    expect(names).toContain('tree service')
    expect(names).toContain('pressure washing')
  })
})

describe('VOLUME_SCAN_DEFAULTS', () => {
  it('exists and has all expected keys', () => {
    expect(VOLUME_SCAN_DEFAULTS).toBeDefined()
    expect(VOLUME_SCAN_DEFAULTS).toHaveProperty('nationalVolumeFloor')
    expect(VOLUME_SCAN_DEFAULTS).toHaveProperty('nationalCpcFloor')
    expect(VOLUME_SCAN_DEFAULTS).toHaveProperty('localVolumeFloor')
    expect(VOLUME_SCAN_DEFAULTS).toHaveProperty('localCpcFloor')
  })

  it('all values are positive numbers', () => {
    for (const [key, val] of Object.entries(VOLUME_SCAN_DEFAULTS)) {
      expect(typeof val).toBe('number')
      expect(val).toBeGreaterThan(0)
    }
  })

  it('has correct default values', () => {
    expect(VOLUME_SCAN_DEFAULTS.nationalVolumeFloor).toBe(1000)
    expect(VOLUME_SCAN_DEFAULTS.nationalCpcFloor).toBe(10)
    expect(VOLUME_SCAN_DEFAULTS.localVolumeFloor).toBe(200)
    expect(VOLUME_SCAN_DEFAULTS.localCpcFloor).toBe(6)
  })
})
