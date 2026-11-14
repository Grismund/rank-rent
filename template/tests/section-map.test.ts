import { describe, it, expect } from 'vitest'
import { SECTION_KEY_TO_TYPE } from '../src/config/section-map'
import { SECTION_ORDERS } from '../src/config/section-orders'

// Import VARIANT_OPTIONS indirectly — we check that mapped values exist as component types
// The valid component types come from resolve-site.ts VARIANT_OPTIONS keys
const VALID_COMPONENT_TYPES = [
  'ServicesList', 'AreasServed', 'Process', 'TrustBlock', 'FAQ',
  'CostTable', 'CTABand', 'ToolShell', 'Breadcrumbs', 'DataFigure',
]

// Keys documented as prose (no dedicated component — render via ProseSection)
const PROSE_KEYS = [
  'intro', 'benefits', 'demand', 'options', 'local', 'comparison',
  'takeaways', 'methodology', 'related', 'factors',
]

describe('SECTION_KEY_TO_TYPE', () => {
  it('every mapped value corresponds to a known component type', () => {
    for (const [key, type] of Object.entries(SECTION_KEY_TO_TYPE)) {
      expect(
        VALID_COMPONENT_TYPES.includes(type),
        `${key} maps to ${type} which is not a known component type`
      ).toBe(true)
    }
  })

  it('every key in SECTION_ORDERS is either mapped or documented as prose', () => {
    const allKeys = new Set<string>()
    for (const pageType of Object.values(SECTION_ORDERS)) {
      for (const order of Object.values(pageType)) {
        for (const key of order) {
          allKeys.add(key)
        }
      }
    }

    for (const key of allKeys) {
      const isMapped = key in SECTION_KEY_TO_TYPE
      const isProse = PROSE_KEYS.includes(key)
      // cta is a special mapped key
      expect(
        isMapped || isProse,
        `Section key "${key}" is neither mapped in SECTION_KEY_TO_TYPE nor documented as prose`
      ).toBe(true)
    }
  })

  it('has the expected mapped keys', () => {
    expect(SECTION_KEY_TO_TYPE['services']).toBe('ServicesList')
    expect(SECTION_KEY_TO_TYPE['areas']).toBe('AreasServed')
    expect(SECTION_KEY_TO_TYPE['process']).toBe('Process')
    expect(SECTION_KEY_TO_TYPE['trust']).toBe('TrustBlock')
    expect(SECTION_KEY_TO_TYPE['cta']).toBe('CTABand')
    expect(SECTION_KEY_TO_TYPE['questions']).toBe('FAQ')
    expect(SECTION_KEY_TO_TYPE['faq']).toBe('FAQ')
    expect(SECTION_KEY_TO_TYPE['tool']).toBe('ToolShell')
    expect(SECTION_KEY_TO_TYPE['cost']).toBe('CostTable')
    expect(SECTION_KEY_TO_TYPE['prices']).toBe('CostTable')
  })
})
