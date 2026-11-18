/**
 * Content pre-audit validators for rank-rent sites.
 * Pure functions — no I/O, no API calls.
 * Checks run against parsed frontmatter, markdown body, and site metadata.
 */

import { validateMetaDescriptionLength } from './content-validator.js'

// ── Helpers ─────────────────────────────────────────────────────────

function normalizeForComparison(text) {
  return text.toLowerCase().replace(/[?!.,;:'"]/g, '').replace(/\s+/g, ' ').trim()
}

function ensureTrailingSlash(href) {
  if (href === '/') return href
  return href.endsWith('/') ? href : href + '/'
}

// ── Check 1: Meta description length + keyword ──────────────────────

/**
 * Validates meta description length (120–160 chars) and keyword presence.
 * @param {object} frontmatter - Page frontmatter with meta_description and primary_keyword
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function validateMetaDescription(frontmatter) {
  const issues = []
  const desc = frontmatter.meta_description

  if (!desc) {
    issues.push({ severity: 'FAIL', message: 'Missing meta_description' })
    return { pass: false, issues }
  }

  const lengthResult = validateMetaDescriptionLength(desc)
  if (!lengthResult.valid) {
    issues.push({ severity: 'FAIL', message: lengthResult.error })
    return { pass: false, issues }
  }

  // Keyword presence check (warn only)
  if (frontmatter.primary_keyword) {
    const kw = frontmatter.primary_keyword.toLowerCase()
    if (!desc.toLowerCase().includes(kw)) {
      issues.push({ severity: 'WARN', message: `Target phrase "${frontmatter.primary_keyword}" not found in meta description` })
    }
  }

  return { pass: true, issues }
}

// ── Check 3: Extract markdown links ─────────────────────────────────

/**
 * Extracts markdown links from body, splitting into internal and external.
 * Ignores anchor (#) and mailto: links.
 * @param {string} body - Markdown body text
 * @returns {{ internal: Array<{text: string, href: string}>, external: Array<{text: string, href: string}> }}
 */
export function extractMarkdownLinks(body) {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g
  const internal = []
  const external = []
  let match

  while ((match = linkRe.exec(body)) !== null) {
    const text = match[1]
    const href = match[2]

    // Skip anchors and mailto
    if (href.startsWith('#') || href.startsWith('mailto:')) continue

    if (href.startsWith('http://') || href.startsWith('https://')) {
      external.push({ text, href })
    } else {
      internal.push({ text, href: ensureTrailingSlash(href) })
    }
  }

  return { internal, external }
}

// ── Check 3+4: Validate internal links and portfolio cross-links ────

/**
 * Validates that all internal links resolve and no external links point to portfolio sites.
 * @param {Array<{text: string, href: string}>} links - Internal links from extractMarkdownLinks
 * @param {Set<string>} sitePageSlugs - Set of valid page slugs for this site
 * @param {string[]} portfolioDomains - Domains of other sites in the portfolio
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function validateInternalLinks(links, sitePageSlugs, portfolioDomains) {
  const issues = []

  // Check internal links resolve
  for (const link of links) {
    if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
      // External link — check against portfolio domains
      const url = new URL(link.href)
      const domain = url.hostname.replace(/^www\./, '')
      if (portfolioDomains.some(d => domain === d || domain === 'www.' + d)) {
        issues.push({ severity: 'FAIL', message: `Cross-portfolio link to "${link.href}" — no inter-site links allowed` })
      }
    } else {
      const normalized = ensureTrailingSlash(link.href)
      if (!sitePageSlugs.has(normalized)) {
        issues.push({ severity: 'FAIL', message: `Broken internal link: "${link.href}" does not resolve to a page` })
      }
    }
  }

  return { pass: issues.length === 0, issues }
}

// ── Check 5: Schema frontmatter ─────────────────────────────────────

/**
 * Validates that pages requiring schema have it in frontmatter.
 * faq → FAQPage required. tool → WebApplication + FAQPage required.
 * @param {object} frontmatter
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function validateSchemaFrontmatter(frontmatter) {
  const issues = []
  const type = frontmatter.type
  const schema = frontmatter.schema
  const schemaList = schema ? (Array.isArray(schema) ? schema : [schema]) : []

  if (type === 'faq') {
    if (!schemaList.includes('FAQPage')) {
      issues.push({ severity: 'FAIL', message: 'FAQ page missing FAQPage schema in frontmatter' })
    }
  } else if (type === 'tool') {
    if (!schemaList.includes('WebApplication')) {
      issues.push({ severity: 'FAIL', message: 'Tool page missing WebApplication schema in frontmatter' })
    }
    if (!schemaList.includes('FAQPage')) {
      issues.push({ severity: 'FAIL', message: 'Tool page missing FAQPage schema in frontmatter' })
    }
  }

  return { pass: issues.length === 0, issues }
}

// ── Check 6: Brand uniqueness (portfolio-level) ─────────────────────

/**
 * Checks that no two sites share a brand name (case-insensitive).
 * Ignores null/undefined/TBD brands.
 * @param {Array<{slug: string, brand: string|null}>} sites
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function checkBrandUniqueness(sites) {
  const issues = []
  const seen = new Map() // lowercase brand → slug

  for (const site of sites) {
    if (!site.brand || site.brand.toUpperCase() === 'TBD') continue
    const key = site.brand.toLowerCase()
    if (seen.has(key)) {
      issues.push({
        severity: 'FAIL',
        message: `Duplicate brand "${site.brand}": ${seen.get(key)} and ${site.slug}`,
      })
    } else {
      seen.set(key, site.slug)
    }
  }

  return { pass: issues.length === 0, issues }
}

// ── Check 7: Title uniqueness (site-level) ──────────────────────────

/**
 * Checks that no two pages within a site share the same title.
 * @param {Array<{file: string, title: string}>} pages
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function checkTitleUniqueness(pages) {
  const issues = []
  const seen = new Map()

  for (const page of pages) {
    if (!page.title) continue
    if (seen.has(page.title)) {
      issues.push({
        severity: 'FAIL',
        message: `Duplicate title "${page.title}": ${seen.get(page.title)} and ${page.file}`,
      })
    } else {
      seen.set(page.title, page.file)
    }
  }

  return { pass: issues.length === 0, issues }
}

// ── Check 8: H1 uniqueness (site-level) ─────────────────────────────

/**
 * Checks that no two pages within a site share the same H1.
 * @param {Array<{file: string, h1: string}>} pages
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function checkH1Uniqueness(pages) {
  const issues = []
  const seen = new Map()

  for (const page of pages) {
    if (!page.h1) continue
    if (seen.has(page.h1)) {
      issues.push({
        severity: 'FAIL',
        message: `Duplicate H1 "${page.h1}": ${seen.get(page.h1)} and ${page.file}`,
      })
    } else {
      seen.set(page.h1, page.file)
    }
  }

  return { pass: issues.length === 0, issues }
}

// ── Check 9: Town page depth ────────────────────────────────────────

const PERMIT_HEADING_RE = /^#{2,3}\s+.*(?:permit|regulation|local\s+consideration|code\s+requirement|what\s+to\s+know)/im

/**
 * Validates town page depth: permits/regulations heading and service cross-links.
 * @param {string} body - Markdown body
 * @param {object} frontmatter - Page frontmatter
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function validateTownPageDepth(body, frontmatter) {
  const issues = []

  // Check for permits/regulations heading
  if (!PERMIT_HEADING_RE.test(body)) {
    issues.push({
      severity: 'FAIL',
      message: 'Town page missing permits/regulations/local-considerations heading',
    })
  }

  // Check for at least one internal service page link
  const serviceLinks = body.match(/\[[^\]]+\]\(\/[^)]+\/\)/g) || []
  if (serviceLinks.length === 0) {
    issues.push({
      severity: 'FAIL',
      message: 'Town page missing internal service page cross-links',
    })
  }

  return { pass: issues.length === 0, issues }
}

// ── Check 10: FAQ consistency ───────────────────────────────────────

/**
 * Validates that faqs[] frontmatter matches H3 questions in the body.
 * Only checks pages with faqs[] defined and non-empty.
 * @param {object} frontmatter
 * @param {string} body
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function validateFaqConsistency(frontmatter, body) {
  const issues = []
  const rawFaqs = frontmatter.faqs

  if (!rawFaqs || rawFaqs.length === 0) {
    return { pass: true, issues }
  }

  // Normalize faqs — may be strings or {question, answer} objects
  const faqs = rawFaqs.map(f => typeof f === 'string' ? f : f.question)

  // Extract H3s from body
  const h3Re = /^### (.+)$/gm
  const bodyH3s = []
  let match
  while ((match = h3Re.exec(body)) !== null) {
    bodyH3s.push(match[1].trim())
  }

  const normalizedFaqs = new Set(faqs.map(normalizeForComparison))
  const normalizedH3s = new Set(bodyH3s.map(normalizeForComparison))

  // H3s not in faqs[]
  for (const h3 of bodyH3s) {
    if (!normalizedFaqs.has(normalizeForComparison(h3))) {
      issues.push({ severity: 'WARN', message: `"${h3}" in body but not in faqs[]` })
    }
  }

  // faqs[] entries not in body
  for (const faq of faqs) {
    if (!normalizedH3s.has(normalizeForComparison(faq))) {
      issues.push({ severity: 'WARN', message: `"${faq}" in faqs but not in body H3s` })
    }
  }

  return { pass: issues.length === 0, issues }
}

// ── Check 11: Phone placeholder ─────────────────────────────────────

/**
 * Checks that [PHONE] placeholder is present in the page body.
 * @param {string} body
 * @param {string} pageType
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function checkPhonePlaceholder(body, pageType) {
  const issues = []

  if (!body.includes('[PHONE]')) {
    issues.push({ severity: 'WARN', message: `[PHONE] placeholder not found on ${pageType} page` })
  }

  return { pass: true, issues } // warn-only, never fails
}

// ── Check 12: Sources populated ─────────────────────────────────────

const SOURCES_REQUIRED_TYPES = new Set(['cost_guide', 'tool', 'guide'])

/**
 * Checks that cost_guide, tool, and guide pages have non-empty sources[].
 * @param {object} frontmatter
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function checkSourcesPopulated(frontmatter) {
  const issues = []
  const type = frontmatter.type

  if (!SOURCES_REQUIRED_TYPES.has(type)) {
    return { pass: true, issues }
  }

  if (!frontmatter.sources || frontmatter.sources.length === 0) {
    issues.push({ severity: 'WARN', message: `${type} page has empty sources[]` })
    return { pass: false, issues }
  }

  return { pass: true, issues }
}

// ── Check 13: H2 sequence extraction + uniqueness ───────────────────

/**
 * Extracts ordered H2 headings from markdown body.
 * @param {string} body
 * @returns {string[]}
 */
export function extractH2Sequence(body) {
  const h2Re = /^## (.+)$/gm
  const headings = []
  let match
  while ((match = h2Re.exec(body)) !== null) {
    headings.push(match[1].trim())
  }
  return headings
}

/**
 * Checks that same-niche sites differ in H2 order per page type.
 * @param {Object<string, Object<string, string[][]>>} sitesByNiche
 *   Structure: { niche: { pageType: [ [h2, h2, ...], [h2, h2, ...] ] } }
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function checkH2SequenceUniqueness(sitesByNiche) {
  const issues = []

  for (const [niche, pageTypes] of Object.entries(sitesByNiche)) {
    for (const [pageType, sequences] of Object.entries(pageTypes)) {
      const serialized = sequences.map(s => JSON.stringify(s))
      const seen = new Set()
      for (const s of serialized) {
        if (seen.has(s)) {
          issues.push({
            severity: 'WARN',
            message: `Identical H2 sequence in ${niche} ${pageType} pages`,
          })
          break
        }
        seen.add(s)
      }
    }
  }

  return { pass: issues.length === 0, issues }
}

// ── Check 14: Content hash coverage ─────────────────────────────────

/**
 * Checks that all expected niches have > 0 content hashes.
 * @param {Object<string, string[]>} hashes - { niche: [hash, ...] }
 * @param {string[]} expectedNiches
 * @returns {{ pass: boolean, issues: Array<{severity: string, message: string}> }}
 */
export function checkHashCoverage(hashes, expectedNiches) {
  const issues = []

  for (const niche of expectedNiches) {
    const arr = hashes[niche]
    if (!arr || arr.length === 0) {
      issues.push({ severity: 'FAIL', message: `Niche "${niche}" has 0 content hashes` })
    }
  }

  return { pass: issues.length === 0, issues }
}
