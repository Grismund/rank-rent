/**
 * Parse a niche economics markdown table into a lookup Map.
 * @param {string} markdownContent - Contents of reference/niche-economics.md
 * @returns {Map<string, {avgJobLow: number, avgJobHigh: number, marginLow: number, marginHigh: number, notes: string}>}
 */
export function parseNicheEconomics(markdownContent) {
  const result = new Map()
  if (!markdownContent) return result

  const lines = markdownContent.split('\n')
  let inTable = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue

    // Split cells
    const cells = trimmed.split('|').map((c) => c.trim()).filter(Boolean)
    if (cells.length < 4) continue

    // Skip header row
    if (cells[0].toLowerCase() === 'niche') {
      inTable = true
      continue
    }
    // Skip separator row
    if (/^-+$/.test(cells[0])) continue

    if (!inTable) continue

    const niche = cells[0].toLowerCase()
    const jobValue = cells[1]
    const margin = cells[2]
    const notes = cells[3]

    const { low: avgJobLow, high: avgJobHigh } = parseDollarRange(jobValue)
    const { low: marginLow, high: marginHigh } = parsePercentRange(margin)

    result.set(niche, { avgJobLow, avgJobHigh, marginLow, marginHigh, notes })
  }

  return result
}

function parseDollarRange(str) {
  const nums = str.match(/[\d,]+(?:\.\d+)?/g)
  if (!nums || nums.length === 0) return { low: 0, high: 0 }
  const values = nums.map((n) => parseFloat(n.replace(/,/g, '')))
  return { low: values[0], high: values.length > 1 ? values[1] : values[0] }
}

function parsePercentRange(str) {
  const cleaned = str.replace(/~/g, '')
  const nums = cleaned.match(/[\d.]+/g)
  if (!nums || nums.length === 0) return { low: 0, high: 0 }
  const values = nums.map((n) => parseFloat(n) / 100)
  return { low: values[0], high: values.length > 1 ? values[1] : values[0] }
}
