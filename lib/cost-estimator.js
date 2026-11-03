// DataForSEO pricing constants (per-task costs)
const COST_KEYWORD_VOLUME = 0.05   // per batch of up to 1000 keywords
const COST_ORGANIC_SERP = 0.003    // per task
const COST_MAPS_SERP = 0.003       // per task
const COST_TRENDS = 0.01           // per task (per unique niche)
const COST_BACKLINK_SUMMARY = 0.02 // per task
const COMPETITORS_PER_CANDIDATE = 4

export function estimateValidationCost(candidates) {
  if (candidates.length === 0) return { total: 0, breakdown: { keywordVolume: 0, organicSerp: 0, mapsSerp: 0, trends: 0 } }

  // Keyword volume: all phrases batched into calls of up to 1000
  const totalPhrases = candidates.reduce((sum, c) => {
    const phrases = c.phrases ? c.phrases.split('|') : []
    return sum + phrases.length
  }, 0)
  const volumeBatches = Math.ceil(totalPhrases / 1000)
  const keywordVolume = volumeBatches * COST_KEYWORD_VOLUME

  // Organic SERP: top 2 phrases per candidate
  const organicSerp = candidates.length * 2 * COST_ORGANIC_SERP

  // Maps SERP: 1 per candidate
  const mapsSerp = candidates.length * COST_MAPS_SERP

  // Trends: 1 per unique niche
  const uniqueNiches = new Set(candidates.map((c) => c.niche)).size
  const trends = uniqueNiches * COST_TRENDS

  const total = keywordVolume + organicSerp + mapsSerp + trends

  return {
    total: Math.round(total * 1000) / 1000,
    breakdown: { keywordVolume, organicSerp, mapsSerp, trends },
  }
}

export function estimateTeardownCost(candidates) {
  return candidates.length * COMPETITORS_PER_CANDIDATE * COST_BACKLINK_SUMMARY
}
