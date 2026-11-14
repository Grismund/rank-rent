import { describe, it, expect } from 'vitest'
import {
  relativeLuminance,
  contrastRatio,
  checkContrast,
  parseTokenCSS,
  checkAllTokenFiles,
} from '../src/lib/contrast-check'

describe('relativeLuminance', () => {
  it('returns 0 for black', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 4)
  })

  it('returns 1 for white', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 4)
  })

  it('computes mid-grey correctly', () => {
    const lum = relativeLuminance('#808080')
    expect(lum).toBeGreaterThan(0.2)
    expect(lum).toBeLessThan(0.25)
  })
})

describe('contrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })

  it('returns 1:1 for identical colors', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 1)
  })

  it('is symmetric — order does not matter', () => {
    const ab = contrastRatio('#1B2430', '#FFFFFF')
    const ba = contrastRatio('#FFFFFF', '#1B2430')
    expect(ab).toBeCloseTo(ba, 4)
  })
})

describe('checkContrast', () => {
  it('passes AA normal at 4.5:1', () => {
    // black on white = 21:1, well above 4.5
    const result = checkContrast('#000000', '#FFFFFF', 'AA')
    expect(result.passes).toBe(true)
    expect(result.ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('fails AA normal below 4.5:1', () => {
    // #767676 on white ≈ 4.54:1, but #777 on white ≈ 4.48:1
    const result = checkContrast('#787878', '#FFFFFF', 'AA')
    // 4.39:1 — should fail
    expect(result.ratio).toBeLessThan(4.5)
    expect(result.passes).toBe(false)
  })

  it('passes AA-large at 3:1', () => {
    // #8E8E8E on white ≈ 3.28:1
    const result = checkContrast('#8E8E8E', '#FFFFFF', 'AA-large')
    expect(result.passes).toBe(true)
    expect(result.ratio).toBeGreaterThanOrEqual(3)
  })

  it('fails AA-large below 3:1', () => {
    // #A0A0A0 on white ≈ 2.57:1
    const result = checkContrast('#A0A0A0', '#FFFFFF', 'AA-large')
    expect(result.ratio).toBeLessThan(3)
    expect(result.passes).toBe(false)
  })

  it('checks accent-text on accent at AA level', () => {
    // epoxy-flooring-1: accent-text #141414 on accent #F2B134
    const result = checkContrast('#141414', '#F2B134', 'AA')
    expect(result.ratio).toBeGreaterThanOrEqual(4.5)
    expect(result.passes).toBe(true)
  })
})

describe('parseTokenCSS', () => {
  it('extracts hex values from a CSS string', () => {
    const css = `:root {
      --bg: #0F1115;
      --text: #F2F3F5;
      --muted: #A7ADB8;
      --accent: #F2B134;
      --accent-text: #141414;
    }`
    const tokens = parseTokenCSS(css)
    expect(tokens.bg).toBe('#0F1115')
    expect(tokens.text).toBe('#F2F3F5')
    expect(tokens.muted).toBe('#A7ADB8')
    expect(tokens.accent).toBe('#F2B134')
    expect(tokens['accent-text']).toBe('#141414')
  })

  it('handles lowercase hex', () => {
    const css = `:root { --bg: #ffffff; --text: #1b2430; }`
    const tokens = parseTokenCSS(css)
    expect(tokens.bg).toBe('#ffffff')
    expect(tokens.text).toBe('#1b2430')
  })
})

describe('checkAllTokenFiles', () => {
  it('returns pass/fail per file with failing pairs listed', async () => {
    const dir = new URL('../src/tokens', import.meta.url).pathname
    const results = await checkAllTokenFiles(dir)
    expect(results.length).toBe(16)

    for (const r of results) {
      expect(r).toHaveProperty('file')
      expect(r).toHaveProperty('pass')
      expect(r).toHaveProperty('checks')
      // Each check has pair name, ratio, required, and pass
      for (const c of r.checks) {
        expect(c).toHaveProperty('pair')
        expect(c).toHaveProperty('ratio')
        expect(c).toHaveProperty('required')
        expect(c).toHaveProperty('pass')
      }
    }
  })

  it('all 16 token files pass AA contrast requirements', async () => {
    const dir = new URL('../src/tokens', import.meta.url).pathname
    const results = await checkAllTokenFiles(dir)
    const failures = results.filter((r) => !r.pass)
    if (failures.length > 0) {
      const msg = failures
        .map(
          (f) =>
            `${f.file}: ${f.checks
              .filter((c) => !c.pass)
              .map((c) => `${c.pair} ${c.ratio.toFixed(2)}:1 < ${c.required}:1`)
              .join(', ')}`
        )
        .join('\n')
      expect.fail(`Token files failing AA:\n${msg}`)
    }
  })
})
