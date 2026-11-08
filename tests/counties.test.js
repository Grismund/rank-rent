import { describe, it, expect } from 'vitest'
import { parseCountiesCsv, generateCountyPhrases, loadCounties } from '../lib/counties.js'

describe('parseCountiesCsv', () => {
  const csv = `county,state,pop_2026,pop_2020,growth_pct
Faulkner County,Arkansas,135791,123830,9.66
Saline County,Arkansas,134807,123830,8.86`

  it('parses rows into typed objects', () => {
    const rows = parseCountiesCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      county: 'Faulkner County',
      state: 'Arkansas',
      pop_2026: 135791,
      pop_2020: 123830,
      growth_pct: 9.66,
    })
  })

  it('coerces numeric columns to numbers', () => {
    const rows = parseCountiesCsv(csv)
    expect(typeof rows[0].pop_2026).toBe('number')
    expect(typeof rows[0].pop_2020).toBe('number')
    expect(typeof rows[0].growth_pct).toBe('number')
  })

  it('returns empty array for empty input', () => {
    expect(parseCountiesCsv('')).toEqual([])
  })

  it('returns empty array for header-only input', () => {
    expect(parseCountiesCsv('county,state,pop_2026,pop_2020,growth_pct')).toEqual([])
  })

  it('trims whitespace from fields', () => {
    const messy = `county,state,pop_2026,pop_2020,growth_pct
 Faulkner County , Arkansas , 135791 , 123830 , 9.66 `
    const rows = parseCountiesCsv(messy)
    expect(rows[0].county).toBe('Faulkner County')
    expect(rows[0].state).toBe('Arkansas')
    expect(rows[0].pop_2026).toBe(135791)
  })
})

describe('generateCountyPhrases', () => {
  it('returns 7 phrases for a standard niche and county', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    expect(phrases).toHaveLength(7)
  })

  it('includes the primary phrase (niche + county)', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    expect(phrases).toContain('carpet cleaning faulkner county')
  })

  it('includes "near me" variant', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    expect(phrases).toContain('carpet cleaning near me')
  })

  it('includes "services" variant', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    expect(phrases).toContain('carpet cleaning services faulkner county')
  })

  it('includes reversed order variant', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    expect(phrases).toContain('faulkner county carpet cleaning')
  })

  it('includes "best" variant', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    expect(phrases).toContain('best carpet cleaning faulkner county')
  })

  it('includes "affordable" variant', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    expect(phrases).toContain('affordable carpet cleaning faulkner county')
  })

  it('includes "in" variant', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    expect(phrases).toContain('carpet cleaning in faulkner county')
  })

  it('does not include state abbreviation variants', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    const hasStateAbbrev = phrases.some(p => / ar$| ar /.test(p))
    expect(hasStateAbbrev).toBe(false)
  })

  it('all phrases are lowercase', () => {
    const phrases = generateCountyPhrases('Tree Service', 'Cache County')
    phrases.forEach(p => expect(p).toBe(p.toLowerCase()))
  })

  it('deduplicates phrases', () => {
    const phrases = generateCountyPhrases('carpet cleaning', 'Faulkner County')
    const unique = new Set(phrases)
    expect(unique.size).toBe(phrases.length)
  })

  it('handles multi-word counties (e.g. St. Johns County)', () => {
    const phrases = generateCountyPhrases('junk removal', 'St. Johns County')
    expect(phrases).toContain('junk removal st. johns county')
    expect(phrases).toContain('st. johns county junk removal')
  })
})

describe('loadCounties', () => {
  it('loads and parses the real counties.csv file', async () => {
    const counties = await loadCounties('data/counties.csv')
    expect(counties.length).toBeGreaterThan(50)
    expect(counties[0]).toHaveProperty('county')
    expect(counties[0]).toHaveProperty('state')
    expect(counties[0]).toHaveProperty('pop_2026')
    expect(counties[0]).toHaveProperty('pop_2020')
    expect(counties[0]).toHaveProperty('growth_pct')
  })

  it('throws for non-existent file', async () => {
    await expect(loadCounties('data/nonexistent.csv')).rejects.toThrow()
  })
})
