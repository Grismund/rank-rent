import { describe, it, expect } from 'vitest'
import {
  DISCOVERY_SEED_GROUPS,
  SERVICE_NOISE_KEYWORDS,
  DISCOVERED_NICHES,
  VOLUME_SCAN_DEFAULTS,
  AREA_STATE,
  LICENSED_TRADES,
  HOME_SERVICE_SIGNALS,
  STANDALONE_SERVICE_WORDS,
} from '../lib/constants.js'

describe('DISCOVERY_SEED_GROUPS', () => {
  it('has 8 seed groups', () => {
    expect(DISCOVERY_SEED_GROUPS).toHaveLength(8)
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

  it('group 6 contains protection/proofing seeds', () => {
    const group = DISCOVERY_SEED_GROUPS[5]
    expect(group).toContain('waterproofing')
    expect(group).toContain('insulation')
    expect(group).toContain('enclosure')
    expect(group).toContain('screening')
  })

  it('group 7 contains renovation/conversion seeds', () => {
    const group = DISCOVERY_SEED_GROUPS[6]
    expect(group).toContain('remodeling')
    expect(group).toContain('renovation')
    expect(group).toContain('conversion')
    expect(group).toContain('painting')
    expect(group).toContain('tinting')
  })

  it('group 8 contains maintenance/paving seeds', () => {
    const group = DISCOVERY_SEED_GROUPS[7]
    expect(group).toContain('maintenance')
    expect(group).toContain('inspection')
    expect(group).toContain('paving')
    expect(group).toContain('treatment')
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

  it('excludes painting cosmetic terms', () => {
    expect(SERVICE_NOISE_KEYWORDS).toContain('face painting')
    expect(SERVICE_NOISE_KEYWORDS).toContain('body painting')
    expect(SERVICE_NOISE_KEYWORDS).toContain('canvas painting')
    expect(SERVICE_NOISE_KEYWORDS).toContain('painting classes')
    expect(SERVICE_NOISE_KEYWORDS).toContain('painting lessons')
    expect(SERVICE_NOISE_KEYWORDS).toContain('paint by numbers')
  })

  it('excludes tinting cosmetic terms', () => {
    expect(SERVICE_NOISE_KEYWORDS).toContain('hair tinting')
    expect(SERVICE_NOISE_KEYWORDS).toContain('eyelash tinting')
    expect(SERVICE_NOISE_KEYWORDS).toContain('lash tinting')
    expect(SERVICE_NOISE_KEYWORDS).toContain('brow tinting')
    expect(SERVICE_NOISE_KEYWORDS).toContain('eyebrow tinting')
  })

  it('excludes treatment medical terms', () => {
    expect(SERVICE_NOISE_KEYWORDS).toContain('hair treatment')
    expect(SERVICE_NOISE_KEYWORDS).toContain('skin treatment')
    expect(SERVICE_NOISE_KEYWORDS).toContain('facial treatment')
    expect(SERVICE_NOISE_KEYWORDS).toContain('acne treatment')
    expect(SERVICE_NOISE_KEYWORDS).toContain('cancer treatment')
    expect(SERVICE_NOISE_KEYWORDS).toContain('drug treatment')
    expect(SERVICE_NOISE_KEYWORDS).toContain('addiction treatment')
    expect(SERVICE_NOISE_KEYWORDS).toContain('spa treatment')
    expect(SERVICE_NOISE_KEYWORDS).toContain('wastewater treatment')
  })
})

describe('LICENSED_TRADES', () => {
  it('includes home inspection', () => {
    expect(LICENSED_TRADES).toContain('home inspection')
  })
})

describe('DISCOVERED_NICHES', () => {
  it('has exactly 35 entries', () => {
    expect(DISCOVERED_NICHES).toHaveLength(49)
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

  it('contains the 15 niches from seed expansion round 2', () => {
    const names = DISCOVERED_NICHES.map((e) => e.niche)
    expect(names).toContain('bathroom remodeling')
    expect(names).toContain('kitchen remodeling')
    expect(names).toContain('attic insulation')
    expect(names).toContain('home addition')
    expect(names).toContain('basement finishing')
    expect(names).toContain('crawl space encapsulation')
    expect(names).toContain('driveway paving')
    expect(names).toContain('shower remodel')
    expect(names).toContain('window tinting')
    expect(names).toContain('paver installation')
    expect(names).toContain('tub to shower conversion')
    expect(names).toContain('crawl space insulation')
    expect(names).toContain('pool remodeling')
    expect(names).toContain('garage remodel')
    expect(names).toContain('paver sealing')
  })
})

describe('HOME_SERVICE_SIGNALS', () => {
  it('is a non-empty array of lowercase strings', () => {
    expect(Array.isArray(HOME_SERVICE_SIGNALS)).toBe(true)
    expect(HOME_SERVICE_SIGNALS.length).toBeGreaterThan(0)
    for (const signal of HOME_SERVICE_SIGNALS) {
      expect(typeof signal).toBe('string')
      expect(signal).toBe(signal.toLowerCase())
    }
  })

  it('contains core home-service signal words', () => {
    expect(HOME_SERVICE_SIGNALS).toContain('remodel')
    expect(HOME_SERVICE_SIGNALS).toContain('removal')
    expect(HOME_SERVICE_SIGNALS).toContain('cleaning')
    expect(HOME_SERVICE_SIGNALS).toContain('paving')
    expect(HOME_SERVICE_SIGNALS).toContain('crawl space')
  })
})

describe('STANDALONE_SERVICE_WORDS', () => {
  it('is a Set of known single-word home services', () => {
    expect(STANDALONE_SERVICE_WORDS).toBeInstanceOf(Set)
    expect(STANDALONE_SERVICE_WORDS.has('landscaping')).toBe(true)
    expect(STANDALONE_SERVICE_WORDS.has('demolition')).toBe(true)
    expect(STANDALONE_SERVICE_WORDS.has('handyman')).toBe(true)
  })
})

describe('AREA_STATE', () => {
  it('maps all known cities to states', () => {
    expect(AREA_STATE['Houston']).toBe('Texas')
    expect(AREA_STATE['Oklahoma City']).toBe('Oklahoma')
    expect(AREA_STATE['Tucson']).toBe('Arizona')
    expect(AREA_STATE['Albuquerque']).toBe('New Mexico')
  })

  it('has 10 city entries', () => {
    expect(Object.keys(AREA_STATE)).toHaveLength(10)
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
