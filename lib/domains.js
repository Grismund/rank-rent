/**
 * Pure functions for domain registration workflow.
 * Used by scripts/domains.mjs and rr-domains skill.
 */

import { brandToDomains } from './brand-check.js'

/**
 * Generate candidate domains from a brand name.
 * Returns .com candidates from brandToDomains plus .net and .co fallbacks
 * for the primary (no-hyphen) variant.
 * @param {string} brand
 * @param {string} slug - site slug (unused currently, reserved for future slug-based fallbacks)
 * @returns {string[]}
 */
export function generateCandidateDomains(brand, slug) {
  const comDomains = brandToDomains(brand)
  const results = [...comDomains]

  // Add .net and .co fallbacks for the primary (first) domain
  const primaryName = comDomains[0].replace('.com', '')
  results.push(`${primaryName}.net`)
  results.push(`${primaryName}.co`)

  // Deduplicate
  return [...new Set(results)]
}

/**
 * Parse Cloudflare domain-check API response into structured array.
 * @param {object} apiResponse - raw Cloudflare response
 * @returns {{ domain: string, available: boolean, price: number|null, reason: string|null }[]}
 */
export function parseDomainCheckResponse(apiResponse) {
  const domains = apiResponse.result?.domains || []
  return domains.map(d => ({
    domain: d.name,
    available: d.registrable === true,
    price: d.pricing?.registration_cost ?? null,
    reason: d.reason || null,
  }))
}

/**
 * Format domain availability results as a markdown table.
 * @param {{ domain: string, available: boolean, price: number|null, reason: string|null }[]} results
 * @returns {string}
 */
export function formatAvailabilityTable(results) {
  const lines = [
    '| Domain | Available | Price |',
    '|--------|-----------|-------|',
  ]
  for (const { domain, available, price, reason } of results) {
    const avail = available ? 'YES' : reason ? `no (${reason})` : 'no'
    const priceStr = price != null ? `$${price}` : '-'
    lines.push(`| ${domain} | ${avail} | ${priceStr} |`)
  }
  return lines.join('\n')
}

/**
 * Format an approval prompt listing selected domains and total cost.
 * @param {{ domain: string, price: number }[]} selected
 * @param {number} totalCost
 * @returns {string}
 */
export function formatApprovalPrompt(selected, totalCost) {
  const lines = [
    '',
    '--- PURCHASE APPROVAL REQUIRED ---',
    '',
    'Domains to register:',
  ]
  for (const { domain, price } of selected) {
    lines.push(`  - ${domain}  ($${price})`)
  }
  lines.push('')
  lines.push(`TOTAL: $${totalCost}`)
  lines.push('')
  lines.push('Type the exact domain name(s) to approve, or "cancel" to abort.')
  return lines.join('\n')
}

/**
 * Build Cloudflare domain registration API body.
 * Always enables auto-renew per guardrails.
 * @param {string} domain
 * @returns {{ name: string, auto_renew: boolean }}
 */
export function buildRegistrationPayload(domain) {
  return {
    name: domain,
    auto_renew: true,
  }
}

/**
 * Calculate renewal date one year from registration.
 * @param {string} registrationDate - ISO date string YYYY-MM-DD
 * @returns {string} ISO date string YYYY-MM-DD
 */
export function calculateRenewalDate(registrationDate) {
  const date = new Date(registrationDate + 'T00:00:00Z')
  date.setUTCFullYear(date.getUTCFullYear() + 1)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
