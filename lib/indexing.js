/**
 * Pure functions for search engine indexing — GSC, Bing, IndexNow, links.csv.
 */

import { createHash } from 'node:crypto'

export const LINKS_CSV_COLUMNS = [
  'site_slug',
  'target_url',
  'type',
  'status',
  'date',
  'page_linked_to',
  'anchor_text',
  'notes',
]

/**
 * Parse a links.csv string into row objects.
 * @param {string} csvString
 * @returns {object[]}
 */
export function readLinksCsv(csvString) {
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
 * Serialize links rows to CSV.
 * @param {object[]} rows
 * @returns {string}
 */
export function writeLinksCsv(rows) {
  const header = LINKS_CSV_COLUMNS.join(',')
  const lines = rows.map(row =>
    LINKS_CSV_COLUMNS.map(col => {
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
 * Build sitemap URL for a domain.
 * @param {string} domain
 * @returns {string}
 */
export function buildSitemapUrl(domain) {
  return `https://${domain}/sitemap.xml`
}

/**
 * Build IndexNow API payload.
 * @param {string} host
 * @param {string} key
 * @param {string[]} urls
 * @returns {object}
 */
export function buildIndexNowPayload(host, key, urls) {
  return {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls,
  }
}

/**
 * Generate a deterministic 32-char hex IndexNow key from a slug.
 * @param {string} slug
 * @returns {string}
 */
export function generateIndexNowKey(slug) {
  return createHash('md5').update(`indexnow-${slug}`).digest('hex')
}

/**
 * Build all page URLs from site.yaml config, excluding noindex pages.
 * @param {object} config - Parsed site.yaml
 * @param {string} domain
 * @returns {string[]}
 */
export function buildPageUrls(config, domain) {
  return (config.pages || [])
    .filter(p => !p.noindex)
    .map(p => `https://${domain}${p.slug}`)
}

/**
 * Build a DNS TXT record object for Google Search Console verification.
 * @param {string} token - e.g. "google-site-verification=abc123"
 * @returns {{ type: string, content: string }}
 */
export function buildGscVerificationRecord(token) {
  return { type: 'TXT', content: token }
}

/**
 * Build the GSC property URL for a domain.
 * @param {string} domain
 * @returns {string}
 */
export function buildGscPropertyUrl(domain) {
  return `https://${domain}/`
}

/**
 * Format an indexing status report for one site.
 * @param {object} opts
 * @returns {string}
 */
export function formatIndexingReport(opts) {
  const {
    slug, domain, gscAdded, gscVerified, sitemapSubmitted,
    bingAdded, indexNowPinged, urlCount, errors = [],
  } = opts

  let out = `--- ${slug} (${domain}) ---\n`
  out += `  GSC property:   ${gscAdded ? 'added' : 'FAILED'}\n`
  out += `  GSC verified:   ${gscVerified ? 'yes' : 'pending'}\n`
  out += `  Sitemap:        ${sitemapSubmitted ? 'submitted' : 'FAILED'}\n`
  out += `  Bing property:  ${bingAdded ? 'added' : 'FAILED'}\n`
  out += `  IndexNow:       ${indexNowPinged ? `pinged (${urlCount} URLs)` : 'FAILED'}\n`

  if (errors.length > 0) {
    out += `  Errors:\n`
    for (const e of errors) {
      out += `    - ${e}\n`
    }
  }

  return out
}
