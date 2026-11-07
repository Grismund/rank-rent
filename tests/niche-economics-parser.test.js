import { describe, it, expect } from 'vitest'
import { parseNicheEconomics } from '../lib/niche-economics-parser.js'

describe('parseNicheEconomics', () => {
  const validTable = `# Niche Economics Reference

| Niche | Avg Job Value | Margin | Source/Notes |
|-------|--------------|--------|-------------|
| junk removal | $300–$500 | 60–70% | Half to full truck load |
| air duct cleaning | $390–$500 | 40–55% | NADCA-standard work higher |
| foundation repair | $4,000–$8,000 | 30–50% | High ticket |
`

  it('parses a valid markdown table into a Map keyed by niche', () => {
    const result = parseNicheEconomics(validTable)
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(3)
    expect(result.has('junk removal')).toBe(true)
    expect(result.has('air duct cleaning')).toBe(true)
    expect(result.has('foundation repair')).toBe(true)
  })

  it('extracts avgJobLow and avgJobHigh from dollar ranges', () => {
    const result = parseNicheEconomics(validTable)
    const junk = result.get('junk removal')
    expect(junk.avgJobLow).toBe(300)
    expect(junk.avgJobHigh).toBe(500)
  })

  it('extracts marginLow and marginHigh from percent ranges', () => {
    const result = parseNicheEconomics(validTable)
    const junk = result.get('junk removal')
    expect(junk.marginLow).toBe(0.60)
    expect(junk.marginHigh).toBe(0.70)
  })

  it('handles comma-formatted dollar amounts', () => {
    const md = `# Niche Economics Reference

| Niche | Avg Job Value | Margin | Source/Notes |
|-------|--------------|--------|-------------|
| foundation repair | $4,000–$8,000 | 30–50% | High ticket |
`
    const result = parseNicheEconomics(md)
    const fr = result.get('foundation repair')
    expect(fr.avgJobLow).toBe(4000)
    expect(fr.avgJobHigh).toBe(8000)
  })

  it('preserves the source/notes string', () => {
    const result = parseNicheEconomics(validTable)
    expect(result.get('junk removal').notes).toBe('Half to full truck load')
    expect(result.get('foundation repair').notes).toBe('High ticket')
  })

  it('returns an empty Map for empty input', () => {
    const result = parseNicheEconomics('')
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it('returns an empty Map when there is no table', () => {
    const md = `# Niche Economics Reference

Some text without a table.
`
    const result = parseNicheEconomics(md)
    expect(result.size).toBe(0)
  })

  it('skips the header separator row', () => {
    const result = parseNicheEconomics(validTable)
    // Should not have a key like '-------' or '---'
    for (const key of result.keys()) {
      expect(key).not.toMatch(/^-+$/)
    }
  })

  it('handles tilde prefix on margin values', () => {
    const md = `# Niche Economics Reference

| Niche | Avg Job Value | Margin | Source/Notes |
|-------|--------------|--------|-------------|
| dryer vent cleaning | $104–$188 | ~40% | Often bundled |
`
    const result = parseNicheEconomics(md)
    const dvc = result.get('dryer vent cleaning')
    expect(dvc.marginLow).toBe(0.40)
    expect(dvc.marginHigh).toBe(0.40)
  })

  it('lowercases niche names for consistent lookup', () => {
    const md = `# Niche Economics Reference

| Niche | Avg Job Value | Margin | Source/Notes |
|-------|--------------|--------|-------------|
| Junk Removal | $300–$500 | 60–70% | test |
`
    const result = parseNicheEconomics(md)
    expect(result.has('junk removal')).toBe(true)
    expect(result.has('Junk Removal')).toBe(false)
  })
})
