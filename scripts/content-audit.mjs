#!/usr/bin/env node
/**
 * content-audit.mjs — Content pre-audit for rank-rent sites.
 *
 * Runs 14 checks beyond what write-content.mjs --validate covers.
 * Produces per-site markdown audit reports and a portfolio-level summary.
 *
 * Usage:
 *   node scripts/content-audit.mjs <slug>       # audit one site
 *   node scripts/content-audit.mjs --all        # audit all 18 sites + portfolio checks
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { loadHashes, buildHashSummary } from '../lib/content-hashes.js'
import {
  validateMetaDescription,
  extractMarkdownLinks,
  validateInternalLinks,
  validateSchemaFrontmatter,
  checkBrandUniqueness,
  checkTitleUniqueness,
  checkH1Uniqueness,
  validateTownPageDepth,
  validateFaqConsistency,
  checkPhonePlaceholder,
  checkSourcesPopulated,
  extractH2Sequence,
  checkH2SequenceUniqueness,
  checkHashCoverage,
} from '../lib/content-audit.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const TODAY = new Date().toISOString().slice(0, 10)

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const all = args.includes('--all')
const slugArg = args.find(a => !a.startsWith('--'))

if (!all && !slugArg) {
  console.error('Usage:')
  console.error('  node scripts/content-audit.mjs <slug>       # audit one site')
  console.error('  node scripts/content-audit.mjs --all        # audit all sites + portfolio checks')
  process.exit(1)
}

// ── Helpers ─────────────────────────────────────────────────────────

function discoverSites() {
  const sitesDir = resolve(ROOT, 'sites')
  return readdirSync(sitesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
    .map(d => d.name)
    .sort()
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  return loadYaml(match[1]) || {}
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

function loadSiteYaml(slug) {
  const path = resolve(ROOT, 'sites', slug, 'site.yaml')
  return loadYaml(readFileSync(path, 'utf-8'))
}

function getSitePageSlugs(siteYaml) {
  const slugs = new Set()
  for (const page of siteYaml.pages || []) {
    slugs.add(page.slug.endsWith('/') || page.slug === '/' ? page.slug : page.slug + '/')
  }
  return slugs
}

function getContentFiles(slug) {
  const contentDir = resolve(ROOT, 'sites', slug, 'content')
  if (!existsSync(contentDir)) return []
  return readdirSync(contentDir).filter(f => f.endsWith('.md')).sort()
}

// ── Per-page audit ──────────────────────────────────────────────────

function auditPage(slug, file, siteYaml, pageSlugs, portfolioDomains) {
  const filePath = resolve(ROOT, 'sites', slug, 'content', file)
  const raw = readFileSync(filePath, 'utf-8')
  const fm = parseFrontmatter(raw)
  const body = stripFrontmatter(raw)
  const checks = []

  if (!body.trim()) {
    return { file, status: 'SKIP', checks: [{ check: 'Body content', result: 'SKIP', detail: 'Empty body' }] }
  }

  // Check 1+2: Meta description length + keyword
  const metaResult = validateMetaDescription(fm)
  checks.push({
    check: 'Meta description',
    result: metaResult.issues.length === 0 ? 'PASS'
      : metaResult.issues.some(i => i.severity === 'FAIL') ? 'FAIL' : 'WARN',
    detail: metaResult.issues.length === 0
      ? `${(fm.meta_description || '').length} chars`
      : metaResult.issues.map(i => i.message).join('; '),
  })

  // Check 3+4: Internal links + portfolio cross-links
  const links = extractMarkdownLinks(body)
  const allLinks = [...links.internal, ...links.external]
  const linkResult = validateInternalLinks(allLinks, pageSlugs, portfolioDomains)
  checks.push({
    check: 'Internal links',
    result: linkResult.pass ? 'PASS' : 'FAIL',
    detail: linkResult.pass
      ? `${links.internal.length} links, 0 broken`
      : linkResult.issues.map(i => i.message).join('; '),
  })

  // Check 5: Schema frontmatter
  const schemaResult = validateSchemaFrontmatter(fm)
  checks.push({
    check: 'Schema',
    result: schemaResult.pass ? 'PASS' : 'FAIL',
    detail: schemaResult.pass
      ? (fm.schema ? (Array.isArray(fm.schema) ? fm.schema.join(', ') : fm.schema) : '(not required)')
      : schemaResult.issues.map(i => i.message).join('; '),
  })

  // Check 9: Town page depth (town pages only)
  if (fm.type === 'town') {
    const townResult = validateTownPageDepth(body, fm)
    checks.push({
      check: 'Town depth',
      result: townResult.pass ? 'PASS' : 'FAIL',
      detail: townResult.pass
        ? 'permits heading + service links present'
        : townResult.issues.map(i => i.message).join('; '),
    })
  }

  // Check 10: FAQ consistency (pages with faqs[])
  if (fm.faqs && fm.faqs.length > 0) {
    const faqResult = validateFaqConsistency(fm, body)
    checks.push({
      check: 'FAQ consistency',
      result: faqResult.pass ? 'PASS' : 'WARN',
      detail: faqResult.pass
        ? `${fm.faqs.length} FAQs match`
        : faqResult.issues.map(i => i.message).join('; '),
    })
  }

  // Check 11: Phone placeholder
  const phoneResult = checkPhonePlaceholder(body, fm.type)
  checks.push({
    check: 'Phone placeholder',
    result: phoneResult.issues.length === 0 ? 'PASS' : 'WARN',
    detail: phoneResult.issues.length === 0 ? '' : phoneResult.issues[0].message,
  })

  // Check 12: Sources populated
  const srcResult = checkSourcesPopulated(fm)
  if (srcResult.issues.length > 0 || ['cost_guide', 'tool', 'guide'].includes(fm.type)) {
    checks.push({
      check: 'Sources',
      result: srcResult.pass ? 'PASS' : 'WARN',
      detail: srcResult.pass
        ? `${(fm.sources || []).length} sources`
        : srcResult.issues.map(i => i.message).join('; '),
    })
  }

  // Determine overall page status
  const hasFail = checks.some(c => c.result === 'FAIL')
  const hasWarn = checks.some(c => c.result === 'WARN')
  const status = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS'

  return { file, status, checks }
}

// ── Per-site audit ──────────────────────────────────────────────────

function auditSite(slug, portfolioDomains) {
  const siteYaml = loadSiteYaml(slug)
  const pageSlugs = getSitePageSlugs(siteYaml)
  const contentFiles = getContentFiles(slug)

  // Page-level checks
  const pageResults = contentFiles.map(file =>
    auditPage(slug, file, siteYaml, pageSlugs, portfolioDomains)
  )

  // Site-level checks
  const siteChecks = []

  // Check 6 (partial): Report brand
  siteChecks.push({
    check: 'Brand',
    result: 'PASS',
    detail: siteYaml.brand || '(null)',
  })

  // Check 7: Title uniqueness
  const pageMeta = contentFiles.map(file => {
    const raw = readFileSync(resolve(ROOT, 'sites', slug, 'content', file), 'utf-8')
    const fm = parseFrontmatter(raw)
    return { file, title: fm.title, h1: fm.h1 }
  })
  const titleResult = checkTitleUniqueness(pageMeta)
  siteChecks.push({
    check: 'Title uniqueness',
    result: titleResult.pass ? 'PASS' : 'FAIL',
    detail: titleResult.pass
      ? `${pageMeta.filter(p => p.title).length} unique`
      : titleResult.issues.map(i => i.message).join('; '),
  })

  // Check 8: H1 uniqueness
  const h1Result = checkH1Uniqueness(pageMeta)
  siteChecks.push({
    check: 'H1 uniqueness',
    result: h1Result.pass ? 'PASS' : 'FAIL',
    detail: h1Result.pass
      ? `${pageMeta.filter(p => p.h1).length} unique`
      : h1Result.issues.map(i => i.message).join('; '),
  })

  // Source check summaries for cost_guide/tool/guide pages
  for (const type of ['cost_guide', 'tool', 'guide']) {
    const matches = contentFiles.filter(file => {
      const raw = readFileSync(resolve(ROOT, 'sites', slug, 'content', file), 'utf-8')
      return parseFrontmatter(raw).type === type
    })
    if (matches.length > 0) {
      const allHaveSources = matches.every(file => {
        const raw = readFileSync(resolve(ROOT, 'sites', slug, 'content', file), 'utf-8')
        const fm = parseFrontmatter(raw)
        return fm.sources && fm.sources.length > 0
      })
      siteChecks.push({
        check: `Sources: ${type}`,
        result: allHaveSources ? 'PASS' : 'WARN',
        detail: allHaveSources
          ? `${matches.length} page(s) with sources`
          : `Some ${type} pages missing sources`,
      })
    }
  }

  // Determine overall site status
  const allChecks = [...pageResults.flatMap(p => p.checks), ...siteChecks]
  const hasFail = allChecks.some(c => c.result === 'FAIL')
  const hasWarn = allChecks.some(c => c.result === 'WARN')

  return {
    slug,
    niche: siteYaml.niche,
    brand: siteYaml.brand,
    verdict: hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS',
    pageResults,
    siteChecks,
  }
}

// ── Report generation ───────────────────────────────────────────────

function generateReport(result) {
  const lines = []
  lines.push(`# Content Pre-Audit: ${result.slug}`)
  lines.push(`Date: ${TODAY}`)
  lines.push(`Verdict: ${result.verdict}`)
  lines.push('')

  // Summary
  const passCount = result.pageResults.filter(p => p.status === 'PASS').length
  const warnCount = result.pageResults.filter(p => p.status === 'WARN').length
  const failCount = result.pageResults.filter(p => p.status === 'FAIL').length
  const skipCount = result.pageResults.filter(p => p.status === 'SKIP').length
  lines.push('## Summary')
  lines.push(`Pages: ${result.pageResults.length} | Pass: ${passCount} | Warn: ${warnCount} | Fail: ${failCount}${skipCount ? ` | Skip: ${skipCount}` : ''}`)
  lines.push('')

  // Page results
  lines.push('## Page Results')
  lines.push('')
  for (const page of result.pageResults) {
    lines.push(`### ${page.file} — ${page.status}`)
    lines.push('| Check | Result | Detail |')
    lines.push('|-------|--------|--------|')
    for (const c of page.checks) {
      lines.push(`| ${c.check} | ${c.result} | ${c.detail} |`)
    }
    lines.push('')
  }

  // Site-level checks
  lines.push('## Site-Level Checks')
  lines.push('| Check | Result | Detail |')
  lines.push('|-------|--------|--------|')
  for (const c of result.siteChecks) {
    lines.push(`| ${c.check} | ${c.result} | ${c.detail} |`)
  }
  lines.push('')

  return lines.join('\n')
}

// ── Portfolio-level checks ──────────────────────────────────────────

async function portfolioChecks(siteResults) {
  const issues = []

  // Check 6: Brand uniqueness
  const brands = siteResults.map(r => ({ slug: r.slug, brand: r.brand }))
  const brandResult = checkBrandUniqueness(brands)
  issues.push(...brandResult.issues)

  // Check 13: H2 sequence uniqueness across same-niche sites
  const sitesByNiche = {}
  for (const result of siteResults) {
    const niche = result.niche
    if (!sitesByNiche[niche]) sitesByNiche[niche] = {}

    for (const page of result.pageResults) {
      if (page.status === 'SKIP') continue
      const filePath = resolve(ROOT, 'sites', result.slug, 'content', page.file)
      const raw = readFileSync(filePath, 'utf-8')
      const fm = parseFrontmatter(raw)
      const body = stripFrontmatter(raw)
      const h2s = extractH2Sequence(body)
      const type = fm.type

      if (!sitesByNiche[niche][type]) sitesByNiche[niche][type] = []
      sitesByNiche[niche][type].push(h2s)
    }
  }
  const h2Result = checkH2SequenceUniqueness(sitesByNiche)
  issues.push(...h2Result.issues)

  // Check 14: Content hash coverage
  const hashPath = resolve(ROOT, 'data/content-hashes.json')
  const hashes = await loadHashes(hashPath)
  const expectedNiches = [...new Set(siteResults.map(r => r.niche))].sort()
  const hashResult = checkHashCoverage(hashes, expectedNiches)
  issues.push(...hashResult.issues)

  return issues
}

// ── Console output ──────────────────────────────────────────────────

function printSiteResult(result) {
  const icon = result.verdict === 'PASS' ? 'PASS' : result.verdict === 'WARN' ? 'WARN' : 'FAIL'
  console.log(`\n  ${icon}  ${result.slug}`)

  let pPass = 0, pWarn = 0, pFail = 0
  for (const page of result.pageResults) {
    if (page.status === 'FAIL') pFail++
    else if (page.status === 'WARN') pWarn++
    else if (page.status === 'PASS') pPass++
  }
  console.log(`       Pages: ${pPass} pass, ${pWarn} warn, ${pFail} fail`)

  // Print any failing checks
  for (const page of result.pageResults) {
    const failChecks = page.checks.filter(c => c.result === 'FAIL')
    for (const c of failChecks) {
      console.log(`       FAIL  ${page.file}: ${c.check} — ${c.detail}`)
    }
  }

  // Print site-level failures
  for (const c of result.siteChecks) {
    if (c.result === 'FAIL') {
      console.log(`       FAIL  ${c.check} — ${c.detail}`)
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────

const slugs = all ? discoverSites() : [slugArg]
const portfolioDomains = [] // All domains are null pre-purchase

console.log(`Content pre-audit: ${slugs.length} site(s)`)

const results = []
for (const slug of slugs) {
  if (!existsSync(resolve(ROOT, 'sites', slug, 'site.yaml'))) {
    console.error(`  Site not found: ${slug}`)
    process.exit(1)
  }
  const result = auditSite(slug, portfolioDomains)
  results.push(result)
  printSiteResult(result)

  // Write per-site report
  const reportPath = resolve(ROOT, 'sites', slug, `audit-${TODAY}.md`)
  writeFileSync(reportPath, generateReport(result))
}

// Portfolio-level checks (only with --all)
if (all && results.length > 1) {
  console.log('\n  ── Portfolio-level checks ──')
  const pIssues = await portfolioChecks(results)
  if (pIssues.length === 0) {
    console.log('  All portfolio checks pass')
  } else {
    for (const issue of pIssues) {
      console.log(`  ${issue.severity}  ${issue.message}`)
    }
  }
}

// Final summary
const totalPass = results.filter(r => r.verdict === 'PASS').length
const totalWarn = results.filter(r => r.verdict === 'WARN').length
const totalFail = results.filter(r => r.verdict === 'FAIL').length
console.log(`\nTotal: ${totalPass} pass, ${totalWarn} warn, ${totalFail} fail out of ${results.length} sites`)
console.log(`Reports written to sites/*/audit-${TODAY}.md`)

process.exit(totalFail > 0 ? 1 : 0)
