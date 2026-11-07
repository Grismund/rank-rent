/**
 * Extract organic domains from SERP API response items.
 *
 * @param {Array|null} items - items array from task.result[0].items
 * @param {number} maxCount - max domains to return
 * @returns {string[]}
 */
export function extractOrganicDomains(items, maxCount) {
  if (!Array.isArray(items)) return []
  const domains = []
  for (const item of items) {
    if (item.type === 'organic' && item.domain && domains.length < maxCount) {
      domains.push(item.domain)
    }
  }
  return domains
}

/**
 * Extract full organic result objects from SERP API response items.
 * Returns richer data than extractOrganicDomains for Phase 3+ use.
 *
 * @param {Array|null} items - items array from task.result[0].items
 * @param {number} maxCount - max results to return
 * @returns {Array<{domain: string, url: string, title: string, description: string, position: number}>}
 */
export function extractOrganicResults(items, maxCount) {
  if (!Array.isArray(items)) return []
  const results = []
  for (const item of items) {
    if (item.type === 'organic' && item.domain && results.length < maxCount) {
      results.push({
        domain: item.domain,
        url: item.url || '',
        title: item.title || '',
        description: item.description || '',
        position: item.rank_absolute || 0,
      })
    }
  }
  return results
}

/**
 * Extract maps results from SERP API response items.
 * Accepts maps_search, maps_paid, and any item with title + rating fields.
 * Now also captures domain, phone, address, and category for Phase 3 renter identification.
 *
 * @param {Array|null} items - items array from task.result[0].items
 * @param {number} itemsCount - items_count from the result (total businesses)
 * @returns {{ topThree: Array<{name: string, reviews: number, rating: number, domain: string, phone: string, address: string, category: string}>, totalCount: number }}
 */
export function extractMapsResults(items, itemsCount) {
  if (!Array.isArray(items)) return { topThree: [], totalCount: 0 }

  const MAPS_TYPES = new Set(['maps_search', 'maps_paid'])
  const mapItems = items.filter((it) =>
    MAPS_TYPES.has(it.type) || (it.title && it.rating !== undefined)
  )

  const topThree = mapItems.slice(0, 3).map((m) => ({
    name: m.title || '',
    reviews: m.rating?.reviews_count || 0,
    rating: m.rating?.value || 0,
    domain: m.domain || '',
    phone: m.phone || '',
    address: m.address || '',
    category: m.category || '',
  }))

  const totalCount = itemsCount || mapItems.length
  return { topThree, totalCount }
}
