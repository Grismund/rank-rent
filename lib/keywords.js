/**
 * Keyword-targeted page plan builder for rank-and-rent sites.
 * Pure functions — no I/O, no API calls.
 */

/**
 * Extract state name from region field like "Texas (local-discover)" or "Florida (city-list)".
 * Returns the region string as-is if no parenthetical suffix is found.
 */
export function extractStateFromRegion(region) {
  const match = region.match(/^(.+?)\s*\(/)
  return match ? match[1].trim() : region.trim()
}

/**
 * Convert a string to a URL-safe slug.
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[.?!,'"]/g, '')
    .replace(/\s+/g, '-')
}

/**
 * Build a keyword-targeted page plan for a single site.
 *
 * @param {{ niche: string, area: string, region: string }} candidate
 * @param {object} pack - Parsed pack.yaml (display_name, sub_services, page_outlines)
 * @param {string[]} nearbyTowns - Town names for town pages
 * @param {{ toolSlug?: string }} [options] - Optional overrides (e.g. from ASSIGNMENTS.md)
 * @returns {{ pages: object[], brand: string }}
 */
export function buildPagePlan(candidate, pack, nearbyTowns, options = {}) {
  const city = candidate.area
  const state = extractStateFromRegion(candidate.region)
  const displayName = pack.display_name
  const brand = 'TBD'
  const outlines = pack.page_outlines

  const pages = []

  // Home page
  pages.push({
    slug: '/',
    type: 'home',
    primary_keyword: `${displayName} ${city}`.toLowerCase(),
    h1: templateReplace(outlines.home.h1, { display_name: displayName, city, state }),
    title: templateReplace(outlines.home.title, { display_name: displayName, city, state, brand }),
    meta_description_intent: `Connect with ${displayName.toLowerCase()} pros in ${city}, ${state}. Free quotes from local contractors.`,
    word_count: { ...outlines.home.word_count },
  })

  // Service pages
  const usedKeywords = new Set(pages.map(p => p.primary_keyword))
  for (const sub of pack.sub_services) {
    let keyword = sub.primary_keyword.replace(/\{city\}/g, city).toLowerCase()
    // If keyword collides with an existing page, use sub_service display name instead
    if (usedKeywords.has(keyword)) {
      keyword = `${sub.display} ${city}`.toLowerCase()
    }
    // If still collides (display matches niche name), add "services" modifier
    if (usedKeywords.has(keyword)) {
      keyword = `${sub.display} services ${city}`.toLowerCase()
    }
    usedKeywords.add(keyword)
    pages.push({
      slug: `/${sub.slug}/`,
      type: 'service',
      primary_keyword: keyword,
      h1: templateReplace(outlines.service.h1, { sub_service: sub.display, city, state }),
      title: templateReplace(outlines.service.title, { sub_service: sub.display, city, state, brand }),
      meta_description_intent: `${sub.display} services in ${city}, ${state}. ${sub.intent}.`,
      word_count: { ...outlines.service.word_count },
    })
  }

  // Town pages
  for (const town of nearbyTowns) {
    pages.push({
      slug: `/areas/${slugify(town)}/`,
      type: 'town',
      primary_keyword: `${displayName} ${town}`.toLowerCase(),
      h1: templateReplace(outlines.town.h1, { display_name: displayName, city: town, state }),
      title: templateReplace(outlines.town.title, { display_name: displayName, city: town, state, brand }),
      meta_description_intent: `${displayName} services in ${town}, ${state}. Serving ${town} and surrounding areas.`,
      word_count: { ...outlines.town.word_count },
    })
  }

  // Cost guide
  pages.push({
    slug: '/cost/',
    type: 'cost_guide',
    primary_keyword: `${displayName} cost ${city}`.toLowerCase(),
    h1: templateReplace(outlines.cost_guide.h1, { display_name: displayName, city, state }),
    title: templateReplace(outlines.cost_guide.title, { display_name: displayName, city, state, brand }),
    meta_description_intent: `How much does ${displayName.toLowerCase()} cost in ${city}? Price ranges, factors, and free estimates.`,
    word_count: { ...outlines.cost_guide.word_count },
  })

  // FAQ
  pages.push({
    slug: '/faq/',
    type: 'faq',
    primary_keyword: `${displayName} faq`.toLowerCase(),
    h1: templateReplace(outlines.faq.h1, { display_name: displayName, city, state }),
    title: templateReplace(outlines.faq.title, { display_name: displayName, city, state, brand }),
    meta_description_intent: `Frequently asked questions about ${displayName.toLowerCase()} in ${city}, ${state}.`,
    word_count: { ...outlines.faq.word_count },
    ...(outlines.faq.schema ? { schema: outlines.faq.schema } : {}),
  })

  // Tool page (Phase 4) — only when pack has a tool block
  if (pack.tool && outlines.tool_page) {
    const toolSlug = options.toolSlug || pack.tool.default_slug
    const toolName = slugToToolName(toolSlug)
    // Tool keyword uses calculator/estimator phrasing to avoid cannibalizing cost guide
    const toolKeyword = `${toolName} ${city}`.toLowerCase()
    pages.push({
      slug: toolSlug,
      type: 'tool',
      primary_keyword: toolKeyword,
      h1: templateReplace(outlines.tool_page.h1, { tool_name: toolName, city, state }),
      title: templateReplace(outlines.tool_page.title, { tool_name: toolName, city, state, brand }),
      meta_description_intent: `Free ${toolName.toLowerCase()} for ${city}, ${state}. Get an instant estimate for your project.`,
      word_count: { ...outlines.tool_page.word_count },
      ...(outlines.tool_page.schema ? { schema: outlines.tool_page.schema } : {}),
    })
  }

  // Guide pages (Phase 4) — only when pack has guide_topics with type: guide
  if (pack.guide_topics && outlines.guide) {
    const guideTopics = pack.guide_topics.filter(t => t.type === 'guide')
    for (const topic of guideTopics) {
      const guideSlug = `/guides/${slugify(topic.topic)}/`
      const keyword = topic.target_keyword.replace(/\{city\}/g, city).replace(/\{state\}/g, state).toLowerCase()
      pages.push({
        slug: guideSlug,
        type: 'guide',
        primary_keyword: keyword,
        h1: templateReplace(outlines.guide.h1, { topic: topic.topic, city, state }),
        title: templateReplace(outlines.guide.title, { topic: topic.topic, city, state, brand }),
        meta_description_intent: `${topic.topic} — a guide for ${city}, ${state} homeowners.`,
        word_count: { ...outlines.guide.word_count },
      })
    }
  }

  return { pages, brand }
}

/**
 * Validate a site.yaml object.
 *
 * @param {object} siteYaml - Full site.yaml object with pages array
 * @param {object} pack - Parsed pack.yaml
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSiteYaml(siteYaml, pack) {
  const errors = []

  // Check page count 12-16
  const count = siteYaml.pages.length
  if (count < 12 || count > 16) {
    errors.push(`Invalid page count: ${count} (must be 12-16)`)
  }

  // Check required page types
  const types = new Set(siteYaml.pages.map(p => p.type))
  for (const required of ['home', 'faq', 'tool']) {
    if (!types.has(required)) {
      errors.push(`Missing required page type: ${required}`)
    }
  }

  // Check duplicate primary_keywords
  const seen = new Set()
  for (const page of siteYaml.pages) {
    if (seen.has(page.primary_keyword)) {
      errors.push(`Found duplicate primary_keyword: "${page.primary_keyword}"`)
    }
    seen.add(page.primary_keyword)
  }

  // Check title lengths
  for (const page of siteYaml.pages) {
    if (page.title.length > 60) {
      errors.push(`Page "${page.slug}" title exceeds 60 chars (${page.title.length}): "${page.title}"`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Convert a tool slug like "/floor-coating-cost-calculator/" to a display name.
 * Strips leading/trailing slashes, replaces hyphens with spaces, title-cases.
 */
function slugToToolName(slug) {
  return slug
    .replace(/^\/|\/$/g, '')
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Replace {placeholder} tokens in a template string.
 */
function templateReplace(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match
  })
}
