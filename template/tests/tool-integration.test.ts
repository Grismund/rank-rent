import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const toolsDir = resolve(import.meta.dirname, '../src/components/tools')
const toolShellDir = resolve(import.meta.dirname, '../src/components/sections/ToolShell')

// All 8 tool types from ASSIGNMENTS.md
const TOOL_TYPES = [
  'epoxy-cost-estimator',
  'bath-budget-estimator',
  'tint-law-and-cost',
  'load-size-estimator',
  'kitchen-budget-estimator',
  'pool-cost-estimator',
  'paver-sealing-estimator',
  'surface-cost-estimator',
]

describe('tool integration', () => {
  it('ToolRouter exports default', () => {
    const filePath = resolve(toolsDir, 'ToolRouter.tsx')
    expect(existsSync(filePath)).toBe(true)
    const content = readFileSync(filePath, 'utf-8')
    expect(content).toContain('export default')
  })

  it('ToolRouter TOOL_MAP contains all 8 tool types', () => {
    const content = readFileSync(resolve(toolsDir, 'ToolRouter.tsx'), 'utf-8')
    for (const type of TOOL_TYPES) {
      expect(content, `Missing tool type: ${type}`).toContain(`'${type}'`)
    }
  })

  for (const type of TOOL_TYPES) {
    it(`${type}.tsx exists`, () => {
      const filePath = resolve(toolsDir, `${type}.tsx`)
      expect(existsSync(filePath), `Missing: ${type}.tsx`).toBe(true)
    })

    it(`${type}.tsx imports tool-calcs`, () => {
      const content = readFileSync(resolve(toolsDir, `${type}.tsx`), 'utf-8')
      expect(content).toMatch(/from\s+['"].*tool-calcs['"]/)
    })

    it(`${type}.tsx imports figures`, () => {
      const content = readFileSync(resolve(toolsDir, `${type}.tsx`), 'utf-8')
      expect(content).toMatch(/from\s+['"].*figures['"]/)
    })
  }

  describe('ToolShell variants', () => {
    const variants = ['card', 'full', 'split']

    for (const variant of variants) {
      it(`${variant}.astro contains client:visible`, () => {
        const content = readFileSync(resolve(toolShellDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('client:visible')
      })

      it(`${variant}.astro contains <noscript> fallback`, () => {
        const content = readFileSync(resolve(toolShellDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('<noscript>')
      })

      it(`${variant}.astro imports ToolRouter`, () => {
        const content = readFileSync(resolve(toolShellDir, `${variant}.astro`), 'utf-8')
        expect(content).toContain('ToolRouter')
      })
    }
  })
})
