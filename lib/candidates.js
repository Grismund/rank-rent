import { DIRECTORY_DOMAINS, PLATFORM_DOMAINS, LICENSED_TRADES, CANDIDATES_CSV_COLUMNS, SERVICE_NOISE_KEYWORDS, VOLUME_SCAN_DEFAULTS, HOME_SERVICE_SIGNALS, STANDALONE_SERVICE_WORDS } from './constants.js'

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

export function isPlatformDomain(domain) {
  return PLATFORM_DOMAINS.some(
    (plat) => domain === plat || domain.endsWith(`.${plat}`)
  )
}

export function isNicheCompetitor(domain) {
  return !isDirectoryDomain(domain) && !isPlatformDomain(domain)
}

export function extractCompetitorDomains(validationData, max = 4) {
  const domains = []

  function addDomain(raw) {
    const clean = raw.replace(/^www\./, '')
    if (!domains.includes(clean) && isNicheCompetitor(clean)) {
      domains.push(clean)
    }
  }

  // Primary: extract from serp_items breadcrumbs
  for (const item of (validationData.serp_items || [])) {
    const bc = item.breadcrumb
    if (!bc) continue
    const urlMatch = bc.match(/^https?:\/\/([^\/\s›]+)/)
    if (urlMatch) {
      addDomain(urlMatch[1])
    }
  }

  // Secondary: extract from organic items' breadcrumbs (newer validation format)
  if (domains.length === 0) {
    for (const item of (validationData.organic || [])) {
      const bc = item.breadcrumb
      if (!bc) continue
      const urlMatch = bc.match(/^https?:\/\/([^\/\s›]+)/)
      if (urlMatch) {
        addDomain(urlMatch[1])
      }
    }
  }

  // Fallback: use topDomains from organic array (oldest format)
  if (domains.length === 0) {
    for (const o of (validationData.organic || [])) {
      for (const d of (o.topDomains || [])) {
        addDomain(d)
      }
    }
  }

  return domains.slice(0, max)
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

const STATE_ABBREVS_SET = new Set([
  'al','ak','az','ar','ca','co','ct','de','fl','ga','hi','id','il','in','ia',
  'ks','ky','la','me','md','ma','mi','mn','ms','mo','mt','ne','nv','nh','nj',
  'nm','ny','nc','nd','oh','ok','or','pa','ri','sc','sd','tn','tx','ut','vt',
  'va','wa','wv','wi','wy',
])

const KNOWN_CITIES = [
  'fort worth', 'san antonio', 'el paso', 'oklahoma city',
  'new york', 'los angeles', 'san diego', 'san jose', 'san francisco',
  'las vegas', 'salt lake city', 'kansas city', 'new orleans',
  'st louis', 'st. louis', 'abilene', 'odessa', 'midland', 'houston',
  'dallas', 'austin', 'tucson', 'albuquerque', 'tulsa', 'lubbock',
  'amarillo', 'waco', 'beaumont', 'mcallen', 'laredo', 'brownsville',
  'corpus christi', 'plano', 'arlington', 'frisco', 'mckinney',
]

const COMMERCIAL_SUFFIXES = /\s+(?:services?|compan(?:y|ies)|contractors?|pros?|cost|prices?|rates?|quotes?|estimates?)$/i

export function extractNicheFromKeyword(keyword, city) {
  let kw = keyword.toLowerCase().trim().replace(/\s+/g, ' ')

  // Remove "near me" and "in <location>"
  kw = kw.replace(/\s+near me$/i, '')
  kw = kw.replace(/\s+in \w[\w\s]*$/i, '')

  // Remove explicit city + optional state abbreviation
  if (city) {
    const cityLower = city.toLowerCase()
    const cityIdx = kw.indexOf(cityLower)
    if (cityIdx !== -1) {
      kw = kw.slice(0, cityIdx).trim()
    }
  }

  // Strip trailing state abbreviation
  const words = kw.split(' ')
  if (words.length > 1 && STATE_ABBREVS_SET.has(words[words.length - 1])) {
    words.pop()
    kw = words.join(' ')
  }

  // Strip known city names from the end
  for (const c of KNOWN_CITIES) {
    if (kw.endsWith(` ${c}`)) {
      kw = kw.slice(0, kw.length - c.length - 1).trim()
      break
    }
  }

  // Strip trailing state abbreviation again (city may have been after state)
  const words2 = kw.split(' ')
  if (words2.length > 1 && STATE_ABBREVS_SET.has(words2[words2.length - 1])) {
    words2.pop()
    kw = words2.join(' ')
  }

  // Strip commercial suffixes
  kw = kw.replace(COMMERCIAL_SUFFIXES, '')

  return kw.trim()
}

const NICHE_SYNONYMS = {
  'concrete lifting': 'concrete leveling',
  'mudjacking': 'concrete leveling',
  'mud jacking': 'concrete leveling',
  'slab jacking': 'concrete leveling',
  'slab lifting': 'concrete leveling',
  'foam jacking': 'concrete leveling',
  'power washing': 'pressure washing',
  'powerwashing': 'pressure washing',
  'trash removal': 'junk removal',
  'debris removal': 'junk removal',
  'rubbish removal': 'junk removal',
  'garbage removal': 'junk removal',
  'waste removal': 'junk removal',
  'yard cleanup': 'yard clean up',
  'yard clean-up': 'yard clean up',
  'yard cleanout': 'yard clean up',
}

export function normalizeNiche(niche) {
  const lower = niche.toLowerCase().trim()
  return NICHE_SYNONYMS[lower] || lower
}

export function isServiceKeyword(keyword) {
  const lower = keyword.toLowerCase()
  for (const noise of SERVICE_NOISE_KEYWORDS) {
    if (lower.includes(noise)) return false
  }
  return true
}

export function clusterNiches(keywords, options = {}) {
  const minVolume = options.minVolume ?? VOLUME_SCAN_DEFAULTS.nationalVolumeFloor
  const minCpc = options.minCpc ?? VOLUME_SCAN_DEFAULTS.nationalCpcFloor

  const clusters = new Map()

  for (const kw of keywords) {
    if (!isServiceKeyword(kw.keyword)) continue

    const raw = extractNicheFromKeyword(kw.keyword)
    const niche = normalizeNiche(raw)

    if (isLicensedTrade(niche)) continue

    if (!clusters.has(niche)) {
      clusters.set(niche, { niche, total_volume: 0, cpc_sum: 0, keyword_count: 0, keywords: [] })
    }
    const c = clusters.get(niche)
    c.total_volume += kw.search_volume
    c.cpc_sum += kw.cpc
    c.keyword_count += 1
    c.keywords.push({ keyword: kw.keyword, search_volume: kw.search_volume, cpc: kw.cpc })
  }

  const results = []
  for (const c of clusters.values()) {
    const avg_cpc = c.cpc_sum / c.keyword_count
    if (c.total_volume < minVolume || avg_cpc < minCpc) continue
    const top_keywords = c.keywords
      .sort((a, b) => b.search_volume - a.search_volume)
      .slice(0, 5)
    results.push({
      niche: c.niche,
      total_volume: c.total_volume,
      avg_cpc,
      keyword_count: c.keyword_count,
      top_keywords,
    })
  }

  return results.sort((a, b) => (b.total_volume * b.avg_cpc) - (a.total_volume * a.avg_cpc))
}

export function classifyHomeService(niche) {
  const lower = niche.toLowerCase().trim()
  if (STANDALONE_SERVICE_WORDS.has(lower)) return true
  if (!lower.includes(' ')) return false
  return HOME_SERVICE_SIGNALS.some(signal => lower.includes(signal))
}

export function updateCandidateStatuses(rows, slugStatusPairs) {
  const updates = new Map(slugStatusPairs.map(({ slug, status }) => [slug, status]))
  return rows.map((row) => {
    if (updates.has(row.slug)) {
      return { ...row, status: updates.get(row.slug) }
    }
    return row
  })
}

export function filterNewNiches(clusters, existingNiches) {
  const existingSet = new Set(existingNiches.map(n => n.niche.toLowerCase()))
  return clusters.filter(c => !existingSet.has(c.niche.toLowerCase()))
}
