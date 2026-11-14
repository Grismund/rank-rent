import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const layoutsDir = resolve(import.meta.dirname, '../src/layouts')

const SHELLS = ['ShellA', 'ShellB', 'ShellC', 'ShellD']

function readShell(name: string): string {
  return readFileSync(resolve(layoutsDir, `${name}.astro`), 'utf-8')
}

describe('shell layouts', () => {
  it('all four shell files exist', () => {
    for (const shell of SHELLS) {
      const filePath = resolve(layoutsDir, `${shell}.astro`)
      expect(existsSync(filePath), `Missing: ${shell}.astro`).toBe(true)
    }
  })

  it('each shell has distinct template structure', () => {
    // Each shell uses unique CSS class prefixes (shell-a, shell-b, etc.)
    // and different structural patterns — verify uniqueness via class names
    const signatures = SHELLS.map((shell) => {
      const content = readShell(shell)
      const parts = content.split('---')
      const template = parts.slice(2).join('---')
      // Extract all class="..." values to fingerprint the structure
      const classes = (template.match(/class="[^"]+"/g) || []).join('|')
      return classes
    })
    const unique = new Set(signatures)
    expect(unique.size, 'All four shells should have distinct class structures').toBe(4)
  })

  it('phone tel: link in each shell header region', () => {
    for (const shell of SHELLS) {
      const content = readShell(shell)
      expect(
        content.includes('tel:'),
        `${shell}.astro missing tel: link`
      ).toBe(true)
    }
  })

  it('id="main-content" present in each shell', () => {
    for (const shell of SHELLS) {
      const content = readShell(shell)
      expect(
        content.includes('id="main-content"'),
        `${shell}.astro missing id="main-content"`
      ).toBe(true)
    }
  })

  it('exactly one <h1> in each shell template', () => {
    for (const shell of SHELLS) {
      const content = readShell(shell)
      // Count <h1 occurrences (opening tags only)
      const h1Count = (content.match(/<h1[\s>]/g) || []).length
      expect(h1Count, `${shell}.astro has ${h1Count} <h1> tags, expected 1`).toBe(1)
    }
  })

  it('disclosure reference in each shell footer', () => {
    for (const shell of SHELLS) {
      const content = readShell(shell)
      expect(
        content.toLowerCase().includes('disclosure'),
        `${shell}.astro missing disclosure reference in footer`
      ).toBe(true)
    }
  })

  it('Shell D has no <img or <picture in hero', () => {
    const content = readShell('ShellD')
    // Get hero section — between header and main
    const heroMatch = content.match(/hero/i)
    if (heroMatch) {
      // Check the hero area specifically — D has no image hero
      // Simpler: just check the whole template has no <img or <picture in the hero-related sections
      const templatePart = content.split('---').slice(2).join('---')
      // Find the hero section
      const heroStart = templatePart.indexOf('hero')
      const mainStart = templatePart.indexOf('id="main-content"')
      if (heroStart !== -1 && mainStart !== -1) {
        const heroPart = templatePart.slice(heroStart, mainStart)
        expect(heroPart.includes('<img'), 'ShellD hero contains <img').toBe(false)
        expect(heroPart.includes('<picture'), 'ShellD hero contains <picture').toBe(false)
      }
    }
  })
})
