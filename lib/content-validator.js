/**
 * Content validators for rank-rent site pages.
 * Each function checks one aspect of page content quality.
 */

/**
 * Strips YAML frontmatter (--- ... ---) from the beginning of text.
 */
function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

/**
 * Validates that body word count falls within the target range.
 * Strips frontmatter before counting.
 */
export function validateWordCount(text, { min, max }) {
  const body = stripFrontmatter(text)
  const words = body.trim().split(/\s+/).filter(w => w.length > 0)
  const count = words.length
  if (count < min) {
    return { valid: false, error: `Word count ${count} is below minimum ${min}`, count }
  }
  if (count > max) {
    return { valid: false, error: `Word count ${count} exceeds maximum ${max}`, count }
  }
  return { valid: true, count }
}

/**
 * Scans text for banned claims per content-rules.md.
 * Returns an array of { pattern, match } objects for each violation found.
 */
export function detectBannedClaims(text) {
  const patterns = [
    { pattern: 'serving since', regex: /serving\s+[\w\s]*since\s+\d/i },
    { pattern: 'licensed and insured', regex: /licensed\s+and\s+insured/i },
    { pattern: 'certified technicians', regex: /certified\s+technicians/i },
    { pattern: 'team of N', regex: /team\s+of\s+\d+/i },
    { pattern: 'voted #1', regex: /voted\s+#?\d/i },
    { pattern: 'satisfaction guaranteed', regex: /satisfaction\s+guaranteed/i },
    { pattern: '100% guaranteed', regex: /100%\s+.*guaranteed/i },
    { pattern: 'best in', regex: /\bbest\s+in\s+/i },
    { pattern: '#1', regex: /#1\s+\w+\s+(company|contractor|service|provider)/i },
  ]

  const results = []
  for (const { pattern, regex } of patterns) {
    const m = text.match(regex)
    if (m) {
      results.push({ pattern, match: m[0] })
    }
  }
  return results
}

/**
 * Checks that the primary keyword appears within the first N words of body text.
 * Strips frontmatter before checking. Case-insensitive.
 */
export function checkKeywordInFirstWords(text, keyword, wordLimit) {
  const body = stripFrontmatter(text)
  const words = body.trim().split(/\s+/).slice(0, wordLimit)
  const firstChunk = words.join(' ').toLowerCase()
  const found = firstChunk.includes(keyword.toLowerCase())
  if (found) {
    return { valid: true }
  }
  return { valid: false, error: `Primary keyword "${keyword}" not found in first ${wordLimit} words` }
}

/**
 * Validates that a page title is 60 characters or fewer.
 */
export function validateTitleLength(title) {
  if (title.length <= 60) {
    return { valid: true, length: title.length }
  }
  return { valid: false, error: `Title is ${title.length} chars, exceeds 60 char limit`, length: title.length }
}

/**
 * Validates that a meta description is between 120 and 160 characters.
 */
export function validateMetaDescriptionLength(description) {
  const len = description.length
  if (len < 120) {
    return { valid: false, error: `Meta description is ${len} chars, below 120 char minimum`, length: len }
  }
  if (len > 160) {
    return { valid: false, error: `Meta description is ${len} chars, exceeds 160 char limit`, length: len }
  }
  return { valid: true, length: len }
}

/**
 * Detects duplicate H2 headings within a single page.
 * Returns an array of duplicated heading strings.
 */
export function detectDuplicateH2s(text) {
  const h2Regex = /^## (.+)$/gm
  const headings = []
  let match
  while ((match = h2Regex.exec(text)) !== null) {
    headings.push(match[1].trim())
  }
  const seen = new Set()
  const dupes = new Set()
  for (const h of headings) {
    if (seen.has(h)) {
      dupes.add(h)
    }
    seen.add(h)
  }
  return [...dupes]
}

/**
 * Validates that a town page has at least 3 local facts in its town_facts array.
 */
export function validateTownFacts(townFacts) {
  if (!Array.isArray(townFacts) || townFacts.length < 3) {
    const count = Array.isArray(townFacts) ? townFacts.length : 0
    return { valid: false, error: `Town page has ${count} facts, needs at least 3`, count }
  }
  return { valid: true, count: townFacts.length }
}

/**
 * Compares two content strings and returns the overlap percentage.
 * Uses 3-word shingle comparison to detect near-duplicate content.
 */
export function detectNearDuplicateContent(textA, textB) {
  const shingle = (text, n = 3) => {
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').trim().split(/\s+/)
    const shingles = new Set()
    for (let i = 0; i <= words.length - n; i++) {
      shingles.add(words.slice(i, i + n).join(' '))
    }
    return shingles
  }

  const setA = shingle(textA)
  const setB = shingle(textB)

  if (setA.size === 0 && setB.size === 0) {
    return { overlapPercent: 100 }
  }
  if (setA.size === 0 || setB.size === 0) {
    return { overlapPercent: 0 }
  }

  let intersection = 0
  for (const s of setA) {
    if (setB.has(s)) intersection++
  }

  const union = new Set([...setA, ...setB]).size
  const overlapPercent = Math.round((intersection / union) * 100)
  return { overlapPercent }
}
