import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateFigure } from '../lib/figure-schema.js'

// --- Minimal valid figure fixture ---

function makeValidFigure() {
  return {
    title: 'Epoxy Cost by Garage Size',
    unit: 'dollars',
    series: [
      { label: '1-Car Garage (~250 sq ft)', low: 1200, high: 2500 },
      { label: '2-Car Garage (~450 sq ft)', low: 1600, high: 3500 },
      { label: '3-Car Garage (~700 sq ft)', low: 2400, high: 5000 },
    ],
    source: {
      label: 'Niche brief job economics',
    },
    updated: '2026-11-14',
  }
}

// --- Tests ---

describe('validateFigure', () => {
  it('validates a complete figure with low/high ranges', () => {
    const result = validateFigure(makeValidFigure())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('validates a figure with single values instead of low/high', () => {
    const fig = makeValidFigure()
    fig.series = [
      { label: 'Professional Epoxy', value: 15 },
      { label: 'Polyaspartic', value: 17.5 },
      { label: 'Garage Floor Paint', value: 3.5 },
    ]
    const result = validateFigure(fig)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects figure missing title', () => {
    const fig = makeValidFigure()
    delete fig.title
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('title'))).toBe(true)
  })

  it('rejects figure with empty title', () => {
    const fig = makeValidFigure()
    fig.title = ''
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('title'))).toBe(true)
  })

  it('rejects figure missing unit', () => {
    const fig = makeValidFigure()
    delete fig.unit
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('unit'))).toBe(true)
  })

  it('rejects figure missing series', () => {
    const fig = makeValidFigure()
    delete fig.series
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('series'))).toBe(true)
  })

  it('rejects figure with empty series', () => {
    const fig = makeValidFigure()
    fig.series = []
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('series'))).toBe(true)
  })

  it('rejects series with more than 6 categories', () => {
    const fig = makeValidFigure()
    fig.series = Array.from({ length: 7 }, (_, i) => ({
      label: `Category ${i + 1}`,
      low: i * 10,
      high: i * 10 + 5,
    }))
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('6'))).toBe(true)
  })

  it('rejects series entry without label', () => {
    const fig = makeValidFigure()
    delete fig.series[1].label
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('label'))).toBe(true)
  })

  it('rejects series entry without data (no low/high and no value)', () => {
    const fig = makeValidFigure()
    fig.series[0] = { label: 'Missing Data' }
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('low/high') || e.includes('value'))).toBe(true)
  })

  it('rejects figure missing source', () => {
    const fig = makeValidFigure()
    delete fig.source
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('source'))).toBe(true)
  })

  it('rejects source without label', () => {
    const fig = makeValidFigure()
    fig.source = { url: 'https://example.com' }
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('source.label'))).toBe(true)
  })

  it('rejects figure missing updated', () => {
    const fig = makeValidFigure()
    delete fig.updated
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('updated'))).toBe(true)
  })

  it('rejects non-ISO updated string', () => {
    const fig = makeValidFigure()
    fig.updated = 'November 14, 2026'
    const result = validateFigure(fig)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('updated'))).toBe(true)
  })

  it('accepts source with optional url and brief_section', () => {
    const fig = makeValidFigure()
    fig.source.url = 'https://example.com/data'
    fig.source.brief_section = 'Job Economics'
    const result = validateFigure(fig)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('actual figure files validate', () => {
  const figDir = join(import.meta.dirname, '..', 'sites', 'epoxy-flooring-new-braunfels', 'figures')
  const files = ['epoxy-cost-tool-result.json', 'epoxy-cost-by-finish.json', 'epoxy-lifespan-comparison.json']

  for (const file of files) {
    it(`${file} passes validation`, () => {
      const data = JSON.parse(readFileSync(join(figDir, file), 'utf-8'))
      const result = validateFigure(data)
      expect(result.errors).toEqual([])
      expect(result.valid).toBe(true)
    })
  }
})
