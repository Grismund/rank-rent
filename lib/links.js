/**
 * Backlink classification, filtering, and merging for rr-links.
 * Pure functions — no I/O, no API calls.
 */

import { PLATFORM_DOMAINS, DIRECTORY_DOMAINS } from './constants.js'

export const LINK_TYPES = ['editorial', 'directory_niche', 'directory_local', 'chamber', 'local_news', 'other']
export const LINK_STATUSES = ['prospect', 'outreach_sent', 'linked', 'rejected']

// Niche-specific directory domains
const NICHE_DIRECTORY_DOMAINS = [
  'homeadvisor.com', 'angi.com', 'thumbtack.com', 'houzz.com',
  'bbb.org', 'porch.com', 'bark.com',
]

// Local directory patterns
const LOCAL_DIRECTORY_PATTERNS = ['directory', 'yellowpages', 'citysearch', 'manta', 'superpages']

// News patterns
const NEWS_PATTERNS = ['news', 'times', 'herald', 'gazette', 'tribune', 'journal', 'observer', 'press', 'post', 'reporter']

/**
 * Build SERP queries for the copycat competitor discovery method.
 * @param {string} niche
 * @param {string} homeCity
 * @param {string[]} otherCities
 * @returns {string[]}
 */
export function buildCompetitorQueries(niche, homeCity, otherCities) {
  return otherCities
    .filter(city => city !== homeCity)
    .map(city => `${niche} ${city}`)
}

/**
 * Extract unique competitor domains from SERP results.
 * Filters out platforms, directories, and portfolio domains.
 * @param {{ url: string, domain: string }[]} organicResults
 * @param {string[]} excludeDomains - Portfolio domains to exclude
 * @returns {string[]}
 */
export function extractCompetitorDomains(organicResults, excludeDomains) {
  const seen = new Set()
  const result = []

  const excluded = new Set([
    ...PLATFORM_DOMAINS,
    ...DIRECTORY_DOMAINS,
    ...excludeDomains,
  ])

  for (const item of organicResults) {
    const domain = item.domain || ''
    if (!domain || seen.has(domain) || excluded.has(domain)) continue
    seen.add(domain)
    result.push(domain)
  }
  return result
}

/**
 * Classify a referring domain into a link type using heuristics.
 * @param {string} referringDomain
 * @returns {string}
 */
export function classifyBacklinkType(referringDomain) {
  const d = referringDomain.toLowerCase()

  if (d.endsWith('.edu') || d.endsWith('.gov')) return 'editorial'
  if (d.includes('chamber')) return 'chamber'
  if (NEWS_PATTERNS.some(p => d.includes(p))) return 'local_news'
  if (NICHE_DIRECTORY_DOMAINS.some(nd => d === nd || d.endsWith(`.${nd}`))) return 'directory_niche'
  if (LOCAL_DIRECTORY_PATTERNS.some(p => d.includes(p))) return 'directory_local'

  return 'other'
}

/**
 * Filter DataForSEO referring_domains items for self-serve prospects.
 * @param {{ target: string, rank: number, backlinks_spam_score: number, broken_backlinks: number, backlinks: number }[]} items
 * @param {{ minRank?: number }} opts
 * @returns {object[]}
 */
export function filterSelfServeProspects(items, opts = {}) {
  const minRank = opts.minRank || 100
  return items.filter(item => {
    if ((item.rank || 0) < minRank) return false
    if ((item.backlinks_spam_score || 0) > 50) return false
    if ((item.broken_backlinks || 0) > 0 && (item.backlinks || 0) <= 0) return false
    return true
  })
}

/**
 * Build a links.csv prospect row.
 * @param {string} siteSlug
 * @param {string} domain - Target URL/domain
 * @param {string} type - Link type
 * @param {string} targetPage - Page to pitch for linking
 * @returns {object}
 */
export function buildProspectRow(siteSlug, domain, type, targetPage) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    site_slug: siteSlug,
    target_url: domain,
    type,
    status: 'prospect',
    date: today,
    page_linked_to: targetPage,
    anchor_text: '',
    notes: '',
  }
}

/**
 * Deduplicate prospect rows by target_url, keeping highest-rank entry.
 * @param {{ target_url: string, rank?: number }[]} prospects
 * @returns {object[]}
 */
export function deduplicateProspects(prospects) {
  const best = new Map()
  for (const p of prospects) {
    const existing = best.get(p.target_url)
    if (!existing || (p.rank || 0) > (existing.rank || 0)) {
      best.set(p.target_url, p)
    }
  }
  return [...best.values()]
}

/**
 * Select the best page to pitch for outreach.
 * Priority: tool > cost_guide > home.
 * @param {{ slug: string, type: string }[]} pages
 * @returns {string}
 */
export function selectOutreachPage(pages) {
  const tool = pages.find(p => p.type === 'tool')
  if (tool) return tool.slug
  const cost = pages.find(p => p.type === 'cost_guide')
  if (cost) return cost.slug
  const home = pages.find(p => p.type === 'home')
  if (home) return home.slug
  return '/'
}

/**
 * Estimate DataForSEO API costs for a links prospecting run.
 * @param {number} serpQueryCount
 * @param {number} competitorCount
 * @returns {{ serpCost: number, backlinkCost: number, totalCost: number }}
 */
export function estimateLinksCost(serpQueryCount, competitorCount) {
  const serpCost = serpQueryCount * 0.0025
  const backlinkCost = competitorCount * 0.02
  return { serpCost, backlinkCost, totalCost: serpCost + backlinkCost }
}

/**
 * Merge new prospects into existing links.csv rows.
 * Never overwrites or regresses an existing row's status.
 * @param {object[]} existingRows
 * @param {object[]} newProspects
 * @returns {object[]}
 */
export function mergeProspects(existingRows, newProspects) {
  const existingUrls = new Set(existingRows.map(r => r.target_url))
  const toAdd = newProspects.filter(p => !existingUrls.has(p.target_url))
  return [...existingRows, ...toAdd]
}

/**
 * Check if a URL belongs to a portfolio domain.
 * @param {string} url
 * @param {string[]} portfolioDomains
 * @returns {boolean}
 */
export function isPortfolioLink(url, portfolioDomains) {
  if (!portfolioDomains.length) return false
  const lower = url.toLowerCase()
  return portfolioDomains.some(d => {
    const dl = d.toLowerCase()
    return lower.includes(dl)
  })
}

/**
 * Format a links prospecting report for one site.
 * @param {object} opts
 * @returns {string}
 */
export function formatLinksReport({ slug, domain, prospectCount, byType, cost }) {
  let out = `--- ${slug} (${domain || 'no domain'}) ---\n`
  out += `  Prospects found: ${prospectCount}\n`
  if (prospectCount > 0 && byType) {
    const types = Object.entries(byType).filter(([, v]) => v > 0)
    if (types.length > 0) {
      out += `  By type: ${types.map(([k, v]) => `${k}: ${v}`).join(', ')}\n`
    }
  }
  out += `  Cost: $${cost.totalCost.toFixed(3)} (SERP: $${cost.serpCost.toFixed(3)}, Backlinks: $${cost.backlinkCost.toFixed(3)})\n`
  return out
}
