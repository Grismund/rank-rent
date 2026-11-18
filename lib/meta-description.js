/**
 * Meta description generation for rank-rent site pages.
 * Pure functions — no I/O, no API calls.
 */

// ── CTA pool ─────────────────────────────────────────────────────────

const CTA_POOL = [
  'Get free quotes today.',
  'Request a free estimate.',
  'Compare local contractors.',
  'Get started with a free quote.',
]

function pickCta(seed) {
  // Deterministic pick based on a string seed (keyword) for reproducibility
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  return CTA_POOL[Math.abs(hash) % CTA_POOL.length]
}

// ── Helpers ──────────────────────────────────────────────────────────

function trimToWordBoundary(text, maxLen) {
  if (text.length <= maxLen) return text
  const truncated = text.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace === -1) return truncated
  return truncated.slice(0, lastSpace)
}

function stripMarkdown(text) {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
}

// ── Extractors ───────────────────────────────────────────────────────

/**
 * Extracts a price range like "$1,600 to $3,500" or "$3 to $7 per square foot" from body text.
 * Looks at first 500 chars. Returns null if no price found.
 */
export function extractPriceRange(text) {
  const chunk = text.slice(0, 500)
  // Match: $X,XXX to/–/— $X,XXX (optionally "per <word> <word>")
  const re = /\$[\d,]+\s*(?:to|–|—)\s*\$[\d,]+(?:\s+per\s+\w+(?:\s+\w+)?)?/
  const match = chunk.match(re)
  return match ? match[0] : null
}

/**
 * Extracts the first sentence from body text, stripping markdown formatting.
 * Truncates at ~80 chars on word boundary if too long.
 */
export function extractFirstSentence(text) {
  const clean = stripMarkdown(text).trim()
  // Collapse whitespace to single spaces for consistent matching
  const normalized = clean.replace(/\s+/g, ' ')

  // Find the first real sentence boundary: period followed by space + uppercase letter,
  // or period followed by newline. Skip abbreviations like Co., St., Inc., Dr., etc.
  const abbrevs = /(?:Co|Inc|Ltd|Jr|Sr|Dr|Mr|Mrs|Ms|St|vs|etc|approx|ft|sq)\./gi
  // Replace abbreviation dots with a placeholder to avoid false sentence breaks
  const safe = normalized.replace(abbrevs, m => m.slice(0, -1) + '\x00')
  const sentenceRe = /^(.+?\.)\s/
  const match = safe.match(sentenceRe)

  let sentence
  if (match) {
    // Restore dots and extract from original normalized text at same length
    sentence = normalized.slice(0, match[1].length)
  } else {
    sentence = normalized.split('\n')[0]
  }

  sentence = sentence.trim()

  if (sentence.length > 80) {
    sentence = trimToWordBoundary(sentence, 80) + '...'
  }

  return sentence
}

/**
 * Extracts a snippet from town_facts[0], stripping "Population X;" prefix.
 * Trims to ~60 chars on word boundary.
 */
export function extractTownSnippet(townFacts) {
  if (!townFacts || !Array.isArray(townFacts) || townFacts.length === 0) return null

  let fact = townFacts[0]
  // Strip "Population NNN (YYYY); " prefix
  fact = fact.replace(/^Population\s+[\d,]+\s*\([^)]*\);\s*/i, '')

  let result = trimToWordBoundary(fact, 60)
  // Strip trailing dangling prepositions/articles
  result = result.replace(/\s+(?:a|an|the|in|on|at|to|by|of|for|with|from|and|or|but|that|this|is|are|was|were)\s*$/i, '')

  return result
}

/**
 * Extracts 2-3 short topic keywords from FAQ question strings.
 * Handles both string and {question, answer} object formats.
 */
export function extractFaqTopics(faqs) {
  const questions = faqs.map(f => typeof f === 'string' ? f : f.question)

  // Map common question patterns to short topic labels
  const topicMap = [
    [/how long.*last|lifespan|durability/i, 'lifespan'],
    [/cost|price|how much/i, 'cost'],
    [/cure|dry|wait/i, 'curing time'],
    [/yourself|DIY/i, 'DIY vs pro'],
    [/slippery|slip|safe/i, 'safety'],
    [/crack|damage/i, 'durability'],
    [/maintain|clean|care/i, 'maintenance'],
    [/old concrete|existing/i, 'prep requirements'],
    [/difference|vs|versus|compare/i, 'coating types'],
    [/accurate|estimate/i, 'estimates'],
    [/install|long.*take/i, 'installation'],
    [/include|prep/i, 'what\'s included'],
    [/finish|solid|flake|metallic/i, 'finish options'],
    [/waterproof|water/i, 'water resistance'],
  ]

  const topics = new Set()
  for (const q of questions) {
    for (const [regex, topic] of topicMap) {
      if (regex.test(q)) {
        topics.add(topic)
        break
      }
    }
    if (topics.size >= 3) break
  }

  // Fallback: if fewer than 2, extract nouns from first 2 questions
  if (topics.size < 2) {
    for (const q of questions.slice(0, 2)) {
      const words = q.replace(/[?.,!]/g, '').split(/\s+/)
      const noun = words.find(w => w.length > 4 && !/^(does|have|what|which|where|when|will|would|could|should|about|their|there|these|those)$/i.test(w))
      if (noun) topics.add(noun.toLowerCase())
      if (topics.size >= 2) break
    }
  }

  return [...topics].slice(0, 3).join(', ')
}

/**
 * Extracts service page display names from site.yaml, stripping the city suffix.
 * Returns comma-separated list truncated to fit.
 */
export function extractServiceList(siteYaml) {
  const servicePages = (siteYaml.pages || []).filter(p => p.type === 'service')
  const names = servicePages.map(p => {
    // Strip " in City, State" from H1 to get the service name
    return p.h1.replace(/\s+in\s+.+$/i, '').toLowerCase()
  })

  let result = names.join(', ')
  if (result.length > 80) {
    // Truncate to fit by dropping items from the end
    while (names.length > 1 && names.join(', ').length > 80) {
      names.pop()
    }
    result = names.join(', ')
  }

  return result
}

// ── Builder ──────────────────────────────────────────────────────────

/**
 * Builds a meta description for a page given its type and extracted data.
 * Target: 120-160 chars. Includes primary keyword and CTA.
 */
export function buildMetaDescription({ type, keyword, city, state, ...extras }) {
  const cta = pickCta(keyword + type)
  let desc

  switch (type) {
    case 'home': {
      const services = extras.serviceList || ''
      // Keyword usually contains the city already, so don't repeat it
      const kwHasCity = keyword.toLowerCase().includes(city.toLowerCase())
      const location = kwHasCity ? `, ${state}` : ` in ${city}, ${state}`
      desc = `${titleCase(keyword)}${location} — ${services}. ${cta}`
      break
    }
    case 'service': {
      const extract = extras.firstSentence || ''
      desc = `${titleCase(keyword)} — ${extract} ${cta}`
      break
    }
    case 'town': {
      const snippet = extras.townSnippet || ''
      desc = `${titleCase(keyword)} — ${snippet}. ${cta}`
      break
    }
    case 'cost_guide': {
      const price = extras.priceRange || ''
      desc = `${titleCase(keyword)}: most projects run ${price}. See what affects your price. ${cta}`
      break
    }
    case 'faq': {
      const topics = extras.faqTopics || ''
      desc = `${titleCase(keyword)} for ${city}, ${state} — answers on ${topics}. ${cta}`
      break
    }
    case 'tool': {
      const extract = extras.firstSentence || ''
      desc = `Free ${titleCase(keyword)} — ${extract} ${cta}`
      break
    }
    case 'guide': {
      const h2s = extras.h2List || ''
      desc = `${titleCase(keyword)} — covers ${h2s}. ${cta}`
      break
    }
    default:
      desc = `${titleCase(keyword)} in ${city}, ${state}. ${cta}`
  }

  // Sanitize: collapse whitespace/newlines into single spaces
  desc = desc.replace(/\s+/g, ' ').trim()

  // Trim to 155 chars max on word boundary (5-char safety margin)
  desc = fitDescription(desc, keyword, city, state, cta, type, extras)

  return desc
}

/** Title-case a keyword string, respecting small words and acronyms. */
function titleCase(str) {
  if (!str) return ''
  const small = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'in', 'on', 'at', 'to', 'by', 'of', 'vs', 'per'])
  const upper = new Set(['faq', 'diy', 'uv', 'hvac', 'seo', 'usa'])
  return str.split(' ').map((w, i) => {
    if (upper.has(w.toLowerCase())) return w.toUpperCase()
    if (i === 0 || !small.has(w.toLowerCase())) {
      return w.charAt(0).toUpperCase() + w.slice(1)
    }
    return w
  }).join(' ')
}

/**
 * Ensures description is 120-160 chars. If too short, pads with location context.
 * If too long, trims content portion on word boundary.
 */
function fitDescription(desc, keyword, city, state, cta, type, extras) {
  // If over 160, trim the middle portion keeping keyword and CTA
  if (desc.length > 160) {
    // Find the CTA at the end and preserve it
    const ctaStart = desc.lastIndexOf(cta)
    if (ctaStart > 0) {
      const beforeCta = desc.slice(0, ctaStart)
      const trimmed = trimToWordBoundary(beforeCta, 160 - cta.length - 1) + ' ' + cta
      desc = trimmed
    } else {
      desc = trimToWordBoundary(desc, 157) + '...'
    }
  }

  // If under 120, insert padding before the CTA
  if (desc.length < 120) {
    const ctaStart = desc.lastIndexOf(cta)
    if (ctaStart > 0) {
      const before = desc.slice(0, ctaStart).trimEnd()
      const padOptions = [
        'Call today.',
        `${city} area.`,
        `Serving ${city}.`,
        `Serving ${city} and surrounding areas.`,
        `Local ${city}, ${state} contractors ready to help.`,
        `Professional service in ${city}, ${state}.`,
        `Trusted by ${city} homeowners and businesses.`,
      ]
      for (const pad of padOptions) {
        const candidate = `${before} ${pad} ${cta}`
        if (candidate.length >= 120 && candidate.length <= 160) {
          desc = candidate
          break
        }
      }
    }
  }

  // Final safety: hard-trim at 160
  if (desc.length > 160) {
    const ctaStart = desc.lastIndexOf(cta)
    if (ctaStart > 0) {
      const beforeCta = desc.slice(0, ctaStart)
      desc = trimToWordBoundary(beforeCta, 160 - cta.length - 1).trimEnd() + ' ' + cta
    }
    if (desc.length > 160) {
      desc = trimToWordBoundary(desc, 157) + '...'
    }
  }

  return desc
}

// ── Frontmatter rewriter ─────────────────────────────────────────────

/**
 * Replaces the meta_description value in YAML frontmatter.
 * Handles unquoted, single-quoted, and double-quoted values.
 * Preserves everything else in the file unchanged.
 */
export function rewriteFrontmatter(rawMarkdown, newDescription) {
  // Match meta_description line in frontmatter (between --- fences)
  const fmEnd = rawMarkdown.indexOf('\n---', 3)
  if (fmEnd === -1) return rawMarkdown

  const frontmatter = rawMarkdown.slice(0, fmEnd)
  const rest = rawMarkdown.slice(fmEnd)

  // Escape double quotes in the new description
  const escaped = newDescription.replace(/"/g, '\\"')
  const newLine = `meta_description: "${escaped}"`

  // Try multi-line >- format first (key: >-\n  continuation lines...)
  const multilineRe = /^meta_description:\s*>-\n(?:[ \t]+.+\n?)*/m
  let finalFm
  if (multilineRe.test(frontmatter)) {
    finalFm = frontmatter.replace(multilineRe, newLine)
  } else {
    // Single-line: unquoted, 'single-quoted', or "double-quoted"
    finalFm = frontmatter.replace(/^meta_description:.*$/m, newLine)
  }

  return finalFm + rest
}
