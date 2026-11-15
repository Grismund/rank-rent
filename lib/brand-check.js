const FILLER_WORDS = ['the', 'and', 'of', 'in']

/**
 * Convert a brand name to candidate .com domains per naming-rules.md.
 *
 * Rules:
 * - Lowercase, strip punctuation (periods, ampersands, apostrophes)
 * - Primary: remove spaces
 * - If primary > 25 chars (excl TLD): try dropping filler words
 * - Fallback: replace spaces with single hyphen
 * - Return [nohyphen.com, hyphenated.com] (deduplicated)
 *
 * @param {string} brandName
 * @returns {string[]}
 */
export function brandToDomains(brandName) {
  // Lowercase and strip punctuation
  const cleaned = brandName
    .toLowerCase()
    .replace(/[.&']/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ')

  // Primary: no spaces
  let primaryName = words.join('')

  // If primary > 25 chars, drop filler words
  if (primaryName.length > 25) {
    const reduced = words.filter(w => !FILLER_WORDS.includes(w)).join('')
    if (reduced.length > 0) primaryName = reduced
  }

  // Hyphenated fallback
  const hyphenatedName = words.join('-')

  const results = [`${primaryName}.com`]

  // Only add hyphenated if it differs from primary
  if (hyphenatedName !== primaryName) {
    results.push(`${hyphenatedName}.com`)
  }

  return results
}
