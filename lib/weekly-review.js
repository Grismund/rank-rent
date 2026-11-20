/**
 * Pure functions for weekly site performance review.
 * Handles GSC Search Analytics data shaping, Twilio call log parsing,
 * new-page and refresh candidate detection, kill-candidate checks, and formatting.
 */

/**
 * Build a GSC Search Analytics API request body.
 * @param {string} startDate - ISO date
 * @param {string} endDate - ISO date
 * @param {number} [rowLimit=500]
 * @returns {object}
 */
export function buildSearchAnalyticsRequest(startDate, endDate, rowLimit = 500) {
  return {
    startDate,
    endDate,
    dimensions: ['query', 'page'],
    rowLimit,
  }
}

/**
 * Parse GSC Search Analytics response rows into flat objects.
 * @param {object} response - GSC API response
 * @returns {{ query: string, page: string, clicks: number, impressions: number, position: number }[]}
 */
export function parseSearchAnalyticsRows(response) {
  if (!response.rows) return []
  return response.rows.map(row => ({
    query: row.keys[0],
    page: row.keys[1],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    position: row.position || 0,
  }))
}

/**
 * Build 4-week review date ranges: current (last 14 days) and prior (14 days before that).
 * @param {string} referenceDate - ISO date (usually today)
 * @returns {{ currentStart: string, currentEnd: string, priorStart: string, priorEnd: string }}
 */
export function buildReviewDateRanges(referenceDate) {
  const ref = new Date(referenceDate + 'T00:00:00Z')
  const currentEnd = formatIsoDate(ref)
  const currentStart = formatIsoDate(addDays(ref, -14))
  const priorEnd = currentStart
  const priorStart = formatIsoDate(addDays(ref, -28))
  return { currentStart, currentEnd, priorStart, priorEnd }
}

/**
 * Find queries that could benefit from a dedicated page.
 * @param {{ query: string, page: string, impressions: number, position: number }[]} queryData
 * @param {string[]} existingPages - Query strings already targeted by existing pages
 * @param {{ impressionThreshold?: number, positionFloor?: number }} [opts]
 * @returns {{ query: string, impressions: number, position: number }[]}
 */
export function findNewPageCandidates(queryData, existingPages, opts = {}) {
  const threshold = opts.impressionThreshold ?? 20
  const floor = opts.positionFloor ?? 15

  const existing = new Set(existingPages.map(p => p.toLowerCase()))

  return queryData
    .filter(d => d.impressions >= threshold && d.position > floor && !existing.has(d.query.toLowerCase()))
    .map(d => ({ query: d.query, impressions: d.impressions, position: d.position }))
    .sort((a, b) => b.impressions - a.impressions)
}

/**
 * Select the top new-page proposal (highest impressions). One per site per week.
 * @param {{ query: string, impressions: number, position: number }[]} candidates
 * @returns {{ query: string, impressions: number, position: number } | null}
 */
export function selectTopPageProposal(candidates) {
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => b.impressions - a.impressions)[0]
}

/**
 * Find pages whose primary keyword dropped significantly.
 * @param {{ query: string, page: string, position: number }[]} currentData
 * @param {{ query: string, page: string, position: number }[]} priorData
 * @param {string[]} pages - URLs to check (only site's own pages)
 * @param {{ dropThreshold?: number }} [opts]
 * @returns {{ page: string, keyword: string, currentPos: number, priorPos: number, drop: number }[]}
 */
export function findRefreshCandidates(currentData, priorData, pages, opts = {}) {
  const dropThreshold = opts.dropThreshold ?? 5
  const pageSet = new Set(pages)
  const results = []

  for (const curr of currentData) {
    if (!pageSet.has(curr.page)) continue
    const prior = priorData.find(p => p.query === curr.query && p.page === curr.page)
    if (!prior) continue
    const drop = curr.position - prior.position
    if (drop > dropThreshold) {
      results.push({
        page: curr.page,
        keyword: curr.query,
        currentPos: curr.position,
        priorPos: prior.position,
        drop,
      })
    }
  }

  return results
}

/**
 * Check if a site is a kill candidate (no impressions after threshold months).
 * @param {number} totalImpressions
 * @param {string} launchDate - ISO date
 * @param {string} today - ISO date
 * @param {{ monthsThreshold?: number }} [opts]
 * @returns {{ isKillCandidate: boolean, monthsSinceLaunch: number }}
 */
export function checkKillCandidate(totalImpressions, launchDate, today, opts = {}) {
  const threshold = opts.monthsThreshold ?? 6
  const launch = new Date(launchDate + 'T00:00:00Z')
  const now = new Date(today + 'T00:00:00Z')
  const months = (now.getFullYear() - launch.getFullYear()) * 12 + (now.getMonth() - launch.getMonth())
  return {
    isKillCandidate: totalImpressions === 0 && months >= threshold,
    monthsSinceLaunch: months,
  }
}

/**
 * Build Twilio Calls API query params.
 * @param {string} phoneNumber - E.164 format
 * @param {string} startDate - ISO date
 * @param {string} endDate - ISO date
 * @returns {object}
 */
export function buildCallLogParams(phoneNumber, startDate, endDate) {
  return {
    To: phoneNumber,
    'StartTime>': startDate,
    'StartTime<': endDate,
    PageSize: 1000,
  }
}

/**
 * Count inbound completed calls with non-zero duration.
 * @param {object} response - Twilio Calls API response
 * @returns {{ totalCalls: number, completedCalls: number, totalDuration: number }}
 */
export function countCalls(response) {
  const calls = (response.calls || []).filter(
    c => c.direction === 'inbound' && parseInt(c.duration, 10) > 0
  )
  return {
    totalCalls: calls.length,
    completedCalls: calls.filter(c => c.status === 'completed').length,
    totalDuration: calls.reduce((sum, c) => sum + parseInt(c.duration, 10), 0),
  }
}

/**
 * Detect milestone events (first impression, first call, monthly calls update).
 * Returns only fields that changed — caller merges into sites.csv row.
 * @param {object} siteRow - Current sites.csv row
 * @param {number} totalImpressions
 * @param {number} totalCalls
 * @param {string} today - ISO date
 * @returns {object} Fields to update (may be empty)
 */
export function detectMilestones(siteRow, totalImpressions, totalCalls, today) {
  const updates = {}
  if (totalImpressions > 0 && !siteRow.first_impression) {
    updates.first_impression = today
  }
  if (totalCalls > 0 && !siteRow.first_call) {
    updates.first_call = today
  }
  if (totalCalls > 0) {
    updates.monthly_calls = String(totalCalls)
  }
  return updates
}

/**
 * Format a one-screen portfolio summary from all site reviews.
 * @param {{ slug: string, domain: string, totalImpressions: number, totalClicks: number, totalCalls: number }[]} reviews
 * @returns {string}
 */
export function formatWeeklyReviewSummary(reviews) {
  if (reviews.length === 0) return 'No sites to review.'

  const lines = [
    '=== Weekly Portfolio Review ===',
    '',
    '| Site | Domain | Impressions | Clicks | Calls |',
    '|------|--------|-------------|--------|-------|',
  ]
  for (const r of reviews) {
    lines.push(`| ${r.slug} | ${r.domain} | ${r.totalImpressions} | ${r.totalClicks} | ${r.totalCalls} |`)
  }
  const totalImpressions = reviews.reduce((s, r) => s + r.totalImpressions, 0)
  const totalClicks = reviews.reduce((s, r) => s + r.totalClicks, 0)
  const totalCalls = reviews.reduce((s, r) => s + r.totalCalls, 0)
  lines.push('')
  lines.push(`Portfolio totals: ${totalImpressions} impressions, ${totalClicks} clicks, ${totalCalls} calls`)
  return lines.join('\n')
}

/**
 * Format a single-site detail block.
 * @param {object} review
 * @returns {string}
 */
export function formatSiteReviewDetail(review) {
  const lines = [
    `--- ${review.slug} (${review.domain}) ---`,
    `  Impressions: ${review.totalImpressions}`,
    `  Clicks: ${review.totalClicks}`,
    `  Calls: ${review.totalCalls}`,
  ]

  if (review.newPageProposal) {
    lines.push(`  New page proposal: "${review.newPageProposal.query}" (${review.newPageProposal.impressions} imp, pos ${review.newPageProposal.position})`)
  }

  if (review.refreshCandidates && review.refreshCandidates.length > 0) {
    lines.push('  Refresh candidates:')
    for (const r of review.refreshCandidates) {
      lines.push(`    - ${r.page}: "${r.keyword}" dropped ${r.drop} pos (${r.priorPos} → ${r.currentPos})`)
    }
  }

  if (review.killCandidate) {
    if (review.killCandidate.isKillCandidate) {
      lines.push(`  ⚠ KILL CANDIDATE — ${review.killCandidate.monthsSinceLaunch} months, 0 impressions`)
    } else {
      lines.push(`  Age: ${review.killCandidate.monthsSinceLaunch} month(s) since launch`)
    }
  }

  return lines.join('\n')
}

// ── Internal helpers ──────────────────────────────────────────────────

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}
