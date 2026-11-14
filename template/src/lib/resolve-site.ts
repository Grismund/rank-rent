import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { load as loadYaml, dump as dumpYaml } from 'js-yaml'
import { createSeed, seedPick } from './seed'
import { SECTION_ORDERS, type OrderSet } from '../config/section-orders'
import { COPY_BANKS } from '../config/copy-banks'
import { CLASSMAP_VOCAB } from '../config/classmap-vocab'

// --- Types ---

export interface PageConfig {
  slug: string
  type: string
  primary_keyword: string
  h1: string
  title: string
  meta_description_intent: string
  word_count: { min: number; max: number }
  schema?: string | string[]
}

export interface SiteConfig {
  slug: string
  niche: string
  city: string
  state: string
  brand: string
  phone: string | null
  domain: string | null
  design: {
    shell: 'A' | 'B' | 'C' | 'D'
    tokens: string
    orders: Record<string, OrderSet>
    variants: Record<string, string>
    classmap: Record<string, string>
  }
  copy: {
    nav: Record<string, string>
    cta: { primary: string; secondary: string }
    form_heading: string
    disclosure: number
    trust_heading: string
  }
  tool: { slug: string; type: string; primary_keyword: string }
  towns: string[]
  pages: PageConfig[]
}

// --- Variant lists (from template-architecture.md §4.4) ---

const VARIANT_OPTIONS: Record<string, string[]> = {
  ServicesList: ['cards', 'list', 'tabs'],
  AreasServed: ['chips', 'columns', 'table'],
  Process: ['steps', 'timeline', 'cards'],
  TrustBlock: ['disclosure-first', 'stat-free-facts', 'checklist'],
  FAQ: ['details', 'open-list', 'two-column'],
  CostTable: ['table', 'range-bars', 'cards'],
  CTABand: ['band', 'card', 'inline'],
  Breadcrumbs: ['slash', 'chevron', 'arrow'],
  ToolShell: ['card', 'full', 'split'],
  DataFigure: ['range-bars', 'dot-range', 'columns'],
}

// --- ASSIGNMENTS.md parser ---

interface Assignment {
  shell: 'A' | 'B' | 'C' | 'D'
  tokens: string
  orders: { home: OrderSet; service: OrderSet; town: OrderSet }
  nav: number
  cta: number
  disclosure: number
  wave: number
  toolSlug?: string
  toolType?: string
}

function parseAssignments(content: string): Map<string, Assignment> {
  const map = new Map<string, Assignment>()

  // Find the main assignments table
  const lines = content.split('\n')
  let inTable = false

  for (const line of lines) {
    if (line.startsWith('| Site dir |')) {
      inTable = true
      continue
    }
    if (inTable && line.startsWith('|---')) continue
    if (inTable && line.startsWith('|')) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c)
      if (cells.length < 10) continue

      const slug = cells[0]
      const shell = cells[3] as 'A' | 'B' | 'C' | 'D'
      const tokens = cells[4]

      // Parse "O1 / O2 / O3" format for home/service/town
      const orderParts = cells[5].split('/').map((s) => s.trim()) as OrderSet[]
      const orders = {
        home: orderParts[0],
        service: orderParts[1],
        town: orderParts[2],
      }

      const nav = parseInt(cells[6].replace('N', ''))
      const cta = parseInt(cells[7].replace('C', ''))
      const disclosure = parseInt(cells[8])
      const wave = parseInt(cells[9])

      map.set(slug, { shell, tokens, orders, nav, cta, disclosure, wave })
    } else if (inTable && !line.startsWith('|')) {
      inTable = false
    }
  }

  // Parse tool slugs table
  let inToolTable = false
  for (const line of lines) {
    if (line.startsWith('| Site dir | Tool type |')) {
      inToolTable = true
      continue
    }
    if (inToolTable && line.startsWith('|---')) continue
    if (inToolTable && line.startsWith('|')) {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c)
      if (cells.length < 3) continue
      const slug = cells[0]
      const entry = map.get(slug)
      if (entry) {
        entry.toolType = cells[1]
        entry.toolSlug = cells[2]
      }
    } else if (inToolTable && !line.startsWith('|')) {
      inToolTable = false
    }
  }

  return map
}

// --- Resolver ---

export function resolveSite(slug: string, rootDir: string): SiteConfig {
  // 1. Read site.yaml
  const siteYamlPath = resolve(rootDir, 'sites', slug, 'site.yaml')
  const siteRaw = readFileSync(siteYamlPath, 'utf-8')
  const siteData = loadYaml(siteRaw) as Record<string, any>

  const niche = siteData.niche as string
  const city = siteData.city as string
  const state = siteData.state as string

  // 2. Read ASSIGNMENTS.md
  const assignmentsPath = resolve(rootDir, 'sites', 'ASSIGNMENTS.md')
  let assignment: Assignment | undefined
  if (existsSync(assignmentsPath)) {
    const content = readFileSync(assignmentsPath, 'utf-8')
    const assignments = parseAssignments(content)
    assignment = assignments.get(slug)
  }

  // 3. Create seed
  const seed = createSeed(slug)

  // 4. Determine design values — ASSIGNMENTS.md overrides seed
  const shell: SiteConfig['design']['shell'] = siteData.design?.shell ??
    assignment?.shell ??
    seedPick(seed, ['A', 'B', 'C', 'D'] as const, 'shell')

  const tokens: string = siteData.design?.tokens ??
    assignment?.tokens ??
    `${niche}-1`

  // Section orders: explicit assignment for home/service/town, seed for the rest
  const orders: Record<string, OrderSet> = {}
  const pageTypes = ['home', 'service', 'town', 'guide', 'cost_guide', 'faq', 'tool']
  for (const pt of pageTypes) {
    if (siteData.design?.order?.[pt]) {
      orders[pt] = siteData.design.order[pt]
    } else if (assignment?.orders && (pt === 'home' || pt === 'service' || pt === 'town')) {
      orders[pt] = assignment.orders[pt as keyof typeof assignment.orders]
    } else {
      orders[pt] = seedPick(seed, ['O1', 'O2', 'O3'] as OrderSet[], `order.${pt}`)
    }
  }

  // 5. Component variants — read persisted or seed-pick
  const variants: Record<string, string> = {}
  for (const [key, options] of Object.entries(VARIANT_OPTIONS)) {
    if (siteData.design?.variants?.[key]) {
      variants[key] = siteData.design.variants[key]
    } else {
      variants[key] = seedPick(seed, options, `variant.${key}`)
    }
  }

  // 6. Classmap — read persisted or seed-generate
  let classmap: Record<string, string> = {}
  if (siteData.design?.classmap && typeof siteData.design.classmap === 'object') {
    classmap = siteData.design.classmap
  } else {
    for (const [key, candidates] of Object.entries(CLASSMAP_VOCAB)) {
      classmap[key] = seedPick(seed, candidates, `cls.${key}`)
    }
  }

  // 7. Copy banks — read persisted or seed-pick by assigned index
  const navBankIndex = (assignment?.nav ?? 1) - 1
  const ctaBankIndex = (assignment?.cta ?? 1) - 1
  const disclosure = siteData.copy?.disclosure ?? assignment?.disclosure ?? 1

  const nav: Record<string, string> = {}
  for (const navKey of ['services', 'areas', 'cost', 'faq', 'about']) {
    const bankKey = `nav.${navKey}`
    if (siteData.copy?.nav?.[navKey]) {
      nav[navKey] = siteData.copy.nav[navKey]
    } else {
      const bank = COPY_BANKS[bankKey]
      nav[navKey] = bank[navBankIndex % bank.length]
    }
  }

  const ctaPrimary = siteData.copy?.cta?.primary ??
    COPY_BANKS['cta.primary'][ctaBankIndex % COPY_BANKS['cta.primary'].length]
  const ctaSecondary = siteData.copy?.cta?.secondary ??
    COPY_BANKS['cta.secondary'][ctaBankIndex % COPY_BANKS['cta.secondary'].length]
  const formHeading = siteData.copy?.form_heading ??
    COPY_BANKS['form.heading'][navBankIndex % COPY_BANKS['form.heading'].length]
  const trustHeading = siteData.copy?.trust_heading ??
    seedPick(seed, COPY_BANKS['trust.heading'], 'trust.heading')

  // 8. Tool config
  const toolSlug = assignment?.toolSlug ??
    siteData.pages?.find((p: any) => p.type === 'tool')?.slug ??
    null
  const toolType = assignment?.toolType ?? siteData.tool?.type ?? null
  const toolPage = siteData.pages?.find((p: any) => p.type === 'tool')
  const toolPrimaryKeyword = toolPage?.primary_keyword ?? ''

  const tool = {
    slug: toolSlug ?? '',
    type: toolType ?? '',
    primary_keyword: toolPrimaryKeyword,
  }

  // 9. Build SiteConfig
  return {
    slug,
    niche,
    city,
    state,
    brand: siteData.brand ?? 'TBD',
    phone: siteData.phone ?? null,
    domain: siteData.domain ?? null,
    design: {
      shell,
      tokens,
      orders,
      variants,
      classmap,
    },
    copy: {
      nav,
      cta: { primary: ctaPrimary, secondary: ctaSecondary },
      form_heading: formHeading,
      disclosure,
      trust_heading: trustHeading,
    },
    tool,
    towns: siteData.towns ?? [],
    pages: (siteData.pages ?? []).map((p: any) => ({
      slug: p.slug,
      type: p.type,
      primary_keyword: p.primary_keyword,
      h1: p.h1,
      title: p.title,
      meta_description_intent: p.meta_description_intent,
      word_count: p.word_count,
      schema: p.schema,
    })),
  }
}

/**
 * Persist resolved picks back into site.yaml.
 * Writes design and copy blocks without overwriting existing values.
 */
export function persistSite(config: SiteConfig, rootDir: string): void {
  const siteYamlPath = resolve(rootDir, 'sites', config.slug, 'site.yaml')
  const raw = readFileSync(siteYamlPath, 'utf-8')
  const data = loadYaml(raw) as Record<string, any>

  // Merge design block — don't overwrite if already set
  if (!data.design) data.design = {}
  if (!data.design.shell) data.design.shell = config.design.shell
  if (!data.design.tokens) data.design.tokens = config.design.tokens
  if (!data.design.order) data.design.order = {}
  for (const [pt, order] of Object.entries(config.design.orders)) {
    if (!data.design.order[pt]) data.design.order[pt] = order
  }
  if (!data.design.variants) data.design.variants = {}
  for (const [key, val] of Object.entries(config.design.variants)) {
    if (!data.design.variants[key]) data.design.variants[key] = val
  }
  if (!data.design.classmap || typeof data.design.classmap === 'string') {
    data.design.classmap = config.design.classmap
  }

  // Merge copy block
  if (!data.copy) data.copy = {}
  if (!data.copy.nav) data.copy.nav = {}
  for (const [key, val] of Object.entries(config.copy.nav)) {
    if (!data.copy.nav[key]) data.copy.nav[key] = val
  }
  if (!data.copy.cta) data.copy.cta = {}
  if (!data.copy.cta.primary) data.copy.cta.primary = config.copy.cta.primary
  if (!data.copy.cta.secondary) data.copy.cta.secondary = config.copy.cta.secondary
  if (!data.copy.form_heading) data.copy.form_heading = config.copy.form_heading
  if (!data.copy.disclosure) data.copy.disclosure = config.copy.disclosure
  if (!data.copy.trust_heading) data.copy.trust_heading = config.copy.trust_heading

  writeFileSync(siteYamlPath, dumpYaml(data, { lineWidth: 120 }))
}
