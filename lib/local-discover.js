import { processRawResults } from './discover.js'
import { clusterNiches, classifyHomeService, generateSlug, generatePhrases } from './candidates.js'
import { CANDIDATES_CSV_COLUMNS } from './constants.js'

export const LOCAL_DISCOVER_DEFAULTS = {
  minVolume: 50,
  minCpc: 6,
  batchSize: 20,  // keywords_for_keywords max is 20 per request
  costPerRequest: 0.09,
  maxCost: 1.00,
}

/**
 * Build DataForSEO keywords_for_keywords request bodies with city-level location targeting.
 * Flattens seed groups into chunks of `batchSize` keywords each.
 * @param {string[][]} seedGroups
 * @param {{ city: string, state: string }} cityInfo
 * @param {{ batchSize?: number }} [options]
 * @returns {object[]}
 */
export function buildLocalSeedRequests(seedGroups, cityInfo, options = {}) {
  const batchSize = options.batchSize ?? LOCAL_DISCOVER_DEFAULTS.batchSize
  const allKeywords = seedGroups.flat()
  if (allKeywords.length === 0) return []

  const batches = []
  for (let i = 0; i < allKeywords.length; i += batchSize) {
    batches.push(allKeywords.slice(i, i + batchSize))
  }

  return batches.map(keywords => ({
    keywords,
    location_name: `${cityInfo.city},${cityInfo.state},United States`,
    language_code: 'en',
    sort_by: 'search_volume',
  }))
}

/**
 * Estimate total cost for local discovery across multiple cities.
 * @param {number} cityCount
 * @param {number} batchesPerCity
 * @param {number} [costPerRequest]
 * @returns {number}
 */
export function estimateLocalDiscoveryCost(cityCount, batchesPerCity, costPerRequest = LOCAL_DISCOVER_DEFAULTS.costPerRequest) {
  return cityCount * batchesPerCity * costPerRequest
}

/**
 * Process keywords_for_keywords API results into filtered, city-annotated niche clusters.
 * @param {object[]} apiResults - raw responses from keywords_data/google_ads/keywords_for_keywords/live
 * @param {{ city: string, state: string, pop_2026: number }} cityInfo
 * @param {{ minVolume?: number, minCpc?: number }} [options]
 * @returns {object[]}
 */
export function processLocalResults(apiResults, cityInfo, options = {}) {
  const minVolume = options.minVolume ?? LOCAL_DISCOVER_DEFAULTS.minVolume
  const minCpc = options.minCpc ?? LOCAL_DISCOVER_DEFAULTS.minCpc

  const rawKeywords = processRawResults(apiResults)
  if (rawKeywords.length === 0) return []

  const clusters = clusterNiches(rawKeywords, { minVolume, minCpc })

  return clusters
    .filter(c => classifyHomeService(c.niche))
    .map(c => ({
      ...c,
      city: cityInfo.city,
      state: cityInfo.state,
      population: cityInfo.pop_2026,
    }))
}

/**
 * Convert a local discovery cluster into a candidates.csv row object.
 * @param {{ niche: string, city: string, state: string, population: number, total_volume: number, avg_cpc: number, top_keywords: object[] }} cluster
 * @returns {object}
 */
export function localClusterToCandidate(cluster) {
  const slug = generateSlug(cluster.niche, cluster.city)
  const phrases = generatePhrases(cluster.niche, cluster.city, cluster.state)

  const candidate = {}
  for (const col of CANDIDATES_CSV_COLUMNS) {
    candidate[col] = ''
  }

  candidate.slug = slug
  candidate.niche = cluster.niche
  candidate.area = cluster.city
  candidate.region = `${cluster.state} (local-discover)`
  candidate.primary_phrase = phrases[0] || ''
  candidate.phrases = phrases.join('; ')
  candidate.population = cluster.population
  candidate.vol_total = cluster.total_volume
  candidate.cpc = cluster.avg_cpc
  candidate.status = 'discovered'

  return candidate
}
