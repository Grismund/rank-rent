/**
 * Build a city→niches matrix from briefed candidates and niche packs.
 * @param {Array<{niche: string, area: string, region: string, status: string}>} candidates
 * @param {Map<string, object>} packsByNiche - Map of niche slug → parsed pack.yaml
 * @returns {Map<string, {state: string, niches: Array}>}
 */
export function buildCityNicheMatrix(candidates, packsByNiche) {
  const matrix = new Map()

  for (const c of candidates) {
    if (c.status !== 'briefed') continue

    const state = c.region.replace(/\s*\(.*\)$/, '')
    const city = c.area
    const pack = packsByNiche.get(c.niche)

    if (!matrix.has(city)) {
      matrix.set(city, { state, niches: [] })
    }

    matrix.get(city).niches.push({
      slug: c.niche,
      displayName: pack?.display_name ?? c.niche,
      standardVars: pack?.local_variables?.standard ?? [],
      nicheSpecificVars: pack?.local_variables?.niche_specific ?? [],
    })
  }

  return matrix
}

/**
 * Validate a city fact sheet markdown against requirements.
 * @param {string} markdown - The fact sheet content
 * @param {string[]} requiredNiches - Niche slugs that must have sections
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateFactSheet(markdown, requiredNiches) {
  const errors = []
  const MIN_FACTS_PER_NICHE = 5

  // Check for [source needed] markers
  const sourceNeededMatches = markdown.match(/\[source needed\]/gi)
  if (sourceNeededMatches) {
    errors.push(`Found ${sourceNeededMatches.length} [source needed] marker(s) requiring resolution`)
  }

  // Check each required niche section exists and has enough sourced facts
  for (const niche of requiredNiches) {
    const sectionRegex = new RegExp(`## Niche: ${escapeRegex(niche)}`)
    if (!sectionRegex.test(markdown)) {
      errors.push(`Missing required niche section: ${niche}`)
      continue
    }

    // Extract the niche section content (until next ## or end)
    const sectionStart = markdown.search(sectionRegex)
    const rest = markdown.slice(sectionStart)
    const nextH2 = rest.indexOf('\n## ', 1)
    const sectionContent = nextH2 === -1 ? rest : rest.slice(0, nextH2)

    // Count fact bullets (lines starting with "- ")
    const factLines = sectionContent.split('\n').filter(line => line.match(/^- .+/))

    // Check each fact has a source citation [Name](url)
    const unsourced = factLines.filter(line => !line.match(/\[.+?\]\(https?:\/\/.+?\)/))
    if (unsourced.length > 0) {
      errors.push(`${unsourced.length} fact(s) in niche "${niche}" missing source citation [Source](url)`)
    }

    // Check minimum fact count (only count sourced facts)
    const sourcedFacts = factLines.filter(line => line.match(/\[.+?\]\(https?:\/\/.+?\)/))
    if (sourcedFacts.length < MIN_FACTS_PER_NICHE) {
      errors.push(`Niche "${niche}" has ${sourcedFacts.length} sourced facts, minimum is ${MIN_FACTS_PER_NICHE}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
