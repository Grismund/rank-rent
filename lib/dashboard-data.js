/**
 * Dashboard data-processing functions.
 * Transforms raw CSV/JSON/markdown research data into dashboard-ready structures.
 */

export function buildFunnel(candidates) {
  let validated = 0
  let highScorers = 0
  let tornDown = 0
  let shortlisted = 0

  for (const c of candidates) {
    const score = parseInt(c.score_total, 10)
    if (score >= 8) validated++
    if (score >= 11) highScorers++
    if (c.status === 'torn_down') tornDown++
    if (c.status === 'shortlisted') shortlisted++
  }

  return { total: candidates.length, validated, highScorers, tornDown, shortlisted }
}

export function enrichCandidates(candidates, validationMap, teardownMap, backlinkMap) {
  return candidates.map((c) => {
    const enriched = { ...c }
    if (validationMap[c.slug]) {
      enriched.validation = validationMap[c.slug]
    }
    if (teardownMap[c.slug]) {
      enriched.teardownVerdict = teardownMap[c.slug]
    }
    if (backlinkMap[c.slug]) {
      enriched.backlinkSources = backlinkMap[c.slug]
    }
    return enriched
  })
}

export function extractTeardownVerdict(markdown) {
  if (!markdown) return null
  const match = markdown.match(/## Verdict:\s*(BEATABLE|TOUGH|SKIP)/)
  return match ? match[1] : null
}

export function buildRegionSummary(candidates) {
  const summary = {}
  for (const c of candidates) {
    const area = c.area
    if (!summary[area]) {
      summary[area] = { count: 0, viable: 0, bestScore: 0 }
    }
    summary[area].count++
    const score = parseInt(c.score_total, 10) || 0
    if (score >= 8) summary[area].viable++
    if (score > summary[area].bestScore) summary[area].bestScore = score
  }
  return summary
}

export function buildNicheSummary(candidates) {
  const summary = {}
  for (const c of candidates) {
    const niche = c.niche
    if (!summary[niche]) {
      summary[niche] = { count: 0, viable: 0, bestScore: 0 }
    }
    summary[niche].count++
    const score = parseInt(c.score_total, 10) || 0
    if (score >= 8) summary[niche].viable++
    if (score > summary[niche].bestScore) summary[niche].bestScore = score
  }
  return summary
}

export function findCommonSources(competitors) {
  if (competitors.length === 0) return []

  const domainCounts = {}
  for (const comp of competitors) {
    const seen = new Set()
    for (const ref of comp.top_referring_domains || []) {
      if (!seen.has(ref.domain)) {
        domainCounts[ref.domain] = (domainCounts[ref.domain] || 0) + 1
        seen.add(ref.domain)
      }
    }
  }

  return Object.entries(domainCounts)
    .filter(([, count]) => count >= 2)
    .map(([domain]) => domain)
}

export function prioritizeLinkTargets(competitors, commonSources) {
  if (competitors.length === 0) return []

  const commonSet = new Set(commonSources)
  const seen = new Set()
  const commonTargets = []
  const otherTargets = []

  for (const comp of competitors) {
    for (const ref of comp.top_referring_domains || []) {
      if (seen.has(ref.domain)) continue
      seen.add(ref.domain)

      const entry = { domain: ref.domain, rank: ref.rank || 0, isCommon: commonSet.has(ref.domain) }
      if (entry.isCommon) {
        commonTargets.push(entry)
      } else {
        otherTargets.push(entry)
      }
    }
  }

  commonTargets.sort((a, b) => b.rank - a.rank)
  otherTargets.sort((a, b) => b.rank - a.rank)
  return [...commonTargets, ...otherTargets]
}
