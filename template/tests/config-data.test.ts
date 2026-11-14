import { describe, it, expect } from 'vitest'
import { SECTION_ORDERS } from '../src/config/section-orders'
import { COPY_BANKS } from '../src/config/copy-banks'
import { CLASSMAP_VOCAB } from '../src/config/classmap-vocab'

describe('SECTION_ORDERS', () => {
  const pageTypes = ['home', 'service', 'town', 'guide', 'cost_guide', 'faq', 'tool']

  it('has all page types', () => {
    for (const pt of pageTypes) {
      expect(SECTION_ORDERS).toHaveProperty(pt)
    }
  })

  it('every page type has O1, O2, O3', () => {
    for (const pt of pageTypes) {
      const orders = SECTION_ORDERS[pt]
      expect(orders).toHaveProperty('O1')
      expect(orders).toHaveProperty('O2')
      expect(orders).toHaveProperty('O3')
    }
  })

  it('home/service/town orders start with "intro" and end with "cta"', () => {
    for (const pt of ['home', 'service', 'town']) {
      for (const key of ['O1', 'O2', 'O3'] as const) {
        const order = SECTION_ORDERS[pt][key]
        expect(order[0]).toBe('intro')
        expect(order[order.length - 1]).toBe('cta')
      }
    }
  })

  it('every order is a non-empty array of strings', () => {
    for (const pt of pageTypes) {
      for (const key of ['O1', 'O2', 'O3'] as const) {
        const order = SECTION_ORDERS[pt][key]
        expect(Array.isArray(order)).toBe(true)
        expect(order.length).toBeGreaterThan(0)
        for (const s of order) {
          expect(typeof s).toBe('string')
        }
      }
    }
  })
})

describe('COPY_BANKS', () => {
  it('every bank key has >= 4 entries', () => {
    for (const [key, entries] of Object.entries(COPY_BANKS)) {
      expect(entries.length, `${key} has < 4 entries`).toBeGreaterThanOrEqual(4)
    }
  })

  it('no duplicate entries within a bank', () => {
    for (const [key, entries] of Object.entries(COPY_BANKS)) {
      const unique = new Set(entries)
      expect(unique.size, `${key} has duplicates`).toBe(entries.length)
    }
  })

  it('has all required bank keys', () => {
    const required = [
      'nav.services',
      'nav.areas',
      'nav.cost',
      'nav.faq',
      'nav.about',
      'cta.primary',
      'cta.secondary',
      'form.heading',
      'footer.disclosure',
      'trust.heading',
      'areas.intro',
    ]
    for (const key of required) {
      expect(COPY_BANKS).toHaveProperty(key)
    }
  })
})

describe('CLASSMAP_VOCAB', () => {
  it('every key has >= 3 candidates', () => {
    for (const [key, candidates] of Object.entries(CLASSMAP_VOCAB)) {
      expect(
        candidates.length,
        `${key} has < 3 candidates`
      ).toBeGreaterThanOrEqual(3)
    }
  })

  it('no candidate appears in more than 2 keys', () => {
    const candidateCounts = new Map<string, string[]>()
    for (const [key, candidates] of Object.entries(CLASSMAP_VOCAB)) {
      for (const c of candidates) {
        if (!candidateCounts.has(c)) candidateCounts.set(c, [])
        candidateCounts.get(c)!.push(key)
      }
    }
    for (const [candidate, keys] of candidateCounts) {
      expect(
        keys.length,
        `"${candidate}" appears in ${keys.length} keys: ${keys.join(', ')}`
      ).toBeLessThanOrEqual(2)
    }
  })

  it('has at least 30 semantic keys', () => {
    expect(Object.keys(CLASSMAP_VOCAB).length).toBeGreaterThanOrEqual(30)
  })
})
