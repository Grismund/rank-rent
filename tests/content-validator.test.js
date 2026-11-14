import { describe, it, expect } from 'vitest'
import {
  validateWordCount,
  detectBannedClaims,
  checkKeywordInFirstWords,
  validateTitleLength,
  validateMetaDescriptionLength,
  detectDuplicateH2s,
  validateTownFacts,
  detectNearDuplicateContent,
} from '../lib/content-validator.js'

// --- validateWordCount ---

describe('validateWordCount', () => {
  it('passes when word count is within target range', () => {
    const text = 'word '.repeat(600)
    const result = validateWordCount(text, { min: 500, max: 1000 })
    expect(result.valid).toBe(true)
  })

  it('fails when word count is below minimum', () => {
    const text = 'word '.repeat(100)
    const result = validateWordCount(text, { min: 500, max: 1000 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/below minimum/)
  })

  it('fails when word count exceeds maximum', () => {
    const text = 'word '.repeat(1200)
    const result = validateWordCount(text, { min: 500, max: 1000 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/exceeds maximum/)
  })

  it('strips frontmatter before counting', () => {
    const text = '---\ntitle: "Test"\ntype: home\n---\n' + 'word '.repeat(600)
    const result = validateWordCount(text, { min: 500, max: 1000 })
    expect(result.valid).toBe(true)
  })
})

// --- detectBannedClaims ---

describe('detectBannedClaims', () => {
  it('returns empty array for clean content', () => {
    const text = 'We connect homeowners with local epoxy contractors in New Braunfels.'
    expect(detectBannedClaims(text)).toHaveLength(0)
  })

  it('detects "serving since" claims', () => {
    const text = 'We have been serving Dallas since 2015 with quality work.'
    const results = detectBannedClaims(text)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.match.includes('serving') && r.match.includes('since'))).toBe(true)
  })

  it('detects "licensed and insured" claims', () => {
    const text = 'Our contractors are licensed and insured for your protection.'
    const results = detectBannedClaims(text)
    expect(results.length).toBeGreaterThan(0)
  })

  it('detects "team of N" claims', () => {
    const text = 'Our team of 20 professionals is ready to serve you.'
    const results = detectBannedClaims(text)
    expect(results.length).toBeGreaterThan(0)
  })

  it('detects "voted #1" claims', () => {
    const text = 'Voted #1 epoxy company in San Antonio.'
    const results = detectBannedClaims(text)
    expect(results.length).toBeGreaterThan(0)
  })

  it('detects "satisfaction guaranteed" claims', () => {
    const text = 'We offer 100% satisfaction guaranteed on every job.'
    const results = detectBannedClaims(text)
    expect(results.length).toBeGreaterThan(0)
  })
})

// --- checkKeywordInFirstWords ---

describe('checkKeywordInFirstWords', () => {
  it('passes when keyword appears in first 100 words', () => {
    const text = '---\ntitle: test\n---\nIf you need epoxy flooring new braunfels has many options. ' + 'filler '.repeat(200)
    const result = checkKeywordInFirstWords(text, 'epoxy flooring new braunfels', 100)
    expect(result.valid).toBe(true)
  })

  it('fails when keyword is missing from first 100 words', () => {
    const text = '---\ntitle: test\n---\n' + 'filler '.repeat(200) + ' epoxy flooring new braunfels appears here.'
    const result = checkKeywordInFirstWords(text, 'epoxy flooring new braunfels', 100)
    expect(result.valid).toBe(false)
  })

  it('is case insensitive', () => {
    const text = '---\ntitle: test\n---\nEpoxy Flooring New Braunfels is a popular service.'
    const result = checkKeywordInFirstWords(text, 'epoxy flooring new braunfels', 100)
    expect(result.valid).toBe(true)
  })
})

// --- validateTitleLength ---

describe('validateTitleLength', () => {
  it('passes for title under 60 chars', () => {
    const result = validateTitleLength('Epoxy Flooring New Braunfels | Comal Epoxy Floors')
    expect(result.valid).toBe(true)
  })

  it('fails for title over 60 chars', () => {
    const result = validateTitleLength('A'.repeat(61))
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/60/)
  })

  it('passes at exactly 60 chars', () => {
    const result = validateTitleLength('A'.repeat(60))
    expect(result.valid).toBe(true)
  })
})

// --- validateMetaDescriptionLength ---

describe('validateMetaDescriptionLength', () => {
  it('passes for meta description 120-160 chars', () => {
    const result = validateMetaDescriptionLength('A'.repeat(140))
    expect(result.valid).toBe(true)
  })

  it('fails for meta description under 120 chars', () => {
    const result = validateMetaDescriptionLength('A'.repeat(100))
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/120/)
  })

  it('fails for meta description over 160 chars', () => {
    const result = validateMetaDescriptionLength('A'.repeat(170))
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/160/)
  })
})

// --- detectDuplicateH2s ---

describe('detectDuplicateH2s', () => {
  it('returns empty for unique H2s', () => {
    const text = '## First Heading\n\nContent\n\n## Second Heading\n\nMore content'
    expect(detectDuplicateH2s(text)).toHaveLength(0)
  })

  it('detects duplicate H2s', () => {
    const text = '## Same Heading\n\nContent\n\n## Same Heading\n\nMore content'
    const dupes = detectDuplicateH2s(text)
    expect(dupes).toHaveLength(1)
    expect(dupes[0]).toBe('Same Heading')
  })
})

// --- validateTownFacts ---

describe('validateTownFacts', () => {
  it('passes when town page has 3+ local facts', () => {
    const result = validateTownFacts(['fact 1', 'fact 2', 'fact 3'])
    expect(result.valid).toBe(true)
  })

  it('fails when town page has fewer than 3 facts', () => {
    const result = validateTownFacts(['fact 1', 'fact 2'])
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/3/)
  })

  it('fails when town_facts is empty', () => {
    const result = validateTownFacts([])
    expect(result.valid).toBe(false)
  })
})

// --- detectNearDuplicateContent ---

describe('detectNearDuplicateContent', () => {
  it('returns low overlap for substantially different content', () => {
    const a = 'Epoxy flooring services in San Marcos Texas. The Balcones Escarpment creates unique foundation conditions. Texas State University drives the local economy. Kissing Tree retirement community needs garage coatings.'
    const b = 'Epoxy flooring in Canyon Lake Texas. This lakefront community relies on boat storage in garages. The unincorporated area falls under Comal County jurisdiction. Vacation homes benefit from sealed concrete floors.'
    const result = detectNearDuplicateContent(a, b)
    expect(result.overlapPercent).toBeLessThan(40)
  })

  it('detects high overlap between nearly identical content', () => {
    const a = 'Epoxy flooring in New Braunfels is a popular service. The concrete preparation process involves diamond grinding. Chemical resistance protects against oil and brake fluid spills.'
    const b = 'Epoxy flooring in Seguin is a popular service. The concrete preparation process involves diamond grinding. Chemical resistance protects against oil and brake fluid spills.'
    const result = detectNearDuplicateContent(a, b)
    expect(result.overlapPercent).toBeGreaterThan(40)
  })
})
