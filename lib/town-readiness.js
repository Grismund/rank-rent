/**
 * Town-page readiness checker.
 * Validates that a town's research facts sheet has enough content for
 * content-rules.md steps 5–8 (permits, sub-service skew, distance/logistics,
 * unique local paragraph).
 *
 * Pure functions — no I/O, no API calls.
 */

const PERMIT_PATTERNS = [
  /permit/i,
  /regulation/i,
  /\bHOA\b/,
  /land.?use/i,
  /ordinance/i,
  /code/i,
  /licensing/i,
]

const NEIGHBORHOOD_PATTERNS = [
  /neighborhood/i,
  /district/i,
  /corridor/i,
  /subdivision/i,
  /community/i,
]

const DISTANCE_PATTERNS = [
  /\d+\s*miles?\b/i,
  /nearby\s+cit/i,
  /neighboring/i,
  /distance/i,
  /southeast|southwest|northeast|northwest|north|south|east|west/i,
]

/**
 * Extract the niche-specific section from a town facts markdown.
 * Returns text from "## Niche: <niche>" to the next "## Niche:" or end.
 */
function extractNicheSection(markdown, niche) {
  const nicheHeader = `## Niche: ${niche}`
  const startIdx = markdown.indexOf(nicheHeader)
  if (startIdx === -1) return ''

  const afterHeader = startIdx + nicheHeader.length
  const nextNiche = markdown.indexOf('\n## Niche:', afterHeader)
  const nextTopLevel = markdown.indexOf('\n## ', afterHeader)

  // Find the end: either next ## Niche: or next top-level ## that isn't within niche section
  let endIdx = markdown.length
  if (nextNiche !== -1) {
    endIdx = nextNiche
  }

  return markdown.slice(startIdx, endIdx)
}

/**
 * Extract the City Overview section from town facts markdown.
 */
function extractOverviewSection(markdown) {
  const startIdx = markdown.indexOf('## City Overview')
  if (startIdx === -1) return ''

  const afterHeader = startIdx + '## City Overview'.length
  const nextTopLevel = markdown.indexOf('\n## ', afterHeader)
  const endIdx = nextTopLevel !== -1 ? nextTopLevel : markdown.length

  return markdown.slice(startIdx, endIdx)
}

/**
 * Check if text matches any pattern in a list.
 */
function matchesAny(text, patterns) {
  return patterns.some(p => p.test(text))
}

/**
 * Check whether a town's research facts sheet has sufficient content
 * for content-rules.md steps 5–8.
 *
 * @param {string|null|undefined} markdownText - Full area facts markdown
 * @param {string} niche - Niche slug (e.g. "epoxy-flooring")
 * @param {string} hubCity - Hub city name for distance/logistics check
 * @returns {{ ready: boolean, missing: string[] }}
 */
export function checkTownReadiness(markdownText, niche, hubCity) {
  const missing = []

  if (!markdownText || typeof markdownText !== 'string' || markdownText.trim() === '') {
    return {
      ready: false,
      missing: ['No content found — facts sheet is empty or missing'],
    }
  }

  const nicheSection = extractNicheSection(markdownText, niche)
  const overviewSection = extractOverviewSection(markdownText)
  const fullText = markdownText

  // Step 5: Permit/rules section
  if (!nicheSection || !matchesAny(nicheSection, PERMIT_PATTERNS)) {
    missing.push('Missing permit/regulation information (step 5)')
  }

  // Step 6: Sub-service skew — niche section should have enough substance
  // (checked implicitly by having a niche section with real content)
  if (!nicheSection || nicheSection.trim().split('\n').filter(l => l.trim()).length < 4) {
    missing.push('Niche section too thin for sub-service skew (step 6)')
  }

  // Step 7: Distance/logistics from hub, named neighborhoods
  const hasNeighborhoods = matchesAny(overviewSection, NEIGHBORHOOD_PATTERNS) ||
    matchesAny(nicheSection, NEIGHBORHOOD_PATTERNS)
  const hasDistance = matchesAny(overviewSection, DISTANCE_PATTERNS) ||
    matchesAny(fullText, DISTANCE_PATTERNS)

  if (!hasNeighborhoods && !hasDistance) {
    missing.push('Missing neighborhoods and distance/logistics from hub (step 7)')
  } else if (!hasNeighborhoods) {
    missing.push('Missing neighborhood or district references (step 7)')
  } else if (!hasDistance) {
    missing.push('Missing distance/logistics from hub city (step 7)')
  }

  // Step 8: Unique local paragraph — heuristic: niche section has substantive
  // content with specific local details (proper nouns, place names, numbers)
  const nicheLines = nicheSection
    ? nicheSection.split('\n').filter(l => l.startsWith('- ') && l.length > 40)
    : []
  if (nicheLines.length < 2) {
    missing.push('Insufficient unique local content for a non-boilerplate paragraph (step 8)')
  }

  return {
    ready: missing.length === 0,
    missing,
  }
}

/**
 * Summarize readiness results across multiple towns.
 *
 * @param {{ town: string, ready: boolean, missing: string[] }[]} results
 * @returns {{ total: number, readyCount: number, failedCount: number }}
 */
export function summarizeReadiness(results) {
  const total = results.length
  const readyCount = results.filter(r => r.ready).length
  return {
    total,
    readyCount,
    failedCount: total - readyCount,
  }
}
