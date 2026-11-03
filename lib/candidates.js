import { DIRECTORY_DOMAINS, LICENSED_TRADES, CANDIDATES_CSV_COLUMNS } from './constants.js'

const STATE_ABBREVS = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca',
  colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga',
  hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia',
  kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms',
  missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
  'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok',
  oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt',
  virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi',
  wyoming: 'wy',
}

export function generateSlug(niche, town) {
  return `${niche.trim()} ${town.trim()}`
    .toLowerCase()
    .replace(/\s+/g, '-')
}

export function generatePhrases(niche, town, state) {
  const n = niche.toLowerCase()
  const t = town.toLowerCase()
  const s = state.toLowerCase()
  const abbrev = STATE_ABBREVS[s] || s

  const phrases = [
    `${n} ${t}`,
    `${n} ${t} ${abbrev}`,
    `${n} near me`,
    `${n} services ${t}`,
    `best ${n} ${t}`,
    `${t} ${n}`,
    `affordable ${n} ${t}`,
  ]

  if (n.includes(' ')) {
    const words = n.split(' ')
    if (words.length >= 2) {
      phrases.push(`${words[0]} ${words.slice(1).join(' ')} in ${t}`)
    }
  } else {
    phrases.push(`${n} in ${t}`)
  }

  return [...new Set(phrases)].slice(0, 10)
}

export function isDirectoryDomain(domain) {
  return DIRECTORY_DOMAINS.some(
    (dir) => domain === dir || domain.endsWith(`.${dir}`)
  )
}

export function isLicensedTrade(niche) {
  return LICENSED_TRADES.includes(niche.toLowerCase())
}

export function parseCandidatesCsv(csvString) {
  const lines = csvString.trim().split('\n')
  if (lines.length <= 1) return []
  const headers = lines[0].split(',')
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    // Parse CSV fields handling quoted values with commas
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

export function serializeCandidatesCsv(rows) {
  const header = CANDIDATES_CSV_COLUMNS.join(',')
  const lines = rows.map((row) =>
    CANDIDATES_CSV_COLUMNS.map((col) => {
      const val = row[col] !== undefined ? String(row[col]) : ''
      // Quote fields that contain commas, quotes, or newlines
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"'
      }
      return val
    }).join(',')
  )
  return [header, ...lines].join('\n')
}
