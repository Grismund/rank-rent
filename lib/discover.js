import { clusterNiches, filterNewNiches, classifyHomeService } from './candidates.js'

/**
 * Build one DataForSEO keywords_for_keywords request body per seed group.
 * @param {string[][]} seedGroups
 * @returns {object[]}
 */
export function buildSeedRequests(seedGroups) {
  return seedGroups.map(keywords => ({
    keywords,
    location_code: 2840,
    language_code: 'en',
    sort_by: 'search_volume',
    search_partners: false,
  }))
}

/**
 * Extract {keyword, search_volume, cpc} from raw DataForSEO API responses.
 * @param {object[]} apiResults - Array of raw API response objects
 * @returns {{ keyword: string, search_volume: number, cpc: number }[]}
 */
export function processRawResults(apiResults) {
  const results = []
  for (const resp of apiResults) {
    const taskResult = resp.tasks?.[0]?.result
    if (!taskResult) continue
    for (const r of taskResult) {
      results.push({
        keyword: r.keyword,
        search_volume: r.search_volume || 0,
        cpc: r.cpc || 0,
      })
    }
  }
  return results
}

/**
 * Full discovery pipeline: cluster → filter existing → filter by home-service classification.
 * @param {{ keyword: string, search_volume: number, cpc: number }[]} rawKeywords
 * @param {{ niche: string, nat_vol: number, avg_cpc: number }[]} existingNiches
 * @param {{ minVolume?: number, minCpc?: number }} [options]
 * @returns {object[]}
 */
export function discoverNewNiches(rawKeywords, existingNiches, options = {}) {
  const clusters = clusterNiches(rawKeywords, options)
  const newOnly = filterNewNiches(clusters, existingNiches)
  return newOnly.filter(c => classifyHomeService(c.niche))
}

/**
 * Format niches into a readable table string.
 * @param {{ niche: string, total_volume: number, avg_cpc: number }[]} niches
 * @returns {string}
 */
export function formatNicheTable(niches) {
  const header = `${'Niche'.padEnd(35)} ${'Volume'.padStart(10)} ${'Avg CPC'.padStart(10)}`
  const divider = '─'.repeat(57)
  const rows = niches.map(n =>
    `${n.niche.padEnd(35)} ${String(n.total_volume).padStart(10)} ${n.avg_cpc.toFixed(2).padStart(10)}`
  )
  return [header, divider, ...rows].join('\n')
}
