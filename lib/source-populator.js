/**
 * Source populator — generates sources[] entries for cost_guide, tool,
 * and guide pages by extracting price ranges from the page body and
 * combining them with niche-level job value data.
 */

/** Matches $X to $Y, $X–$Y, or $X-$Y price ranges */
const RANGE_RE = /(\$[\d,]+(?:\.\d+)?)\s*(?:to|–|-)\s*(\$[\d,]+(?:\.\d+)?)/g

/** Captures trailing context after a price range (e.g., "per square foot") */
const CONTEXT_RE = /(\$[\d,]+(?:\.\d+)?)\s*(?:to|–|-)\s*(\$[\d,]+(?:\.\d+)?)\s*(per [^.;,\n]+|installed|residential|commercial)?/g

/**
 * Extract price ranges from text.
 * @param {string} text
 * @returns {Array<{ range: string, context: string }>}
 */
export function extractPriceRanges(text) {
  const results = []
  let match
  while ((match = CONTEXT_RE.exec(text)) !== null) {
    const separator = text.slice(match.index + match[1].length).match(/^\s*(to|–|-)/)[1]
    results.push({
      range: `${match[1]}${separator === 'to' ? ' to ' : separator}${match[2]}`,
      context: (match[3] || '').trim(),
    })
  }
  return results
}

/**
 * Generate sources for a page with empty sources[].
 * @param {object} opts
 * @param {string} opts.body - Markdown body text
 * @param {string} opts.pageType - Page type (cost_guide, tool, guide)
 * @param {string} opts.nicheJobValue - Niche avg job value range (e.g., "$1,600–$3,500")
 * @returns {string[]}
 */
export function generateSources({ body, pageType, nicheJobValue }) {
  const sources = []

  // Source 1: Niche brief with job value
  const typeLabel = pageType === 'cost_guide' ? 'avg job value'
    : pageType === 'tool' ? 'avg job value'
    : 'pricing and service specifications'
  sources.push(`Niche brief: ${nicheJobValue} ${typeLabel}`)

  // Source 2+: Price ranges from body
  const ranges = extractPriceRanges(body)
  if (ranges.length > 0) {
    // Build a compact pricing summary from the first few distinct ranges
    const seen = new Set()
    const priceParts = []
    for (const r of ranges) {
      if (seen.has(r.range)) continue
      seen.add(r.range)
      const entry = r.context ? `${r.range} ${r.context}` : r.range
      priceParts.push(entry)
      if (priceParts.length >= 3) break
    }
    sources.push(`Pricing: ${priceParts.join('; ')}`)
  }

  return sources
}
