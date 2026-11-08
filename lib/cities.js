import { readFileSync } from 'fs'

/**
 * Parse a cities CSV string into typed objects.
 * @param {string} csvString
 * @returns {Array<{ city: string, state: string, pop_2026: number, pop_2020: number, growth_pct: number }>}
 */
export function parseCitiesCsv(csvString) {
  const lines = csvString.trim().split('\n')
  if (lines.length <= 1) return []
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const [city, state, pop_2026, pop_2020, growth_pct] = line.split(',').map(f => f.trim())
    return {
      city,
      state,
      pop_2026: Number(pop_2026),
      pop_2020: Number(pop_2020),
      growth_pct: Number(growth_pct),
    }
  })
}

/**
 * Load and parse cities from a CSV file path.
 * @param {string} csvPath
 * @returns {Promise<Array<{ city: string, state: string, pop_2026: number, pop_2020: number, growth_pct: number }>>}
 */
export async function loadCities(csvPath) {
  const content = readFileSync(csvPath, 'utf8')
  return parseCitiesCsv(content)
}
