#!/usr/bin/env node
/**
 * seo-audit.mjs — Full SEO audit for rank-rent sites.
 *
 * Layer 1: Content pre-audit (reuses lib/content-audit.js checks)
 * Layer 2: Build — SITE=<slug> npm run build
 * Layer 3: Post-build HTML checks (lib/seo-audit.js)
 * Layer 4: Figure checks (lib/figure-schema.js + palette/provenance)
 * Layer 5: Portfolio checks (cross-site similarity, uniqueness, cadence)
 * Layer 6: Lighthouse (deferred — optional --lighthouse flag)
 * Layer 7: Report generation + console output
 *
 * Usage:
 *   node scripts/seo-audit.mjs <slug>              # one site
 *   node scripts/seo-audit.mjs --all               # all sites + portfolio
 *   node scripts/seo-audit.mjs --portfolio-only    # portfolio checks only (skip builds)
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { load as loadYaml } from 'js-yaml'
import { validateFigure } from '../lib/figure-schema.js'
import {
  extractHrefs,
  extractJsonLd,
  extractVisibleText,
  extractSvgContent,
  countH1Tags,
  checkHtmlLinks,
  checkSchemaJsonLd,
  checkDisclosure,
  checkPhoneInHtml,
  checkNoInterSiteLinks,
  checkCanonicalTag,
  checkSingleH1,
  checkFigureMinimum,
  checkFigureProvenance,
  checkFigurePalette,
  checkBrandSet,
  checkToolPagePresent,
  checkInformationalPages,
  checkCrossSiteSimilarity,
  checkShellTokenUniqueness,
  checkLaunchCadence,
  checkFigureDuplication,
} from '../lib/seo-audit.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const TEMPLATE = resolve(ROOT, 'template')
const TODAY = new Date().toISOString().slice(0, 10)

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const all = args.includes('--all')
const portfolioOnly = args.includes('--portfolio-only')
const slugArg = args.find(a => !a.startsWith('--'))

if (!all && !portfolioOnly && !slugArg) {
  console.error('Usage:')
  console.error('  node scripts/seo-audit.mjs <slug>              # audit one site')
  console.error('  node scripts/seo-audit.mjs --all               # audit all sites + portfolio')
  console.error('  node scripts/seo-audit.mjs --portfolio-only    # portfolio checks only')
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

function loadSiteYaml(slug) {
  return loadYaml(readFileSync(resolve(ROOT, 'sites', slug, 'site.yaml'), 'utf-8'))
}

function getDistPaths(slug) {
  const distDir = resolve(ROOT, 'dist', slug)
  if (!existsSync(distDir)) return new Set()
  const paths = new Set(['/'])
  function walk(dir, prefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('_')) {
        const slug = prefix + entry.name + '/'
        paths.add(slug)
        walk(resolve(dir, entry.name), slug)
      }
    }
  }
  walk(distDir, '/')
  return paths
}

function getHtmlFiles(slug) {
  const distDir = resolve(ROOT, 'dist', slug)
  if (!existsSync(distDir)) return []
  const files = []
  function walk(dir, prefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(resolve(dir, entry.name), prefix + entry.name + '/')
      } else if (entry.name === 'index.html') {
        files.push({ path: resolve(dir, entry.name), slug: prefix || '/' })
      }
    }
  }
  walk(distDir, '/')
  return files
}

function getFigureFiles(slug) {
  const figDir = resolve(ROOT, 'sites', slug, 'figures')
  if (!existsSync(figDir)) return []
  return readdirSync(figDir).filter(f => f.endsWith('.json'))
}

function loadFigure(slug, file) {
  return JSON.parse(readFileSync(resolve(ROOT, 'sites', slug, 'figures', file), 'utf-8'))
}

function getPortfolioDomains(allSlugs) {
  const domains = []
  for (const s of allSlugs) {
    const yaml = loadSiteYaml(s)
    if (yaml.domain) domains.push(yaml.domain)
  }
  return domains
}

// ── Build ───────────────────────────────────────────────────────────

function buildSite(slug) {
  console.log(`  Building ${slug}...`)
  try {
    execSync(`SITE=${slug} npm run build`, {
      cwd: TEMPLATE,
      stdio: 'pipe',
      timeout: 60000,
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.stderr?.toString() || err.message }
  }
}

// ── Per-page HTML audit ─────────────────────────────────────────────

function auditHtmlPage(htmlFile, distPaths, siteYaml, portfolioDomains) {
  const html = readFileSync(htmlFile.path, 'utf-8')
  const hrefs = extractHrefs(html)
  const jsonLd = extractJsonLd(html)

  // Determine page type from site.yaml
  const pageSlug = htmlFile.slug.endsWith('/')
    ? htmlFile.slug
    : htmlFile.slug + '/'
  const pageDef = (siteYaml.pages || []).find(p => {
    const s = p.slug.endsWith('/') || p.slug === '/' ? p.slug : p.slug + '/'
    return s === pageSlug
  })
  const pageType = pageDef?.type || 'unknown'

  const checks = []

  // Single H1
  const h1Result = checkSingleH1(html)
  checks.push({ check: 'Single H1', ...h1Result })

  // Internal links resolve
  const linkResult = checkHtmlLinks(hrefs, distPaths)
  checks.push({ check: 'HTML links', ...linkResult })

  // JSON-LD schema
  const schemaResult = checkSchemaJsonLd(jsonLd, pageType, siteYaml.brand)
  checks.push({ check: 'JSON-LD schema', ...schemaResult })

  // Disclosure
  const disclosureResult = checkDisclosure(html)
  checks.push({ check: 'Disclosure', ...disclosureResult })

  // Phone
  const phoneResult = checkPhoneInHtml(html, siteYaml.phone)
  checks.push({ check: 'Phone in HTML', ...phoneResult })

  // No inter-site links
  const interResult = checkNoInterSiteLinks(hrefs, portfolioDomains)
  checks.push({ check: 'No inter-site links', ...interResult })

  // Canonical (only on content pages, not 404; skip when domain is null pre-Gate 2)
  if (!htmlFile.slug.includes('404') && siteYaml.domain) {
    const canonicalResult = checkCanonicalTag(html)
    checks.push({ check: 'Canonical tag', ...canonicalResult })
  }

  const hasFail = checks.some(c => !c.pass)
  return {
    slug: htmlFile.slug,
    type: pageType,
    pass: !hasFail,
    checks,
    visibleText: extractVisibleText(html),
    svgs: extractSvgContent(html),
  }
}

// ── Per-site audit ──────────────────────────────────────────────────

function auditSite(slug, allSlugs) {
  const siteYaml = loadSiteYaml(slug)
  const portfolioDomains = getPortfolioDomains(allSlugs.filter(s => s !== slug))

  // Layer 2: Build
  const buildResult = buildSite(slug)
  if (!buildResult.success) {
    return {
      slug,
      verdict: 'FAIL',
      buildError: buildResult.error,
      pageResults: [],
      siteChecks: [{ check: 'Build', pass: false, issues: [buildResult.error] }],
      figureChecks: [],
    }
  }

  // Layer 3: HTML checks
  const distPaths = getDistPaths(slug)
  const htmlFiles = getHtmlFiles(slug)
  const pageResults = htmlFiles.map(f => auditHtmlPage(f, distPaths, siteYaml, portfolioDomains))

  // Layer 4: Figure checks
  const figureFiles = getFigureFiles(slug)
  const figureChecks = []

  // Figure minimum
  const pageTypes = (siteYaml.pages || []).map(p => p.type)
  const figMinResult = checkFigureMinimum(figureFiles, pageTypes)
  figureChecks.push({ check: 'Figure minimum (≥3)', ...figMinResult })

  // Figure provenance and palette
  for (const file of figureFiles) {
    const figure = loadFigure(slug, file)

    // Schema validation
    const schemaResult = validateFigure(figure)
    if (!schemaResult.valid) {
      figureChecks.push({ check: `Figure schema: ${file}`, pass: false, issues: schemaResult.errors })
    }

    // Provenance
    const provResult = checkFigureProvenance(figure)
    figureChecks.push({ check: `Provenance: ${file}`, ...provResult })
  }

  // Check SVGs in built pages for palette violations
  for (const pageResult of pageResults) {
    for (const svg of pageResult.svgs) {
      const palResult = checkFigurePalette(svg)
      if (!palResult.pass) {
        figureChecks.push({ check: `Palette: ${pageResult.slug}`, ...palResult })
      }
    }
  }

  // Per-site checks
  const siteChecks = []

  // Brand set
  const brandResult = checkBrandSet(siteYaml.brand)
  siteChecks.push({ check: 'Brand set', ...brandResult })

  // Tool page present
  const toolResult = checkToolPagePresent(pageTypes)
  siteChecks.push({ check: 'Tool page', ...toolResult })

  // Informational pages (≥2 guides)
  const infoResult = checkInformationalPages((siteYaml.pages || []).map(p => ({ type: p.type })))
  siteChecks.push({ check: 'Guide pages (≥2)', ...infoResult })

  // Build pass
  siteChecks.push({ check: 'Build', pass: true, issues: [] })

  // Determine overall verdict
  const allChecks = [
    ...pageResults.flatMap(p => p.checks),
    ...figureChecks,
    ...siteChecks,
  ]
  const hasFail = allChecks.some(c => !c.pass)

  return {
    slug,
    niche: siteYaml.niche,
    brand: siteYaml.brand,
    shell: siteYaml.design?.shell,
    tokens: siteYaml.design?.tokens,
    wave: siteYaml.design?.wave,
    verdict: hasFail ? 'FAIL' : 'PASS',
    pageResults,
    siteChecks,
    figureChecks,
  }
}

// ── Portfolio checks ────────────────────────────────────────────────

function runPortfolioChecks(results) {
  const issues = []

  // Shell+token uniqueness
  const configs = results
    .filter(r => r.shell && r.tokens)
    .map(r => ({ slug: r.slug, niche: r.niche, shell: r.shell, tokens: r.tokens }))
  if (configs.length > 0) {
    const stResult = checkShellTokenUniqueness(configs)
    issues.push(...stResult.issues.map(i => ({ severity: 'FAIL', message: i })))
  }

  // Launch cadence
  const waveSites = results
    .filter(r => r.wave)
    .map(r => ({ slug: r.slug, niche: r.niche, wave: r.wave }))
  if (waveSites.length > 0) {
    const lcResult = checkLaunchCadence(waveSites)
    issues.push(...lcResult.issues.map(i => ({ severity: 'FAIL', message: i })))
  }

  // Figure duplication within niche
  const figureSeries = []
  for (const r of results) {
    const figFiles = getFigureFiles(r.slug)
    for (const file of figFiles) {
      const fig = loadFigure(r.slug, file)
      figureSeries.push({
        slug: r.slug,
        niche: r.niche,
        series: JSON.stringify(fig.series),
      })
    }
  }
  if (figureSeries.length > 0) {
    const fdResult = checkFigureDuplication(figureSeries)
    issues.push(...fdResult.issues.map(i => ({ severity: 'FAIL', message: i })))
  }

  // Cross-site similarity (within same niche)
  const byNiche = new Map()
  for (const r of results) {
    if (!byNiche.has(r.niche)) byNiche.set(r.niche, [])
    const allText = r.pageResults?.map(p => p.visibleText || '').join(' ') || ''
    byNiche.get(r.niche).push({ slug: r.slug, text: allText })
  }
  for (const [niche, sites] of byNiche) {
    if (sites.length < 2) continue
    const texts = sites.map(s => s.text)
    const simResult = checkCrossSiteSimilarity(texts)
    for (const issue of simResult.issues) {
      const severity = issue.startsWith('FAIL') ? 'FAIL' : 'WARN'
      // Replace index-based references with slug names
      const replaced = issue.replace(/Sites (\d+) and (\d+)/, (_, i, j) =>
        `${sites[+i].slug} and ${sites[+j].slug}`
      )
      issues.push({ severity, message: `[${niche}] ${replaced}` })
    }
  }

  return issues
}

// ── Report generation ───────────────────────────────────────────────

function generateReport(result) {
  const lines = []
  lines.push(`# SEO Audit: ${result.slug}`)
  lines.push(`Date: ${TODAY}`)
  lines.push(`Verdict: **${result.verdict}**`)
  lines.push('')

  if (result.buildError) {
    lines.push('## Build Failed')
    lines.push('```')
    lines.push(result.buildError.slice(0, 2000))
    lines.push('```')
    return lines.join('\n')
  }

  // Page results summary
  const passPages = result.pageResults.filter(p => p.pass).length
  const failPages = result.pageResults.filter(p => !p.pass).length
  lines.push(`## Pages: ${passPages} pass, ${failPages} fail out of ${result.pageResults.length}`)
  lines.push('')

  // Failing page checks
  for (const page of result.pageResults) {
    const failChecks = page.checks.filter(c => !c.pass)
    if (failChecks.length > 0) {
      lines.push(`### ${page.slug} — FAIL`)
      for (const c of failChecks) {
        lines.push(`- **${c.check}**: ${c.issues.join('; ')}`)
      }
      lines.push('')
    }
  }

  // Site checks
  lines.push('## Site Checks')
  for (const c of result.siteChecks) {
    const icon = c.pass ? 'PASS' : 'FAIL'
    lines.push(`- ${icon} ${c.check}${c.issues.length > 0 ? ': ' + c.issues.join('; ') : ''}`)
  }
  lines.push('')

  // Figure checks
  if (result.figureChecks.length > 0) {
    lines.push('## Figure Checks')
    for (const c of result.figureChecks) {
      const icon = c.pass ? 'PASS' : 'FAIL'
      lines.push(`- ${icon} ${c.check}${c.issues.length > 0 ? ': ' + c.issues.join('; ') : ''}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Console output ──────────────────────────────────────────────────

function printSiteResult(result) {
  const icon = result.verdict === 'PASS' ? 'PASS' : 'FAIL'
  console.log(`\n  ${icon}  ${result.slug}`)

  if (result.buildError) {
    console.log(`       BUILD FAILED: ${result.buildError.split('\n')[0]}`)
    return
  }

  const pPass = result.pageResults.filter(p => p.pass).length
  const pFail = result.pageResults.filter(p => !p.pass).length
  console.log(`       Pages: ${pPass} pass, ${pFail} fail`)

  // Print failing checks
  for (const page of result.pageResults) {
    for (const c of page.checks.filter(c => !c.pass)) {
      console.log(`       FAIL  ${page.slug}: ${c.check} — ${c.issues.join('; ')}`)
    }
  }
  for (const c of result.siteChecks.filter(c => !c.pass)) {
    console.log(`       FAIL  ${c.check} — ${c.issues.join('; ')}`)
  }
  for (const c of result.figureChecks.filter(c => !c.pass)) {
    console.log(`       FAIL  ${c.check} — ${c.issues.join('; ')}`)
  }
}

// ── Main ────────────────────────────────────────────────────────────

const allSlugs = discoverSites()
const slugs = all || portfolioOnly ? allSlugs : [slugArg]

console.log(`SEO audit: ${slugs.length} site(s)`)

const results = []

if (!portfolioOnly) {
  for (const slug of slugs) {
    if (!existsSync(resolve(ROOT, 'sites', slug, 'site.yaml'))) {
      console.error(`  Site not found: ${slug}`)
      process.exit(1)
    }
    const result = auditSite(slug, allSlugs)
    results.push(result)
    printSiteResult(result)

    // Write per-site report
    const reportPath = resolve(ROOT, 'sites', slug, `seo-audit-${TODAY}.md`)
    writeFileSync(reportPath, generateReport(result))
  }
} else {
  // Portfolio-only: load existing build data without rebuilding
  for (const slug of slugs) {
    const siteYaml = loadSiteYaml(slug)
    const distDir = resolve(ROOT, 'dist', slug)
    if (!existsSync(distDir)) {
      console.log(`  SKIP  ${slug} — no build output found`)
      continue
    }
    const distPaths = getDistPaths(slug)
    const htmlFiles = getHtmlFiles(slug)
    const portfolioDomains = getPortfolioDomains(allSlugs.filter(s => s !== slug))
    const pageResults = htmlFiles.map(f => auditHtmlPage(f, distPaths, siteYaml, portfolioDomains))
    results.push({
      slug,
      niche: siteYaml.niche,
      brand: siteYaml.brand,
      shell: siteYaml.design?.shell,
      tokens: siteYaml.design?.tokens,
      wave: siteYaml.design?.wave,
      verdict: pageResults.some(p => !p.pass) ? 'FAIL' : 'PASS',
      pageResults,
      siteChecks: [],
      figureChecks: [],
    })
  }
}

// Portfolio-level checks
if ((all || portfolioOnly) && results.length > 1) {
  console.log('\n  ── Portfolio-level checks ──')
  const pIssues = runPortfolioChecks(results)
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
const totalFail = results.filter(r => r.verdict === 'FAIL').length
console.log(`\nTotal: ${totalPass} pass, ${totalFail} fail out of ${results.length} sites`)

if (!portfolioOnly) {
  console.log(`Reports written to sites/*/seo-audit-${TODAY}.md`)
}

process.exit(totalFail > 0 ? 1 : 0)
