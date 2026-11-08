import { describe, it, expect } from 'vitest'
import { parseCitiesCsv, loadCities } from '../lib/cities.js'

describe('parseCitiesCsv', () => {
  const csv = `city,state,pop_2026,pop_2020,growth_pct
Georgetown,Texas,115088,68725,8.97
Buckeye,Arizona,131812,93422,5.91`

  it('parses rows into typed objects', () => {
    const rows = parseCitiesCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      city: 'Georgetown',
      state: 'Texas',
      pop_2026: 115088,
      pop_2020: 68725,
      growth_pct: 8.97,
    })
  })

  it('coerces numeric columns to numbers', () => {
    const rows = parseCitiesCsv(csv)
    expect(typeof rows[0].pop_2026).toBe('number')
    expect(typeof rows[0].pop_2020).toBe('number')
    expect(typeof rows[0].growth_pct).toBe('number')
  })

  it('returns empty array for empty input', () => {
    expect(parseCitiesCsv('')).toEqual([])
  })

  it('returns empty array for header-only input', () => {
    expect(parseCitiesCsv('city,state,pop_2026,pop_2020,growth_pct')).toEqual([])
  })

  it('trims whitespace from fields', () => {
    const messy = `city,state,pop_2026,pop_2020,growth_pct
 Georgetown , Texas , 115088 , 68725 , 8.97 `
    const rows = parseCitiesCsv(messy)
    expect(rows[0].city).toBe('Georgetown')
    expect(rows[0].state).toBe('Texas')
    expect(rows[0].pop_2026).toBe(115088)
  })
})

describe('loadCities', () => {
  it('loads and parses the real cities.csv file', async () => {
    const cities = await loadCities('data/cities.csv')
    expect(cities.length).toBeGreaterThan(50)
    expect(cities[0]).toHaveProperty('city')
    expect(cities[0]).toHaveProperty('state')
    expect(cities[0]).toHaveProperty('pop_2026')
    expect(cities[0]).toHaveProperty('pop_2020')
    expect(cities[0]).toHaveProperty('growth_pct')
  })

  it('throws for non-existent file', async () => {
    await expect(loadCities('data/nonexistent.csv')).rejects.toThrow()
  })
})
