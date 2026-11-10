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

function normalizeValidation(v, candidate) {
  const out = { ...v }

  // signals: construct from CSV score fields if missing
  if (!out.signals) {
    out.signals = {
      volume: parseInt(candidate.score_vol, 10) || 0,
      cpc: parseInt(candidate.score_cpc, 10) || 0,
      mapPack: parseInt(candidate.score_map, 10) || 0,
      organic: parseInt(candidate.score_organic, 10) || 0,
      renters: parseInt(candidate.score_renters, 10) || 0,
      license: parseInt(candidate.score_license, 10) || 0,
      seasonality: parseInt(candidate.score_season, 10) || 0,
      rent: parseInt(candidate.score_rent, 10) || 0,
    }
  }

  // trends_monthly: fall back to v.trends if it's a short array
  if (!out.trends_monthly && Array.isArray(out.trends) && out.trends.length <= 12) {
    out.trends_monthly = out.trends
  }

  // maps_data: fall back to v.maps
  if (!out.maps_data && out.maps) {
    out.maps_data = out.maps
  }

  // organic_domains: flatten from v.organic[].topDomains and dedupe
  if (!out.organic_domains && Array.isArray(out.organic)) {
    const seen = new Set()
    const domains = []
    for (const entry of out.organic) {
      for (const d of entry.topDomains || []) {
        if (!seen.has(d)) {
          seen.add(d)
          domains.push(d)
        }
      }
    }
    out.organic_domains = domains
  }

  return out
}

export function enrichCandidates(candidates, validationMap, teardownMap, backlinkMap) {
  return candidates.map((c) => {
    const enriched = { ...c }
    if (validationMap[c.slug]) {
      enriched.validation = normalizeValidation(validationMap[c.slug], c)
    }
    if (teardownMap[c.slug]) {
      const td = teardownMap[c.slug]
      if (typeof td === 'string') {
        enriched.teardownVerdict = td
      } else {
        enriched.teardownVerdict = td.verdict
        enriched.teardownAssessment = td.assessment
        enriched.teardownKeyFinding = td.keyFinding
      }
    }
    if (backlinkMap[c.slug]) {
      enriched.backlinkSources = backlinkMap[c.slug]
    }
    return enriched
  })
}

export function extractTeardownData(markdown) {
  if (!markdown) return { verdict: null, assessment: null, keyFinding: null }
  const match = markdown.match(/## Verdict:\s*(BEATABLE|TOUGH|SKIP)\s*\n([\s\S]*?)(?=\n## |\s*$)/)
  if (!match) return { verdict: null, assessment: null, keyFinding: null }
  const verdict = match[1]
  const assessment = match[2].trim()
  if (!assessment) return { verdict, assessment: '', keyFinding: '' }
  const firstSentence = assessment.match(/^[^.]+\./)
  const keyFinding = firstSentence ? firstSentence[0].trim() : assessment.split('\n')[0]
  return { verdict, assessment, keyFinding }
}

export function extractTeardownVerdict(markdown) {
  return extractTeardownData(markdown).verdict
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

export function buildNicheSummary(candidates, economicsMap) {
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
  if (economicsMap) {
    for (const niche of Object.keys(summary)) {
      const econ = economicsMap.get(niche.toLowerCase())
      if (econ) {
        summary[niche].avgJobRange = `$${econ.avgJobLow}–$${econ.avgJobHigh}`
      }
    }
  }
  return summary
}

export function enrichWithJobEconomics(candidates, economicsMap) {
  return candidates.map((c) => {
    const econ = economicsMap.get(c.niche.toLowerCase())
    if (!econ) return { ...c }
    return {
      ...c,
      jobValueRange: `$${econ.avgJobLow}–$${econ.avgJobHigh}`,
      avgJobLow: econ.avgJobLow,
      avgJobHigh: econ.avgJobHigh,
    }
  })
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

export function buildRentersSummary(buyers) {
  const byCandidate = {}
  const totals = { total: 0, hot: 0, warm: 0, cold: 0 }

  for (const b of buyers) {
    const slug = b.candidate_slug
    if (!byCandidate[slug]) {
      byCandidate[slug] = { total: 0, hot: 0, warm: 0, cold: 0, withEmail: 0, withPhone: 0, withOwner: 0, topRenters: [] }
    }
    const entry = byCandidate[slug]
    entry.total++
    totals.total++
    const p = b.pitch_priority
    if (p === 'hot') { entry.hot++; totals.hot++ }
    else if (p === 'warm') { entry.warm++; totals.warm++ }
    else { entry.cold++; totals.cold++ }
    if (b.email) entry.withEmail++
    if (b.phone) entry.withPhone++
    if (b.owner_name) entry.withOwner++
    entry.topRenters.push({
      business_name: b.business_name,
      rating: b.rating,
      review_count: b.review_count,
      website_weakness: b.website_weakness,
      pitch_priority: b.pitch_priority,
      email: b.email || '',
      owner_name: b.owner_name || '',
      phone: b.phone || '',
      website: b.website || '',
    })
  }

  // Sort top renters by review_count desc
  for (const slug of Object.keys(byCandidate)) {
    byCandidate[slug].topRenters.sort((a, b) => (parseFloat(b.review_count) || 0) - (parseFloat(a.review_count) || 0))
  }

  return { byCandidate, totals }
}

export function buildKeywordsSummary(siteYamls) {
  if (!siteYamls) return {}
  const result = {}
  for (const [slug, yaml] of Object.entries(siteYamls)) {
    const pages = yaml.pages || []
    const pageTypes = {}
    const keywords = []
    for (const p of pages) {
      const t = p.type
      pageTypes[t] = (pageTypes[t] || 0) + 1
      if (p.primary_keyword) keywords.push(p.primary_keyword)
    }
    result[slug] = {
      pageCount: pages.length,
      pageTypes,
      keywords,
      towns: yaml.towns || [],
      city: yaml.city || '',
      niche: yaml.niche || '',
    }
  }
  return result
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
