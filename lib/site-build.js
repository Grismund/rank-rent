import { dump as dumpYaml } from 'js-yaml'

/**
 * Simple deterministic hash (djb2 variant).
 * Returns a non-negative integer.
 */
function djb2(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & 0x7fffffff // keep positive 31-bit
  }
  return hash
}

/**
 * Deterministic pick from h2_variants using a hash of siteSlug + pageType + sectionIndex.
 * Same site always gets the same variant; different sites get different variants.
 */
export function pickH2Variant(variants, siteSlug, pageType, sectionIndex) {
  const key = `${siteSlug}:${pageType}:${sectionIndex}`
  const idx = djb2(key) % variants.length
  return variants[idx]
}

/**
 * Replace template variables in a string.
 * Supported: {display_name}, {city}, {state}, {brand}, {sub_service}, {topic}, {tool_name}
 */
function replaceVars(str, vars) {
  return str.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match
  })
}

/**
 * Build sections frontmatter array from a pack outline.
 * Returns [{h2, h3s?}] with template vars replaced and h2 picked from variants.
 */
export function buildSectionsFrontmatter(packOutline, pageType, siteSlug, vars) {
  return packOutline.sections.map((section, i) => {
    let h2
    if (section.h2_variants && section.h2_variants.length > 0) {
      h2 = pickH2Variant(section.h2_variants, siteSlug, pageType, i)
    } else {
      h2 = section.h2
    }
    h2 = replaceVars(h2, vars)

    const result = { h2 }
    if (section.h3s && section.h3s.length > 0) {
      result.h3s = section.h3s.map(h3 => replaceVars(h3, vars))
    }
    return result
  })
}

/**
 * Build complete frontmatter object for one page.
 */
export function buildPageFrontmatter(page, packOutline, siteSlug, brand, vars) {
  const sections = buildSectionsFrontmatter(packOutline, page.type, siteSlug, vars)
  const today = new Date().toISOString().slice(0, 10)

  const fm = {
    title: page.title.replace(/\| TBD$/, `| ${brand}`),
    meta_description: page.meta_description_intent,
    h1: page.h1,
    primary_keyword: page.primary_keyword,
    type: page.type,
    status: 'draft',
    updated: today,
    word_count_target: page.word_count,
    sections,
    sources: [],
    faqs: [],
    town_facts: [],
  }

  // Tool pages get schema and figures placeholder
  if (page.type === 'tool' && page.schema) {
    fm.schema = page.schema
    fm.figures = []
  }

  // FAQ pages get schema
  if (page.type === 'faq' && page.schema) {
    fm.schema = page.schema
  }

  return fm
}

/**
 * Generate a scaffold markdown file: YAML frontmatter with empty body.
 */
export function generateScaffoldMarkdown(frontmatter) {
  const yaml = dumpYaml(frontmatter, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
  })
  return `---\n${yaml}---\n`
}

/**
 * Replace '| TBD' with '| <brand>' in title lines of a site.yaml string.
 * Only targets lines that have the pattern `title: ... | TBD`.
 */
export function updateBrandInSiteYaml(yamlString, brand) {
  return yamlString.replace(/(title:\s+.+?)\| TBD/g, `$1| ${brand}`)
}

/**
 * Convert a page slug to a content markdown filename (without extension).
 * / → home, /foo/ → foo, /areas/bar/ → areas-bar
 */
export function pageSlugToFilename(pageSlug) {
  const trimmed = pageSlug.replace(/^\/|\/$/g, '')
  if (trimmed === '') return 'home'
  return trimmed.replace(/\//g, '-')
}
