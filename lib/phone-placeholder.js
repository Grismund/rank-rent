/**
 * Insert [PHONE] placeholder into a town page's CTA section.
 *
 * Finds the last H2 section and replaces "Request a free estimate/quote"
 * with "Call [PHONE] or request a free estimate/quote".
 *
 * @param {string} body - Markdown body text
 * @returns {{ modified: string, inserted: boolean }}
 */
export function insertPhonePlaceholder(body) {
  if (body.includes('[PHONE]')) {
    return { modified: body, inserted: false }
  }

  // Split into H2 sections
  const h2Pattern = /^## /m
  const parts = body.split(h2Pattern)
  if (parts.length < 2) {
    return { modified: body, inserted: false }
  }

  // Work on the last H2 section
  const lastIndex = parts.length - 1
  const lastSection = parts[lastIndex]

  // Match "Request a free estimate" or "Request a quote" (case-insensitive first letter)
  const requestPattern = /[Rr]equest a (free estimate|quote)/
  const match = lastSection.match(requestPattern)

  if (!match) {
    return { modified: body, inserted: false }
  }

  const original = match[0]
  const lowered = original.charAt(0).toLowerCase() + original.slice(1)
  const replacement = `Call [PHONE] or ${lowered}`

  const modifiedSection = lastSection.replace(requestPattern, replacement)
  parts[lastIndex] = modifiedSection

  // Rejoin with the ## prefix (first part has no prefix)
  const modified = parts[0] + parts.slice(1).map(p => '## ' + p).join('')

  return { modified, inserted: true }
}
