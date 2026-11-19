import { describe, it, expect } from 'vitest'
import { parseWaveAssignments, getTargetSlugs } from '../lib/wave-assignments.js'

// Sample ASSIGNMENTS.md text for testing
const SAMPLE_ASSIGNMENTS = `# Site Assignments

Some intro text.

## Assignments

| Site dir | Niche | City, ST | Shell | Tokens | Home / Service / Town order | Nav | CTA | Disclosure | Wave |
|---|---|---|---|---|---|---|---|---|---|
| epoxy-flooring-fort-myers | epoxy-flooring | Fort Myers, FL | A | epoxy-flooring-1 | O1 / O1 / O2 | N1 | C1 | 1 | 1 |
| epoxy-flooring-orlando | epoxy-flooring | Orlando, FL | B | epoxy-flooring-2 | O2 / O2 / O1 | N2 | C2 | 2 | 2 |
| bathroom-remodel-conroe | bathroom-remodel | Conroe, TX | A | bathroom-remodel-1 | O3 / O1 / O1 | N2 | C3 | 3 | 1 |
| window-tinting-goodyear | window-tinting | Goodyear, AZ | B | window-tinting-2 | O3 / O3 / O2 | N1 | C4 | 4 | 3 |

## Proposed brands
`

describe('parseWaveAssignments', () => {
  it('parses wave numbers from an assignments table', () => {
    const waveMap = parseWaveAssignments(SAMPLE_ASSIGNMENTS)
    expect(waveMap.get('epoxy-flooring-fort-myers')).toBe(1)
    expect(waveMap.get('epoxy-flooring-orlando')).toBe(2)
    expect(waveMap.get('bathroom-remodel-conroe')).toBe(1)
    expect(waveMap.get('window-tinting-goodyear')).toBe(3)
  })

  it('returns a Map with correct size', () => {
    const waveMap = parseWaveAssignments(SAMPLE_ASSIGNMENTS)
    expect(waveMap.size).toBe(4)
  })

  it('returns empty map for text with no assignments table', () => {
    const waveMap = parseWaveAssignments('# No table here\n\nJust text.')
    expect(waveMap.size).toBe(0)
  })

  it('stops reading at next ## heading', () => {
    const waveMap = parseWaveAssignments(SAMPLE_ASSIGNMENTS)
    // "Proposed brands" section starts after the table, so only 4 entries
    expect(waveMap.size).toBe(4)
  })

  it('handles lines with fewer than 10 columns gracefully', () => {
    const text = `## Assignments

| Site dir | Niche | City, ST | Shell | Tokens | Home / Service / Town order | Nav | CTA | Disclosure | Wave |
|---|---|---|---|---|---|---|---|---|---|
| valid-site | n | c | A | t | O1 | N1 | C1 | 1 | 2 |
| short-line | n | c |
`
    const waveMap = parseWaveAssignments(text)
    expect(waveMap.size).toBe(1)
    expect(waveMap.get('valid-site')).toBe(2)
  })
})

describe('getTargetSlugs', () => {
  const allSlugs = [
    'epoxy-flooring-fort-myers',
    'epoxy-flooring-orlando',
    'bathroom-remodel-conroe',
    'window-tinting-goodyear',
  ]

  const waveMap = new Map([
    ['epoxy-flooring-fort-myers', 1],
    ['epoxy-flooring-orlando', 2],
    ['bathroom-remodel-conroe', 1],
    ['window-tinting-goodyear', 3],
  ])

  it('returns a single slug when slugArg is provided', () => {
    const result = getTargetSlugs({ slugArg: 'epoxy-flooring-fort-myers', waveNum: null, allSlugs, waveMap })
    expect(result).toEqual(['epoxy-flooring-fort-myers'])
  })

  it('returns empty array when slugArg does not match any slug', () => {
    const result = getTargetSlugs({ slugArg: 'nonexistent', waveNum: null, allSlugs, waveMap })
    expect(result).toEqual([])
  })

  it('returns all slugs in the specified wave', () => {
    const result = getTargetSlugs({ slugArg: null, waveNum: 1, allSlugs, waveMap })
    expect(result).toEqual(['epoxy-flooring-fort-myers', 'bathroom-remodel-conroe'])
  })

  it('returns all slugs when neither slugArg nor waveNum is provided', () => {
    const result = getTargetSlugs({ slugArg: null, waveNum: null, allSlugs, waveMap })
    expect(result).toEqual(allSlugs)
  })

  it('returns empty array when wave has no matching slugs', () => {
    const result = getTargetSlugs({ slugArg: null, waveNum: 99, allSlugs, waveMap })
    expect(result).toEqual([])
  })

  it('preserves original order of allSlugs', () => {
    const result = getTargetSlugs({ slugArg: null, waveNum: 1, allSlugs, waveMap })
    expect(result[0]).toBe('epoxy-flooring-fort-myers')
    expect(result[1]).toBe('bathroom-remodel-conroe')
  })
})
