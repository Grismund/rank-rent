import { describe, it, expect } from 'vitest'
import { brandToDomains } from '../lib/brand-check.js'

describe('brandToDomains', () => {
  it('converts a simple brand to no-hyphen and hyphenated .com', () => {
    const result = brandToDomains('Fort Myers Floor Coatings')
    expect(result).toContain('fortmyersfloorcoatings.com')
    expect(result).toContain('fort-myers-floor-coatings.com')
  })

  it('returns all lowercase domains', () => {
    const result = brandToDomains('Orlando Epoxy Works')
    for (const d of result) {
      expect(d).toBe(d.toLowerCase())
    }
  })

  it('strips periods from brand names', () => {
    const result = brandToDomains('Miami Garage Floor Co.')
    expect(result).toContain('miamigaragefloorcо.com'.replace('о', 'o'))
    // verify no period in any domain
    for (const d of result) {
      const name = d.replace('.com', '')
      expect(name).not.toContain('.')
    }
  })

  it('strips ampersands from brand names', () => {
    const result = brandToDomains('Lake Conroe Bath & Tile')
    expect(result).toContain('lakeconroebathtile.com')
    expect(result).toContain('lake-conroe-bath-tile.com')
  })

  it('strips apostrophes from brand names', () => {
    const result = brandToDomains("Mike's Roofing")
    expect(result).toContain('mikesroofing.com')
    expect(result).toContain('mikes-roofing.com')
  })

  it('drops filler words when primary exceeds 25 chars', () => {
    // "Montgomery County Exterior Cleaning" → 33 chars without spaces
    // "montgomerycountyexteriorcleaning" = 32 chars > 25
    // Drop "the", "and", "of", "in" — none present, so primary stays long
    // But "West Valley Bathroom Renovations" → 30 chars > 25 — no fillers either
    // Use a brand with a filler: "The Fort Myers Floor Coatings" → 26 chars without spaces + "the"
    const result = brandToDomains('The Fort Myers Floor Coatings Of Texas')
    // Without fillers: "fortmyersfloorcoatingstexas" = 27 chars
    // Should have dropped "the" and "of"
    const primary = result[0]
    expect(primary).not.toContain('the')
    expect(primary).not.toContain('of')
  })

  it('includes both variants when primary is under 25 chars', () => {
    const result = brandToDomains('Estrella Tint')
    expect(result).toHaveLength(2)
    expect(result[0]).toBe('estrellatint.com')
    expect(result[1]).toBe('estrella-tint.com')
  })

  it('produces domains with no special chars except hyphens', () => {
    const result = brandToDomains('Goodyear Bath Remodel Co.')
    for (const d of result) {
      const name = d.replace('.com', '')
      expect(name).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('handles single-word brand', () => {
    const result = brandToDomains('PSL')
    expect(result).toContain('psl.com')
    // single word has no hyphenated variant different from primary
    expect(result).toHaveLength(1)
  })

  it('returns array of strings ending in .com', () => {
    const result = brandToDomains('Conroe Tint Works')
    expect(Array.isArray(result)).toBe(true)
    for (const d of result) {
      expect(d).toMatch(/\.com$/)
    }
  })
})
