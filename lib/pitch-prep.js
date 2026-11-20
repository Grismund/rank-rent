/**
 * Buyer-to-site matching and pitch material generation for rr-pitch-prep.
 * Pure functions — no I/O, no API calls.
 */

export const MATCH_CSV_COLUMNS = [
  'site_slug',
  'site_niche',
  'site_area',
  'site_domain',
  'buyer_name',
  'buyer_phone',
  'buyer_email',
  'buyer_owner',
  'buyer_city',
  'pitch_priority',
  'fit_score',
  'website_weakness',
  'notes',
]

/**
 * Normalize a candidate slug for matching.
 * Strips dots from abbreviations (e.g. "port-st.-lucie" → "port-st-lucie").
 * @param {string} slug
 * @returns {string}
 */
export function normalizeSlug(slug) {
  return slug.replace(/\./g, '')
}

/**
 * Match a buyer to a site by candidate_slug → site slug.
 * @param {object} buyer - Row from buyers.csv
 * @param {object} site - Row from sites.csv
 * @param {object} siteConfig - Parsed site.yaml
 * @returns {{ matched: boolean, fitScore: number, reasons: string[] }}
 */
export function matchBuyerToSite(buyer, site, siteConfig) {
  const buyerSlug = normalizeSlug(buyer.candidate_slug || '')
  const siteSlug = normalizeSlug(site.slug || '')

  if (!buyerSlug || !siteSlug || buyerSlug !== siteSlug) {
    return { matched: false, fitScore: 0, reasons: [] }
  }

  const reasons = []
  let fitScore = 0

  // Priority scoring
  const priority = buyer.pitch_priority || 'cold'
  if (priority === 'hot') { fitScore += 3; reasons.push('hot priority') }
  else if (priority === 'warm') { fitScore += 2; reasons.push('warm priority') }
  else { fitScore += 1; reasons.push('cold priority') }

  // Contact completeness bonus
  if (buyer.email) { fitScore += 1; reasons.push('has email') }
  if (buyer.phone) { fitScore += 1; reasons.push('has phone') }
  if (buyer.owner_name) { fitScore += 1; reasons.push('has owner name') }

  return { matched: true, fitScore, reasons }
}

/**
 * Match all buyers against all sites.
 * Each buyer maps to at most one site (the one matching its candidate_slug).
 * @param {object[]} buyers
 * @param {object[]} sites
 * @param {Object<string, object>} siteConfigs - slug → parsed site.yaml
 * @returns {{ buyer: object, site: object, fitScore: number }[]}
 */
export function matchAllBuyers(buyers, sites, siteConfigs) {
  const siteBySlug = new Map()
  for (const site of sites) {
    siteBySlug.set(normalizeSlug(site.slug), site)
  }

  const matches = []
  for (const buyer of buyers) {
    const buyerSlug = normalizeSlug(buyer.candidate_slug || '')
    const site = siteBySlug.get(buyerSlug)
    if (!site) continue

    const config = siteConfigs[site.slug] || {}
    const result = matchBuyerToSite(buyer, site, config)
    if (result.matched) {
      matches.push({ buyer, site, fitScore: result.fitScore })
    }
  }
  return matches
}

/**
 * Group matches by site slug, sorted by fitScore descending.
 * @param {{ buyer: object, site: object, fitScore: number }[]} matches
 * @returns {Map<string, Array>}
 */
export function groupMatchesBySite(matches) {
  const groups = new Map()
  for (const m of matches) {
    const slug = m.site.slug
    if (!groups.has(slug)) groups.set(slug, [])
    groups.get(slug).push(m)
  }
  for (const [, list] of groups) {
    list.sort((a, b) => b.fitScore - a.fitScore)
  }
  return groups
}

/**
 * Check which contact fields a buyer has.
 * @param {object} buyer
 * @returns {{ complete: boolean, missing: string[] }}
 */
export function assessContactCompleteness(buyer) {
  const fields = ['email', 'phone', 'owner_name']
  const missing = fields.filter(f => !buyer[f])
  return { complete: missing.length === 0, missing }
}

/**
 * Parse niche-economics.md markdown table into a Map.
 * @param {string} mdText
 * @returns {Map<string, { jobLow: number, jobHigh: number, marginLow: number, marginHigh: number }>}
 */
export function parseNicheEconomics(mdText) {
  const result = new Map()
  const lines = mdText.split('\n')

  for (const line of lines) {
    if (!line.startsWith('|') || line.startsWith('|---') || line.startsWith('| Niche')) continue
    const cells = line.split('|').map(c => c.trim()).filter(c => c)
    if (cells.length < 3) continue

    const niche = cells[0].toLowerCase()
    const jobMatch = cells[1].match(/\$([\d,]+).*?\$([\d,]+)/)
    const marginMatch = cells[2].match(/([\d.]+).*?([\d.]+)%/)

    if (!jobMatch) continue

    result.set(niche, {
      jobLow: parseInt(jobMatch[1].replace(/,/g, ''), 10),
      jobHigh: parseInt(jobMatch[2].replace(/,/g, ''), 10),
      marginLow: marginMatch ? parseFloat(marginMatch[1]) : 0,
      marginHigh: marginMatch ? parseFloat(marginMatch[2]) : 0,
    })
  }
  return result
}

/**
 * Estimate monthly rent from niche economics data.
 * lowRent ≈ avgJobLow × 0.05, highRent ≈ avgJobHigh × 0.10.
 * @param {string} niche - Display niche name (spaces, not hyphens)
 * @param {Map} economicsData - From parseNicheEconomics
 * @returns {{ lowRent: number, highRent: number, basis: string }}
 */
export function projectRentValue(niche, economicsData) {
  const key = niche.replace(/-/g, ' ').toLowerCase()
  const data = economicsData.get(key)
  if (!data) return { lowRent: 0, highRent: 0, basis: 'unknown niche' }

  const lowRent = Math.round(data.jobLow * 0.05)
  const highRent = Math.round(data.jobHigh * 0.10)
  return {
    lowRent,
    highRent,
    basis: `5–10% of avg job value ($${data.jobLow}–$${data.jobHigh})`,
  }
}

/**
 * Build a MATCH_CSV_COLUMNS row from a match object.
 * @param {{ buyer: object, site: object, fitScore: number }} match
 * @param {object} siteConfig - Parsed site.yaml
 * @returns {object}
 */
export function buildMatchRow(match, siteConfig) {
  const { buyer, site, fitScore } = match
  return {
    site_slug: site.slug,
    site_niche: site.niche,
    site_area: site.area,
    site_domain: site.domain || '',
    buyer_name: buyer.business_name,
    buyer_phone: buyer.phone || '',
    buyer_email: buyer.email || '',
    buyer_owner: buyer.owner_name || '',
    buyer_city: buyer.city || '',
    pitch_priority: buyer.pitch_priority || '',
    fit_score: fitScore,
    website_weakness: buyer.website_weakness || '',
    notes: buyer.notes || '',
  }
}

/**
 * Serialize match rows to CSV.
 * @param {object[]} rows
 * @returns {string}
 */
export function writeMatchesCsv(rows) {
  const header = MATCH_CSV_COLUMNS.join(',')
  const lines = rows.map(row =>
    MATCH_CSV_COLUMNS.map(col => {
      const val = row[col] !== undefined ? String(row[col]) : ''
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"'
      }
      return val
    }).join(',')
  )
  return [header, ...lines].join('\n')
}

/**
 * Parse a matches.csv string into row objects.
 * @param {string} csvString
 * @returns {object[]}
 */
export function readMatchesCsv(csvString) {
  const lines = csvString.trim().split('\n')
  if (lines.length <= 1) return []
  const headers = lines[0].split(',')
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        values.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    values.push(current)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = values[i] !== undefined ? values[i] : ''
    })
    return row
  })
}

/**
 * Generate a personalized email template for a buyer.
 * @param {object} buyer
 * @param {object} siteConfig - Parsed site.yaml
 * @param {Map} economics - From parseNicheEconomics
 * @returns {{ subject: string, body: string }}
 */
export function generateEmailTemplate(buyer, siteConfig, economics) {
  const name = buyer.owner_name || buyer.business_name
  const niche = siteConfig.display_name || siteConfig.niche
  const brand = siteConfig.brand || ''
  const city = siteConfig.city || ''
  const nicheKey = (siteConfig.niche || '').replace(/-/g, ' ').toLowerCase()
  const rent = economics.has(nicheKey) ? projectRentValue(nicheKey, economics) : null

  const subject = `${niche} leads in ${city} — exclusive opportunity`

  let body = `Hi ${name},\n\n`
  body += `I run ${brand}, a ${niche.toLowerCase()} website that ranks on Google for ${city} and surrounding areas.\n\n`
  body += `I'm looking for one qualified contractor to send all the leads to — exclusively.\n\n`
  if (rent && rent.highRent > 0) {
    body += `Based on typical ${niche.toLowerCase()} job values, I estimate this could generate $${rent.lowRent}–$${rent.highRent}/month in lead value for your business (estimate based on average job values in this market).\n\n`
  }
  body += `Would you be open to a quick call to discuss?\n\n`
  body += `Best,\n[Your Name]`

  return { subject, body }
}

/**
 * Generate a phone call script for pitching a buyer.
 * @param {object} buyer
 * @param {object} siteConfig - Parsed site.yaml
 * @param {Map} economics
 * @returns {string}
 */
export function generatePhoneScript(buyer, siteConfig, economics) {
  const name = buyer.owner_name || buyer.business_name
  const niche = siteConfig.display_name || siteConfig.niche
  const brand = siteConfig.brand || ''
  const city = siteConfig.city || ''
  const weakness = buyer.website_weakness || ''

  let script = `OPENING:\n`
  script += `"Hi, is this ${name}? My name is [Your Name]. I have a quick question about your ${niche.toLowerCase()} business in ${city}."\n\n`

  script += `VALUE PROP:\n`
  script += `"I run ${brand}, a website that shows up on Google when people in ${city} search for ${niche.toLowerCase()} services. `

  if (weakness === 'no_website') {
    script += `I noticed you don't have a website right now — this could be a way to get online leads without building one yourself.`
  } else if (weakness === 'social_only') {
    script += `I noticed your online presence is mainly on social media — this website could bring you leads directly from Google searches.`
  } else if (weakness === 'directory_only') {
    script += `I noticed your main online presence is through directory listings — this website could bring you direct leads from Google.`
  } else {
    script += `I'm looking for one contractor to send all the leads to exclusively.`
  }
  script += `"\n\n`

  script += `ASK:\n`
  script += `"Would you be interested in getting exclusive leads from this site? I can walk you through how it works."\n`

  return script
}

/**
 * Format a pitch summary for one site.
 * @param {object} opts
 * @returns {string}
 */
export function formatSitePitchSummary({ site, matches, economics, siteConfig }) {
  const nicheKey = (site.niche || '').replace(/-/g, ' ').toLowerCase()
  const rent = economics.has(nicheKey) ? projectRentValue(nicheKey, economics) : null
  const hot = matches.filter(m => m.buyer.pitch_priority === 'hot').length
  const warm = matches.filter(m => m.buyer.pitch_priority === 'warm').length
  const cold = matches.length - hot - warm

  let out = `--- ${site.slug} (${site.area}) ---\n`
  out += `  Matches: ${matches.length} (${hot} hot, ${warm} warm, ${cold} cold)\n`
  if (rent && rent.highRent > 0) {
    out += `  Projected rent: $${rent.lowRent}–$${rent.highRent}/mo\n`
  } else {
    out += `  Projected rent: $0 (no economics data)\n`
  }
  return out
}

/**
 * Format an overall pitch prep summary.
 * @param {object} opts
 * @returns {string}
 */
export function formatPitchPrepSummary({ allMatches, siteCount }) {
  const hot = allMatches.filter(m => m.buyer.pitch_priority === 'hot').length
  const warm = allMatches.filter(m => m.buyer.pitch_priority === 'warm').length
  const cold = allMatches.length - hot - warm

  let out = `\n=== Pitch Prep Summary ===\n`
  out += `${siteCount} site${siteCount === 1 ? '' : 's'}, ${allMatches.length} match${allMatches.length === 1 ? '' : 'es'}\n`
  out += `  Hot: ${hot} | Warm: ${warm} | Cold: ${cold}\n`
  return out
}
