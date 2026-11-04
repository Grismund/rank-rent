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
 * Extract maps results from SERP API response items.
 * Accepts maps_search, maps_paid, and any item with title + rating fields.
 *
 * @param {Array|null} items - items array from task.result[0].items
 * @param {number} itemsCount - items_count from the result (total businesses)
 * @returns {{ topThree: Array<{name: string, reviews: number, rating: number}>, totalCount: number }}
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
  }))

  const totalCount = itemsCount || mapItems.length
  return { topThree, totalCount }
}
