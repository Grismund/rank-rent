/**
 * Pack.yaml schema validation for Phase 4 content generation.
 * Validates h2_variants, tool block, guide/tool_page outlines, design block, guide_topics.
 * Pure functions — no I/O, no API calls.
 */

const REQUIRED_OUTLINE_TYPES = ['home', 'service', 'town', 'cost_guide', 'faq', 'guide', 'tool_page']

/**
 * Validate a parsed pack.yaml object has all Phase 4 required fields.
 *
 * @param {object} pack - Parsed pack.yaml
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePack(pack) {
  const errors = []

  // Check required page outline types
  for (const type of REQUIRED_OUTLINE_TYPES) {
    if (!pack.page_outlines || !pack.page_outlines[type]) {
      errors.push(`Missing required page outline: ${type}`)
    }
  }

  // Check h2_variants on every section of every outline
  if (pack.page_outlines) {
    for (const [outlineType, outline] of Object.entries(pack.page_outlines)) {
      if (!outline.sections) continue
      for (let i = 0; i < outline.sections.length; i++) {
        const section = outline.sections[i]
        if (!section.h2_variants) {
          errors.push(`${outlineType}.sections[${i}] missing h2_variants`)
          continue
        }
        if (section.h2_variants.length < 3) {
          errors.push(`${outlineType}.sections[${i}].h2_variants must have at least 3 entries (has ${section.h2_variants.length})`)
        }
        if (section.h2_variants.length > 0 && section.h2 && section.h2_variants[0] !== section.h2) {
          errors.push(`${outlineType}.sections[${i}] first h2_variant must match h2 ("${section.h2}")`)
        }
      }
    }
  }

  // Check tool block
  if (!pack.tool) {
    errors.push('Missing required tool block')
  } else {
    if (!pack.tool.type) {
      errors.push('Missing required tool.type')
    }
    if (!pack.tool.default_slug) {
      errors.push('Missing required tool.default_slug')
    }
  }

  // Check design block
  if (!pack.design) {
    errors.push('Missing required design block')
  } else {
    if (!pack.design.tokens || !Array.isArray(pack.design.tokens)) {
      errors.push('Missing required design.tokens array')
    }
  }

  // Check guide_topics (need at least 2 with type: guide)
  if (!pack.guide_topics || !Array.isArray(pack.guide_topics)) {
    errors.push('Missing required guide_topics array')
  } else {
    const guideCount = pack.guide_topics.filter(t => t.type === 'guide').length
    if (guideCount < 2) {
      errors.push(`guide_topics must have at least 2 entries with type: guide (has ${guideCount})`)
    }
  }

  return { valid: errors.length === 0, errors }
}
