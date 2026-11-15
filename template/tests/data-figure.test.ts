import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const dataFigureDir = resolve(import.meta.dirname, '../src/components/sections/DataFigure')

const variants = ['range-bars', 'dot-range', 'columns']

describe('DataFigure section components', () => {
  it('all 3 variant files exist at expected paths', () => {
    for (const variant of variants) {
      const filePath = resolve(dataFigureDir, `${variant}.astro`)
      expect(existsSync(filePath), `Missing: DataFigure/${variant}.astro`).toBe(true)
    }
  })

  for (const variant of variants) {
    describe(`DataFigure/${variant}`, () => {
      it('contains <figure', () => {
        const content = readFileSync(resolve(dataFigureDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('<figure')
      })

      it('contains <figcaption', () => {
        const content = readFileSync(resolve(dataFigureDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('<figcaption')
      })

      it('contains role="img"', () => {
        const content = readFileSync(resolve(dataFigureDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('role="img"')
      })

      it('contains aria-label', () => {
        const content = readFileSync(resolve(dataFigureDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('aria-label')
      })

      it('contains <details for table fallback', () => {
        const content = readFileSync(resolve(dataFigureDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('<details')
      })

      it('contains <table for data fallback', () => {
        const content = readFileSync(resolve(dataFigureDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('<table')
      })

      it('does not contain <script or <canvas', () => {
        const content = readFileSync(resolve(dataFigureDir, `${variant}.astro`), 'utf-8')
        expect(content).not.toContain('<script')
        expect(content).not.toContain('<canvas')
      })

      it('imports from figures.ts', () => {
        const content = readFileSync(resolve(dataFigureDir, `${variant}.astro`), 'utf-8')
        expect(content).toMatch(/from\s+['"].*figures['"]/)
      })
    })
  }
})
