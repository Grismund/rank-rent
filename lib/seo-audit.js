/**
 * SEO audit check functions for rank-rent sites.
 * Pure functions — no I/O, no API calls.
 * Operates on HTML strings (static Astro output) and figure JSON data.
 */

import { detectNearDuplicateContent } from './content-validator.js'

// ══════════════════════════════════════════════════════════════════════
// HTML extraction helpers
// ══════════════════════════════════════════════════════════════════════

/**
 * Extract all href values from <a> tags in HTML.
 * @param {string} html
 * @returns {string[]}
 */
export function extractHrefs(html) {
  const re = /<a\s[^>]*?href=["']([^"']+)["'][^>]*>/gi
  const hrefs = []
  let m
  while ((m = re.exec(html)) !== null) {
    hrefs.push(m[1])
  }
  return hrefs
}

/**
 * Extract and parse JSON-LD blocks from HTML.
 * @param {string} html
 * @returns {object[]}
 */
export function extractJsonLd(html) {
  const re = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  const results = []
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      results.push(JSON.parse(m[1]))
    } catch {
      // skip malformed JSON
    }
  }
  return results
}

/**
 * Strip HTML tags and return visible text. Removes script and style content.
 * @param {string} html
 * @returns {string}
 */
export function extractVisibleText(html) {
  let text = html
  // Remove script and style blocks
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Remove all tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

/**
 * Extract SVG blocks from HTML.
 * @param {string} html
 * @returns {string[]}
 */
export function extractSvgContent(html) {
  const re = /<svg[\s\S]*?<\/svg>/gi
  const svgs = []
  let m
  while ((m = re.exec(html)) !== null) {
    svgs.push(m[0])
  }
  return svgs
}

/**
 * Count <h1> tags in HTML.
 * @param {string} html
 * @returns {number}
 */
export function countH1Tags(html) {
  const matches = html.match(/<h1[\s>]/gi)
  return matches ? matches.length : 0
}

// ══════════════════════════════════════════════════════════════════════
// Per-page HTML checks
// ══════════════════════════════════════════════════════════════════════

/**
 * Check that internal links in HTML resolve to built pages.
 * @param {string[]} hrefs - All href values from the page
 * @param {Set<string>} distPaths - Set of valid paths from the built site
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkHtmlLinks(hrefs, distPaths) {
  const issues = []
  for (const href of hrefs) {
    // Skip external, anchor, mailto, tel, javascript links
    if (href.startsWith('http://') || href.startsWith('https://') ||
        href.startsWith('#') || href.startsWith('mailto:') ||
        href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue
    }
    // Normalize: collapse double slashes, ensure trailing slash
    let normalized = href.replace(/\/\//g, '/')
    normalized = normalized === '/' ? '/' : (normalized.endsWith('/') ? normalized : normalized + '/')
    if (!distPaths.has(normalized)) {
      issues.push(`Broken internal link: ${href}`)
    }
  }
  return { pass: issues.length === 0, issues }
}

/**
 * Check JSON-LD schema: valid types, no LocalBusiness.
 * @param {object[]} jsonLd - Parsed JSON-LD objects
 * @param {string} pageType - Page type from site.yaml
 * @param {string} brand - Site brand name
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkSchemaJsonLd(jsonLd, pageType, brand) {
  const issues = []
  const types = jsonLd.map(j => j['@type'])

  // No LocalBusiness ever
  if (types.includes('LocalBusiness')) {
    issues.push('LocalBusiness schema is forbidden — sites do not represent a single business')
  }

  // Page-type specific checks
  if (pageType === 'faq' && !types.includes('FAQPage')) {
    issues.push('FAQ page missing FAQPage JSON-LD')
  }
  if (pageType === 'tool') {
    if (!types.includes('WebApplication') && !types.includes('SoftwareApplication')) {
      issues.push('Tool page missing WebApplication JSON-LD')
    }
    if (!types.includes('FAQPage')) {
      issues.push('Tool page missing FAQPage JSON-LD')
    }
  }

  return { pass: issues.length === 0, issues }
}

/**
 * Check that the disclosure sentence is present in the HTML.
 * @param {string} html
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkDisclosure(html) {
  // All 4 disclosure variants mention "independent" + "contractor" + "Vantabox LLC"
  const hasIndependent = /independent/i.test(html)
  const hasContractor = /contractor/i.test(html)
  const hasVantabox = /Vantabox\s+LLC/i.test(html)
  if (hasIndependent && hasContractor && hasVantabox) {
    return { pass: true, issues: [] }
  }
  return { pass: false, issues: ['Missing disclosure (requires: independent + contractor + Vantabox LLC)'] }
}

/**
 * Check that the phone number appears in the HTML. Skips when phone is null.
 * @param {string} html
 * @param {string|null} phone
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkPhoneInHtml(html, phone) {
  if (!phone) return { pass: true, issues: [] }
  if (!html.includes(phone)) {
    return { pass: false, issues: [`Phone number "${phone}" not found in HTML`] }
  }
  return { pass: true, issues: [] }
}

/**
 * Check that no href points to a portfolio domain.
 * @param {string[]} hrefs
 * @param {string[]} portfolioDomains
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkNoInterSiteLinks(hrefs, portfolioDomains) {
  const issues = []
  for (const href of hrefs) {
    if (!href.startsWith('http://') && !href.startsWith('https://')) continue
    try {
      const url = new URL(href)
      const hostname = url.hostname.replace(/^www\./, '')
      if (portfolioDomains.some(d => hostname === d || hostname === 'www.' + d)) {
        issues.push(`Inter-site link to portfolio domain: ${hostname}`)
      }
    } catch {
      // skip malformed URLs
    }
  }
  return { pass: issues.length === 0, issues }
}

/**
 * Check that a canonical tag is present.
 * @param {string} html
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkCanonicalTag(html) {
  const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html)
  if (!hasCanonical) {
    return { pass: false, issues: ['Missing canonical tag'] }
  }
  return { pass: true, issues: [] }
}

/**
 * Check that exactly one H1 tag is present.
 * @param {string} html
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkSingleH1(html) {
  const count = countH1Tags(html)
  if (count === 0) {
    return { pass: false, issues: ['No H1 tag found'] }
  }
  if (count > 1) {
    return { pass: false, issues: [`${count} H1 tags found, expected exactly 1`] }
  }
  return { pass: true, issues: [] }
}

// ══════════════════════════════════════════════════════════════════════
// Per-site checks
// ══════════════════════════════════════════════════════════════════════

/**
 * Check that the site has ≥3 figures.
 * @param {string[]} figures - Figure JSON filenames
 * @param {string[]} pageTypes - Page types present in the site
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkFigureMinimum(figures, pageTypes) {
  const issues = []
  if (figures.length < 3) {
    issues.push(`Site has ${figures.length} figure(s), minimum is 3`)
  }
  return { pass: issues.length === 0, issues }
}

/**
 * Check that a figure has non-empty source.label.
 * @param {object} figure - Parsed figure JSON
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkFigureProvenance(figure) {
  if (!figure.source || !figure.source.label) {
    return { pass: false, issues: ['Figure missing source.label (provenance)'] }
  }
  return { pass: true, issues: [] }
}

/**
 * Check that an SVG uses CSS variables for fills, not literal hex colors.
 * Allows none, currentColor, transparent, white (#fff/#ffffff), black (#000/#000000).
 * @param {string} svgText
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkFigurePalette(svgText) {
  const issues = []
  // Find all fill="..." and stroke="..." values
  const fillRe = /(?:fill|stroke)=["']([^"']+)["']/gi
  let m
  while ((m = fillRe.exec(svgText)) !== null) {
    const val = m[1].trim().toLowerCase()
    // Allow CSS vars, none, currentColor, transparent, common names
    if (val.startsWith('var(') || val === 'none' || val === 'currentcolor' ||
        val === 'transparent' || val === 'white' || val === 'black' ||
        val === '#fff' || val === '#ffffff' || val === '#000' || val === '#000000') {
      continue
    }
    // Flag hex colors
    if (/^#[0-9a-f]{3,8}$/i.test(val)) {
      issues.push(`Literal hex fill/stroke "${m[1]}" — use CSS variables instead`)
    }
  }
  return { pass: issues.length === 0, issues }
}

/**
 * Check that a tool produces varying output across its input matrix.
 * @param {Array<{input: object, result: object}>} outputs
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkToolConstancy(outputs) {
  if (outputs.length < 2) {
    return { pass: true, issues: [] }
  }
  const serialized = outputs.map(o => JSON.stringify(o.result))
  const unique = new Set(serialized)
  if (unique.size === 1) {
    return { pass: false, issues: ['Tool produces identical output for all inputs — not a real decision aid'] }
  }
  return { pass: true, issues: [] }
}

/**
 * Check that the brand is set (not null/TBD).
 * @param {string|null} brand
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkBrandSet(brand) {
  if (!brand || brand.toUpperCase() === 'TBD') {
    return { pass: false, issues: ['Brand is not set (null or TBD)'] }
  }
  return { pass: true, issues: [] }
}

/**
 * Check that a tool page is present among the page types.
 * @param {string[]} pageTypes
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkToolPagePresent(pageTypes) {
  if (!pageTypes.includes('tool')) {
    return { pass: false, issues: ['No tool page found — every site must have one interactive tool'] }
  }
  return { pass: true, issues: [] }
}

/**
 * Check that the site has ≥2 guide pages.
 * @param {Array<{type: string}>} pages
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkInformationalPages(pages) {
  const guideCount = pages.filter(p => p.type === 'guide').length
  if (guideCount < 2) {
    return { pass: false, issues: [`Site has ${guideCount} guide page(s), minimum is 2`] }
  }
  return { pass: true, issues: [] }
}

// ══════════════════════════════════════════════════════════════════════
// Portfolio checks
// ══════════════════════════════════════════════════════════════════════

/**
 * Check cross-site similarity using shingle comparison.
 * FAIL >0.75, WARN >0.60.
 * @param {string[]} siteTexts - Visible text extracted from each site's pages
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkCrossSiteSimilarity(siteTexts) {
  const issues = []
  for (let i = 0; i < siteTexts.length; i++) {
    for (let j = i + 1; j < siteTexts.length; j++) {
      const { overlapPercent } = detectNearDuplicateContent(siteTexts[i], siteTexts[j])
      const ratio = overlapPercent / 100
      if (ratio > 0.75) {
        issues.push(`FAIL: Sites ${i} and ${j} have ${overlapPercent}% similarity (threshold: 75%)`)
      } else if (ratio > 0.60) {
        issues.push(`WARN: Sites ${i} and ${j} have ${overlapPercent}% similarity (threshold: 60%)`)
      }
    }
  }
  const hasFail = issues.some(i => i.startsWith('FAIL'))
  return { pass: !hasFail, issues }
}

/**
 * Check that no two sites in the same niche share shell + token set.
 * @param {Array<{slug: string, niche: string, shell: string, tokens: string}>} configs
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkShellTokenUniqueness(configs) {
  const issues = []
  const byNiche = new Map()
  for (const c of configs) {
    if (!byNiche.has(c.niche)) byNiche.set(c.niche, [])
    byNiche.get(c.niche).push(c)
  }
  for (const [niche, sites] of byNiche) {
    const seen = new Map()
    for (const site of sites) {
      const key = `${site.shell}+${site.tokens}`
      if (seen.has(key)) {
        issues.push(`Duplicate shell+token "${key}" in ${niche}: ${seen.get(key)} and ${site.slug}`)
      } else {
        seen.set(key, site.slug)
      }
    }
  }
  return { pass: issues.length === 0, issues }
}

/**
 * Check launch cadence: ≤4 per wave, no same-niche duplicates per wave.
 * @param {Array<{slug: string, niche: string, wave: number}>} sites
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkLaunchCadence(sites) {
  const issues = []
  const byWave = new Map()
  for (const s of sites) {
    if (!byWave.has(s.wave)) byWave.set(s.wave, [])
    byWave.get(s.wave).push(s)
  }
  for (const [wave, waveSites] of byWave) {
    if (waveSites.length > 4) {
      issues.push(`Wave ${wave} has ${waveSites.length} sites (max 4)`)
    }
    const nichesSeen = new Map()
    for (const s of waveSites) {
      if (nichesSeen.has(s.niche)) {
        issues.push(`Wave ${wave} has duplicate niche ${s.niche}: ${nichesSeen.get(s.niche)} and ${s.slug}`)
      } else {
        nichesSeen.set(s.niche, s.slug)
      }
    }
  }
  return { pass: issues.length === 0, issues }
}

/**
 * Check class map overlap between sites. FAIL if overlap ≥20%.
 * @param {Array<{slug: string, classes: Set<string>}>} classmaps
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkClassmapOverlap(classmaps) {
  const issues = []
  for (let i = 0; i < classmaps.length; i++) {
    for (let j = i + 1; j < classmaps.length; j++) {
      const a = classmaps[i].classes
      const b = classmaps[j].classes
      let intersection = 0
      for (const cls of a) {
        if (b.has(cls)) intersection++
      }
      const union = new Set([...a, ...b]).size
      const overlap = union > 0 ? intersection / union : 0
      if (overlap >= 0.20) {
        issues.push(`Class map overlap ${Math.round(overlap * 100)}% between ${classmaps[i].slug} and ${classmaps[j].slug} (threshold: 20%)`)
      }
    }
  }
  return { pass: issues.length === 0, issues }
}

/**
 * Check that no two sites in the same niche have identical figure series.
 * @param {Array<{slug: string, niche: string, series: string}>} figureSeries
 * @returns {{ pass: boolean, issues: string[] }}
 */
export function checkFigureDuplication(figureSeries) {
  const issues = []
  const byNiche = new Map()
  for (const f of figureSeries) {
    if (!byNiche.has(f.niche)) byNiche.set(f.niche, [])
    byNiche.get(f.niche).push(f)
  }
  for (const [niche, figs] of byNiche) {
    const seen = new Map()
    for (const fig of figs) {
      if (seen.has(fig.series)) {
        issues.push(`Identical figure series in ${niche}: ${seen.get(fig.series)} and ${fig.slug}`)
      } else {
        seen.set(fig.series, fig.slug)
      }
    }
  }
  return { pass: issues.length === 0, issues }
}
