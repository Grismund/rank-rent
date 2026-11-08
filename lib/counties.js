import { readFileSync } from 'fs'

/**
 * Parse a counties CSV string into typed objects.
 * @param {string} csvString
 * @returns {Array<{ county: string, state: string, pop_2026: number, pop_2020: number, growth_pct: number }>}
 */
export function parseCountiesCsv(csvString) {
  const lines = csvString.trim().split('\n')
  if (lines.length <= 1) return []
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const [county, state, pop_2026, pop_2020, growth_pct] = line.split(',').map(f => f.trim())
    return {
      county,
      state,
      pop_2026: Number(pop_2026),
      pop_2020: Number(pop_2020),
      growth_pct: Number(growth_pct),
    }
  })
}

/**
 * Generate search phrases for a niche + county combination.
 * No state abbreviation variants — "carpet cleaning faulkner county ar" isn't a real search pattern.
 * @param {string} niche
 * @param {string} countyName
 * @returns {string[]}
 */
export function generateCountyPhrases(niche, countyName) {
  const n = niche.toLowerCase()
  const c = countyName.toLowerCase()

  const phrases = [
    `${n} ${c}`,
    `${n} near me`,
    `${n} services ${c}`,
    `best ${n} ${c}`,
    `${c} ${n}`,
    `affordable ${n} ${c}`,
    `${n} in ${c}`,
  ]

  return [...new Set(phrases)]
}

/**
 * Load and parse counties from a CSV file path.
 * @param {string} csvPath
 * @returns {Promise<Array<{ county: string, state: string, pop_2026: number, pop_2020: number, growth_pct: number }>>}
 */
export async function loadCounties(csvPath) {
  const content = readFileSync(csvPath, 'utf8')
  return parseCountiesCsv(content)
}
