/**
 * Look up job economics for a niche from the parsed reference table.
 * @param {string} niche
 * @param {Map} nicheEconomicsTable - Output of parseNicheEconomics()
 * @returns {{ avgJobLow: number, avgJobHigh: number, marginLow: number, marginHigh: number, notes: string } | null}
 */
export function lookupJobEconomics(niche, nicheEconomicsTable) {
  return nicheEconomicsTable.get(niche.toLowerCase()) ?? null
}

/**
 * Flag when local CPC is inflated beyond a multiple of the national average.
 * @param {number} localCpc
 * @param {number} nationalAvgCpc
 * @param {number} threshold - Multiple at which to flag (default 2.5)
 * @returns {boolean}
 */
export function flagInflatedCPC(localCpc, nationalAvgCpc, threshold = 2.5) {
  return localCpc > nationalAvgCpc * threshold
}

/**
 * Compute the number of jobs per month needed to break even on rent.
 * @param {number} rentEstimate - Monthly rent in dollars
 * @param {number} avgJobValue - Average revenue per job
 * @param {number} marginPct - Gross margin as decimal (e.g., 0.50)
 * @returns {number} Jobs per month (rounded up), or Infinity if impossible
 */
export function computeBreakEven(rentEstimate, avgJobValue, marginPct) {
  const netPerJob = avgJobValue * marginPct
  if (netPerJob === 0) return Infinity
  const raw = rentEstimate / netPerJob
  return Math.ceil(raw)
}

/**
 * Assess viability based on break-even jobs vs estimated monthly leads.
 * @param {number} breakEvenJobs
 * @param {number} monthlyLeadsEstimate
 * @returns {'viable' | 'marginal' | 'fail'}
 */
export function assessViability(breakEvenJobs, monthlyLeadsEstimate) {
  if (monthlyLeadsEstimate === 0) return 'fail'
  const ratio = breakEvenJobs / monthlyLeadsEstimate
  if (ratio < 0.25) return 'viable'
  if (ratio < 0.50) return 'marginal'
  return 'fail'
}

/**
 * Count paid ad items in SERP results.
 * @param {Array<{type: string}>} serpItems
 * @returns {number}
 */
export function countPaidAds(serpItems) {
  return serpItems.filter((item) => item.type === 'paid').length
}

const BAIT_SWITCH_PATTERN = /\$(?:49|59|79|85|89|99)\b/i
const BAIT_SWITCH_KEYWORDS = /(?:whole\s*house|air\s*duct|cleaning|duct\s*clean)/i

/**
 * Scan paid ad descriptions for low-ball bait-and-switch price patterns.
 * @param {Array<{title: string, description: string}>} paidItems
 * @returns {Array} Flagged ads
 */
export function detectBaitAndSwitch(paidItems) {
  return paidItems.filter((item) => {
    const text = `${item.title || ''} ${item.description || ''}`
    return BAIT_SWITCH_PATTERN.test(text) && BAIT_SWITCH_KEYWORDS.test(text)
  })
}

/**
 * Assess organic result fragmentation — social profiles vs dedicated sites vs directories.
 * @param {Array<{domain: string}>} organicItems
 * @param {string[]} platformDomains - Social/platform domains to match
 * @param {string[]} directoryDomains - Directory domains to match
 * @returns {{ socialCount: number, dedicatedSiteCount: number, directoryCount: number }}
 */
export function assessOrganicFragmentation(organicItems, platformDomains, directoryDomains) {
  let socialCount = 0
  let dedicatedSiteCount = 0
  let directoryCount = 0

  for (const item of organicItems) {
    const domain = item.domain
    if (matchesDomainList(domain, platformDomains)) {
      socialCount++
    } else if (matchesDomainList(domain, directoryDomains)) {
      directoryCount++
    } else {
      dedicatedSiteCount++
    }
  }

  return { socialCount, dedicatedSiteCount, directoryCount }
}

function matchesDomainList(domain, domainList) {
  return domainList.some(
    (d) => domain === d || domain.endsWith(`.${d}`)
  )
}
