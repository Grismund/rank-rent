import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { resolve } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { load as loadYaml, dump as dumpYaml } from 'js-yaml'
import { resolveSite, persistSite } from '../src/lib/resolve-site'
import type { SiteConfig } from '../src/lib/resolve-site'

const rootDir = resolve(import.meta.dirname, '..')
// Use the real project root for reading ASSIGNMENTS.md and pack.yaml
const projectRoot = resolve(rootDir, '..')

describe('resolveSite', () => {
  it('loads site.yaml + pack.yaml + ASSIGNMENTS.md and returns SiteConfig', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    expect(config).toBeDefined()
    expect(config.slug).toBe('epoxy-flooring-orlando')
    expect(config.niche).toBe('epoxy-flooring')
    expect(config.city).toBe('Orlando')
    expect(config.state).toBe('Florida')
  })

  it('shell/tokens/orders come from ASSIGNMENTS.md', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    // From ASSIGNMENTS.md: Shell B, epoxy-flooring-2, O2/O2/O1
    expect(config.design.shell).toBe('B')
    expect(config.design.tokens).toBe('epoxy-flooring-2')
    expect(config.design.orders.home).toBe('O2')
    expect(config.design.orders.service).toBe('O2')
    expect(config.design.orders.town).toBe('O1')
  })

  it('component variants are seed-picked from allowed lists', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    const allowedServicesList = ['cards', 'list', 'tabs']
    const allowedProcess = ['steps', 'timeline', 'cards']
    expect(allowedServicesList).toContain(config.design.variants.ServicesList)
    expect(allowedProcess).toContain(config.design.variants.Process)
  })

  it('copy bank picks are seed-picked', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    expect(config.copy.nav.services).toBeDefined()
    expect(typeof config.copy.nav.services).toBe('string')
    expect(config.copy.cta.primary).toBeDefined()
    expect(config.copy.cta.secondary).toBeDefined()
  })

  it('classmap is seed-generated from vocab', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    expect(config.design.classmap).toBeDefined()
    expect(typeof config.design.classmap.callButton).toBe('string')
    expect(typeof config.design.classmap.heroWrap).toBe('string')
    expect(typeof config.design.classmap.navList).toBe('string')
  })

  it('same slug produces identical SiteConfig on repeated calls', () => {
    const c1 = resolveSite('epoxy-flooring-orlando', projectRoot)
    const c2 = resolveSite('epoxy-flooring-orlando', projectRoot)
    expect(c1).toEqual(c2)
  })

  it('ASSIGNMENTS.md override beats seed for shell, tokens, orders', () => {
    // Fort Myers is assigned Shell A, epoxy-flooring-1, O1/O1/O2
    const config = resolveSite('epoxy-flooring-fort-myers', projectRoot)
    expect(config.design.shell).toBe('A')
    expect(config.design.tokens).toBe('epoxy-flooring-1')
    expect(config.design.orders.home).toBe('O1')
    expect(config.design.orders.service).toBe('O1')
    expect(config.design.orders.town).toBe('O2')
  })

  it('tool config is populated', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    expect(config.tool).toBeDefined()
    expect(config.tool.type).toBe('epoxy-cost-estimator')
    expect(config.tool.slug).toBe('/epoxy-floor-cost-estimator/')
  })

  it('towns are populated', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    expect(config.towns.length).toBeGreaterThan(0)
    expect(config.towns).toContain('Winter Park')
  })

  it('pages are populated', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    expect(config.pages.length).toBeGreaterThan(0)
    const homePage = config.pages.find((p) => p.slug === '/')
    expect(homePage).toBeDefined()
    expect(homePage!.type).toBe('home')
  })

  it('disclosure is a number 1-4', () => {
    const config = resolveSite('epoxy-flooring-orlando', projectRoot)
    expect(config.copy.disclosure).toBeGreaterThanOrEqual(1)
    expect(config.copy.disclosure).toBeLessThanOrEqual(4)
    // Orlando is assigned disclosure 2
    expect(config.copy.disclosure).toBe(2)
  })
})

describe('persistSite', () => {
  const testSlug = '__test-persist-site__'
  const testDir = resolve(projectRoot, 'sites', testSlug)

  beforeAll(() => {
    // Create a temporary site dir with a minimal site.yaml
    if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })
    const minimalYaml = {
      niche: 'epoxy-flooring',
      display_name: 'Epoxy Flooring',
      city: 'Testville',
      state: 'Florida',
      brand: 'TBD',
      phone: null,
      domain: null,
      towns: ['Neartown'],
      pages: [
        {
          slug: '/',
          type: 'home',
          primary_keyword: 'epoxy flooring testville',
          h1: 'Epoxy Flooring in Testville',
          title: 'Epoxy Flooring Testville',
          meta_description_intent: 'Test',
          word_count: { min: 800, max: 1500 },
        },
      ],
    }
    writeFileSync(resolve(testDir, 'site.yaml'), dumpYaml(minimalYaml))
  })

  it('writes design/copy blocks into site.yaml', () => {
    const config = resolveSite(testSlug, projectRoot)
    persistSite(config, projectRoot)

    const raw = readFileSync(resolve(testDir, 'site.yaml'), 'utf-8')
    const data = loadYaml(raw) as Record<string, any>
    expect(data.design).toBeDefined()
    expect(data.design.variants).toBeDefined()
    expect(data.copy).toBeDefined()
    expect(data.copy.nav).toBeDefined()
  })

  it('re-running resolver on persisted site.yaml changes nothing (idempotent)', () => {
    // First resolve + persist
    const c1 = resolveSite(testSlug, projectRoot)
    persistSite(c1, projectRoot)
    const yaml1 = readFileSync(resolve(testDir, 'site.yaml'), 'utf-8')

    // Second resolve + persist
    const c2 = resolveSite(testSlug, projectRoot)
    persistSite(c2, projectRoot)
    const yaml2 = readFileSync(resolve(testDir, 'site.yaml'), 'utf-8')

    expect(yaml1).toBe(yaml2)
    expect(c1).toEqual(c2)
  })

  it('persisted picks in site.yaml are read back, not regenerated', () => {
    // Persist first
    const c1 = resolveSite(testSlug, projectRoot)
    persistSite(c1, projectRoot)

    // Manually change a persisted value
    const raw = readFileSync(resolve(testDir, 'site.yaml'), 'utf-8')
    const data = loadYaml(raw) as Record<string, any>
    data.design.variants.ServicesList = 'tabs'
    data.copy.nav.services = 'Custom Label'
    writeFileSync(resolve(testDir, 'site.yaml'), dumpYaml(data))

    // Re-resolve — should read the manual edits, not overwrite them
    const c2 = resolveSite(testSlug, projectRoot)
    expect(c2.design.variants.ServicesList).toBe('tabs')
    expect(c2.copy.nav.services).toBe('Custom Label')
  })

  // Clean up
  afterAll(async () => {
    const { rmSync } = await import('node:fs')
    rmSync(testDir, { recursive: true, force: true })
  })
})
