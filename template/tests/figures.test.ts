import { describe, it, expect } from 'vitest'
import { rangeBars, dotRange, columns } from '../src/lib/figures'
import type { FigureData } from '../src/lib/figures'

// --- Test data ---

const rangeData: FigureData = {
  title: 'Epoxy Flooring Cost by Finish Type',
  unit: '$/sq ft',
  series: [
    { label: 'Solid Color', low: 3, high: 7 },
    { label: 'Flake / Chip', low: 3, high: 7 },
    { label: 'Metallic', low: 5, high: 12 },
    { label: 'Polyaspartic', low: 4, high: 9 },
  ],
  source: { label: 'Niche brief job economics', url: 'https://example.com' },
  updated: '2026-11-14',
}

const singleValueData: FigureData = {
  title: 'Floor Coating Lifespan',
  unit: 'years',
  series: [
    { label: 'Epoxy', value: 15 },
    { label: 'Polyaspartic', value: 18 },
    { label: 'Paint', value: 3 },
  ],
  source: { label: 'Manufacturer specs' },
  updated: '2026-11-14',
}

const mixedData: FigureData = {
  title: 'Mixed Entry Types',
  unit: 'dollars',
  series: [
    { label: 'Range Item', low: 100, high: 200 },
    { label: 'Single Item', value: 150 },
  ],
  source: { label: 'Test data' },
  updated: '2026-11-14',
}

const sixSeriesData: FigureData = {
  title: 'Six Series',
  unit: 'units',
  series: [
    { label: 'A', low: 1, high: 10 },
    { label: 'B', low: 2, high: 20 },
    { label: 'C', low: 3, high: 30 },
    { label: 'D', low: 4, high: 40 },
    { label: 'E', low: 5, high: 50 },
    { label: 'F', low: 6, high: 60 },
  ],
  source: { label: 'Test' },
  updated: '2026-11-14',
}

const sevenSeriesData: FigureData = {
  title: 'Too Many',
  unit: 'units',
  series: [
    { label: 'A', low: 1, high: 10 },
    { label: 'B', low: 2, high: 20 },
    { label: 'C', low: 3, high: 30 },
    { label: 'D', low: 4, high: 40 },
    { label: 'E', low: 5, high: 50 },
    { label: 'F', low: 6, high: 60 },
    { label: 'G', low: 7, high: 70 },
  ],
  source: { label: 'Test' },
  updated: '2026-11-14',
}

const emptySeriesData: FigureData = {
  title: 'Empty',
  unit: 'units',
  series: [],
  source: { label: 'Test' },
  updated: '2026-11-14',
}

const fiveSeriesData: FigureData = {
  title: 'Five Categories',
  unit: 'count',
  series: [
    { label: 'A', value: 10 },
    { label: 'B', value: 20 },
    { label: 'C', value: 30 },
    { label: 'D', value: 40 },
    { label: 'E', value: 50 },
  ],
  source: { label: 'Test' },
  updated: '2026-11-14',
}

const fourSeriesData: FigureData = {
  title: 'Four Categories',
  unit: 'count',
  series: [
    { label: 'A', value: 10 },
    { label: 'B', value: 20 },
    { label: 'C', value: 30 },
    { label: 'D', value: 40 },
  ],
  source: { label: 'Test' },
  updated: '2026-11-14',
}

// --- Shared SVG structure tests ---

function assertValidSvg(svg: string) {
  expect(svg).toMatch(/^<svg\b/)
  expect(svg).toContain('viewBox')
  expect(svg).toContain('width="100%"')
  expect(svg).toContain('</svg>')
}

/** No hex literals (#RGB or #RRGGBB) in fill or stroke attributes. */
function assertNoHexInFillStroke(svg: string) {
  const hexInFillStroke = /(?:fill|stroke)\s*=\s*"#[0-9a-fA-F]{3,8}"/g
  expect(svg).not.toMatch(hexInFillStroke)
}

// --- rangeBars ---

describe('rangeBars', () => {
  it('returns valid SVG with viewBox and width="100%"', () => {
    assertValidSvg(rangeBars(rangeData))
  })

  it('contains no hex literals in fill/stroke attributes', () => {
    assertNoHexInFillStroke(rangeBars(rangeData))
  })

  it('renders one label per series entry', () => {
    const svg = rangeBars(rangeData)
    for (const entry of rangeData.series) {
      expect(svg).toContain(entry.label)
    }
  })

  it('includes low and high values in output', () => {
    const svg = rangeBars(rangeData)
    expect(svg).toContain('3')
    expect(svg).toContain('12')
  })

  it('renders bars with height ≤ 24', () => {
    const svg = rangeBars(rangeData)
    // Match height on <rect> elements only, not the root <svg> height
    const rectHeights = [...svg.matchAll(/<rect[^>]*height="(\d+(?:\.\d+)?)"/g)]
      .map((m) => parseFloat(m[1]))
    expect(rectHeights.length).toBeGreaterThan(0)
    for (const h of rectHeights) {
      expect(h).toBeLessThanOrEqual(24)
    }
  })

  it('uses rx="4" for rounded data-ends', () => {
    const svg = rangeBars(rangeData)
    expect(svg).toContain('rx="4"')
  })

  it('handles single-value entries alongside range entries', () => {
    const svg = rangeBars(mixedData)
    assertValidSvg(svg)
    expect(svg).toContain('Range Item')
    expect(svg).toContain('Single Item')
  })

  it('throws for empty series', () => {
    expect(() => rangeBars(emptySeriesData)).toThrow()
  })

  it('throws for > 6 series', () => {
    expect(() => rangeBars(sevenSeriesData)).toThrow()
  })

  it('accepts exactly 6 series', () => {
    const svg = rangeBars(sixSeriesData)
    assertValidSvg(svg)
  })

  it('output is under 6 KB for 6 series', () => {
    const svg = rangeBars(sixSeriesData)
    expect(new TextEncoder().encode(svg).length).toBeLessThan(6144)
  })
})

// --- dotRange ---

describe('dotRange', () => {
  it('returns valid SVG with viewBox and width="100%"', () => {
    assertValidSvg(dotRange(rangeData))
  })

  it('contains no hex literals in fill/stroke attributes', () => {
    assertNoHexInFillStroke(dotRange(rangeData))
  })

  it('renders dots connected by lines', () => {
    const svg = dotRange(rangeData)
    expect(svg).toContain('<circle')
    expect(svg).toContain('<line')
  })

  it('uses stroke-width="2" for connecting lines', () => {
    const svg = dotRange(rangeData)
    expect(svg).toContain('stroke-width="2"')
  })

  it('renders one label per series entry', () => {
    const svg = dotRange(rangeData)
    for (const entry of rangeData.series) {
      expect(svg).toContain(entry.label)
    }
  })

  it('handles single-value entries (dot without connecting line)', () => {
    const svg = dotRange(singleValueData)
    assertValidSvg(svg)
    expect(svg).toContain('<circle')
    expect(svg).toContain('Epoxy')
  })

  it('handles mixed range and single-value entries', () => {
    const svg = dotRange(mixedData)
    assertValidSvg(svg)
  })

  it('throws for empty series', () => {
    expect(() => dotRange(emptySeriesData)).toThrow()
  })

  it('throws for > 6 series', () => {
    expect(() => dotRange(sevenSeriesData)).toThrow()
  })

  it('output is under 6 KB for 6 series', () => {
    const svg = dotRange(sixSeriesData)
    expect(new TextEncoder().encode(svg).length).toBeLessThan(6144)
  })
})

// --- columns ---

describe('columns', () => {
  it('returns valid SVG with viewBox and width="100%"', () => {
    assertValidSvg(columns(singleValueData))
  })

  it('contains no hex literals in fill/stroke attributes', () => {
    assertNoHexInFillStroke(columns(singleValueData))
  })

  it('renders vertical bars', () => {
    const svg = columns(singleValueData)
    expect(svg).toContain('<rect')
  })

  it('throws for > 4 series', () => {
    expect(() => columns(fiveSeriesData)).toThrow()
  })

  it('accepts exactly 4 series', () => {
    const svg = columns(fourSeriesData)
    assertValidSvg(svg)
  })

  it('renders labels for each category', () => {
    const svg = columns(singleValueData)
    for (const entry of singleValueData.series) {
      expect(svg).toContain(entry.label)
    }
  })

  it('handles range entries in columns (uses midpoint)', () => {
    const twoRange: FigureData = {
      title: 'Two Ranges',
      unit: '$',
      series: [
        { label: 'Low', low: 10, high: 30 },
        { label: 'High', low: 50, high: 80 },
      ],
      source: { label: 'Test' },
      updated: '2026-11-14',
    }
    const svg = columns(twoRange)
    assertValidSvg(svg)
  })

  it('throws for empty series', () => {
    expect(() => columns(emptySeriesData)).toThrow()
  })

  it('output is under 6 KB for 4 series', () => {
    const svg = columns(fourSeriesData)
    expect(new TextEncoder().encode(svg).length).toBeLessThan(6144)
  })
})
