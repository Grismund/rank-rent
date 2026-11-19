/**
 * Read/write/update functions for data/sites.csv.
 * Mirrors the pattern in lib/candidates.js for candidates.csv.
 */

export const SITES_CSV_COLUMNS = [
  'slug',
  'niche',
  'area',
  'domain',
  'registrar',
  'renewal_date',
  'tracking_number',
  'forwarding_target',
  'launch_date',
  'first_impression',
  'first_call',
  'monthly_calls',
  'client',
  'price',
  'start_date',
  'payment_status',
  'status',
]

/**
 * Parse a sites.csv string into an array of row objects.
 * Handles quoted fields with commas.
 * @param {string} csvString
 * @returns {object[]}
 */
export function readSitesCsv(csvString) {
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
 * Serialize an array of row objects to CSV string with header.
 * @param {object[]} rows
 * @returns {string}
 */
export function writeSitesCsv(rows) {
  const header = SITES_CSV_COLUMNS.join(',')
  const lines = rows.map(row =>
    SITES_CSV_COLUMNS.map(col => {
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
 * Merge fields into the row matching the given slug.
 * Returns a new array (does not mutate).
 * @param {object[]} rows
 * @param {string} slug
 * @param {object} updates
 * @returns {object[]}
 */
export function updateSiteRow(rows, slug, updates) {
  return rows.map(row => {
    if (row.slug === slug) {
      return { ...row, ...updates }
    }
    return { ...row }
  })
}

/**
 * Create initial sites.csv rows from site slugs and their parsed site.yaml data.
 * All purchase fields start empty. Status defaults to 'audited'.
 * @param {string[]} slugs
 * @param {Object<string, object>} yamls - slug → parsed site.yaml
 * @returns {object[]}
 */
export function initSitesCsv(slugs, yamls) {
  return slugs.map(slug => {
    const yaml = yamls[slug] || {}
    const row = {}
    for (const col of SITES_CSV_COLUMNS) {
      row[col] = ''
    }
    row.slug = slug
    row.niche = yaml.niche || ''
    row.area = yaml.city || ''
    row.status = 'audited'
    return row
  })
}
