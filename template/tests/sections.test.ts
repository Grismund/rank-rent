import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const sectionsDir = resolve(import.meta.dirname, '../src/components/sections')

const EXPECTED_VARIANTS: Record<string, string[]> = {
  ServicesList: ['cards', 'list', 'tabs'],
  AreasServed: ['chips', 'columns', 'table'],
  Process: ['steps', 'timeline', 'cards'],
  TrustBlock: ['disclosure-first', 'stat-free-facts', 'checklist'],
  FAQ: ['details', 'open-list', 'two-column'],
  CostTable: ['table', 'range-bars', 'cards'],
  CTABand: ['band', 'card', 'inline'],
  ToolShell: ['card', 'full', 'split'],
}

describe('section variant files', () => {
  it('all 24 variant files exist at expected paths', () => {
    for (const [component, variants] of Object.entries(EXPECTED_VARIANTS)) {
      for (const variant of variants) {
        const filePath = resolve(sectionsDir, component, `${variant}.astro`)
        expect(existsSync(filePath), `Missing: ${component}/${variant}.astro`).toBe(true)
      }
    }
  })

  it('TrustBlock variants contain no testimonial/rating markup', () => {
    const forbidden = ['blockquote', 'testimonial', 'rating', '\\bstars?\\b', '\\breview']
    for (const variant of EXPECTED_VARIANTS.TrustBlock) {
      const filePath = resolve(sectionsDir, 'TrustBlock', `${variant}.astro`)
      const content = readFileSync(filePath, 'utf-8').toLowerCase()
      for (const pattern of forbidden) {
        const regex = new RegExp(pattern)
        expect(
          regex.test(content),
          `TrustBlock/${variant}.astro contains forbidden pattern "${pattern}"`
        ).toBe(false)
      }
    }
  })

  it('CTABand variants all contain tel: link pattern', () => {
    for (const variant of EXPECTED_VARIANTS.CTABand) {
      const filePath = resolve(sectionsDir, 'CTABand', `${variant}.astro`)
      const content = readFileSync(filePath, 'utf-8')
      expect(
        content.includes('tel:'),
        `CTABand/${variant}.astro missing tel: link`
      ).toBe(true)
    }
  })

  it('total variant file count is 24', () => {
    let count = 0
    for (const variants of Object.values(EXPECTED_VARIANTS)) {
      count += variants.length
    }
    expect(count).toBe(24)
  })
})
