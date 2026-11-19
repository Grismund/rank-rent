/**
 * Shared wave-assignment helpers extracted from domains.mjs / phone.mjs.
 * Parses the ASSIGNMENTS.md table and filters slugs by wave or single target.
 */

/**
 * Parse the ASSIGNMENTS.md markdown table into a Map of slug → wave number.
 * @param {string} text - Full ASSIGNMENTS.md content
 * @returns {Map<string, number>}
 */
export function parseWaveAssignments(text) {
  const lines = text.split('\n')
  const waveMap = new Map()

  let inTable = false
  let headerSkipped = false

  for (const line of lines) {
    if (line.startsWith('## Assignments')) { inTable = true; continue }
    if (inTable && line.startsWith('## ')) break
    if (!inTable) continue
    if (line.startsWith('| Site dir')) { headerSkipped = false; continue }
    if (line.startsWith('|---')) { headerSkipped = true; continue }
    if (!headerSkipped) continue

    const cells = line.split('|').map(c => c.trim()).filter(c => c)
    if (cells.length >= 10) {
      waveMap.set(cells[0], parseInt(cells[9], 10))
    }
  }
  return waveMap
}

/**
 * Filter a list of slugs by CLI target (single slug, wave number, or all).
 * @param {object} opts
 * @param {string|null} opts.slugArg - Single slug target, or null
 * @param {number|null} opts.waveNum - Wave number filter, or null
 * @param {string[]} opts.allSlugs - All available slugs (sorted)
 * @param {Map<string, number>} opts.waveMap - slug → wave from parseWaveAssignments
 * @returns {string[]}
 */
export function getTargetSlugs({ slugArg, waveNum, allSlugs, waveMap }) {
  if (slugArg) {
    return allSlugs.includes(slugArg) ? [slugArg] : []
  }
  if (waveNum !== null) {
    return allSlugs.filter(s => waveMap.get(s) === waveNum)
  }
  return [...allSlugs]
}
