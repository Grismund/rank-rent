import { describe, it, expect } from 'vitest'
import { extractPriceRanges, generateSources } from '../lib/source-populator.js'

// --- extractPriceRanges ---

describe('extractPriceRanges', () => {
  it('extracts $X to $Y ranges', () => {
    const text = 'Solid-color coatings start around $3 to $7 per square foot.'
    const ranges = extractPriceRanges(text)
    expect(ranges).toContainEqual({ range: '$3 to $7', context: 'per square foot' })
  })

  it('extracts $X–$Y (en-dash) ranges', () => {
    const text = 'Most jobs fall between $1,600–$3,500 installed.'
    const ranges = extractPriceRanges(text)
    expect(ranges.some(r => r.range === '$1,600–$3,500')).toBe(true)
  })

  it('extracts $X-$Y (hyphen) ranges', () => {
    const text = 'Flake finishes run $4-$7 per square foot.'
    const ranges = extractPriceRanges(text)
    expect(ranges.some(r => r.range === '$4-$7')).toBe(true)
  })

  it('returns empty array when no prices found', () => {
    const text = 'Epoxy flooring is a great investment for any home.'
    expect(extractPriceRanges(text)).toHaveLength(0)
  })

  it('extracts multiple ranges from text', () => {
    const text = 'Solid coatings $3–$7 per sq ft. Metallic runs $5–$12 per sq ft.'
    const ranges = extractPriceRanges(text)
    expect(ranges.length).toBeGreaterThanOrEqual(2)
  })
})

// --- generateSources ---

describe('generateSources', () => {
  const costGuideBody = [
    '## How Much Does Epoxy Flooring Cost?',
    '',
    'Most residential garage floor projects run $1,600 to $3,500 installed.',
    'Solid-color coatings start at $3 to $7 per square foot.',
    'Flake finishes run $4 to $7. Metallic systems range from $5 to $12.',
  ].join('\n')

  it('generates 2-3 sources for a cost_guide page', () => {
    const sources = generateSources({
      body: costGuideBody,
      pageType: 'cost_guide',
      nicheJobValue: '$1,600–$3,500',
    })
    expect(sources.length).toBeGreaterThanOrEqual(2)
    expect(sources.length).toBeLessThanOrEqual(3)
  })

  it('includes niche brief reference as first source', () => {
    const sources = generateSources({
      body: costGuideBody,
      pageType: 'cost_guide',
      nicheJobValue: '$1,600–$3,500',
    })
    expect(sources[0]).toMatch(/^Niche brief:/)
    expect(sources[0]).toContain('$1,600–$3,500')
  })

  it('includes pricing detail from body as second source', () => {
    const sources = generateSources({
      body: costGuideBody,
      pageType: 'cost_guide',
      nicheJobValue: '$1,600–$3,500',
    })
    expect(sources[1]).toMatch(/\$/)
  })

  it('generates sources for a tool page', () => {
    const toolBody = [
      '## Calculator',
      '',
      'Enter your garage dimensions. Standard two-car garage is 400 sq ft.',
      'Solid color: $3–$7/sq ft. Flake: $4–$7/sq ft. Metallic: $5–$12/sq ft.',
    ].join('\n')
    const sources = generateSources({
      body: toolBody,
      pageType: 'tool',
      nicheJobValue: '$1,600–$3,500',
    })
    expect(sources.length).toBeGreaterThanOrEqual(2)
    expect(sources[0]).toMatch(/^Niche brief:/)
  })

  it('generates sources for a guide page', () => {
    const guideBody = [
      '## Epoxy vs Polyaspartic',
      '',
      'Standard epoxy costs $3 to $7 per square foot.',
      'Polyaspartic coatings run $4 to $10 per square foot.',
    ].join('\n')
    const sources = generateSources({
      body: guideBody,
      pageType: 'guide',
      nicheJobValue: '$1,600–$3,500',
    })
    expect(sources.length).toBeGreaterThanOrEqual(2)
    expect(sources[0]).toMatch(/^Niche brief:/)
  })

  it('handles body with no price ranges gracefully', () => {
    const sources = generateSources({
      body: 'This guide explains the basics of flooring care.',
      pageType: 'guide',
      nicheJobValue: '$1,600–$3,500',
    })
    expect(sources.length).toBeGreaterThanOrEqual(1)
    expect(sources[0]).toMatch(/^Niche brief:/)
  })
})
