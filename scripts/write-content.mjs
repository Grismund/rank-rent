#!/usr/bin/env node
/**
 * write-content.mjs — Validate written content and report quality metrics.
 *
 * Usage:
 *   node scripts/write-content.mjs --validate <slug>   # validate one site
 *   node scripts/write-content.mjs --validate --all     # validate all sites
 *   node scripts/write-content.mjs --summary            # hash counts + coverage
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import {
  validateWordCount,
  detectBannedClaims,
  checkKeywordInFirstWords,
  validateTitleLength,
  detectDuplicateH2s,
  validateTownFacts,
  detectNearDuplicateContent,
} from '../lib/content-validator.js'
import { validateFigure } from '../lib/figure-schema.js'
import { loadHashes, buildHashSummary } from '../lib/content-hashes.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const validate = args.includes('--validate')
const summary = args.includes('--summary')
const all = args.includes('--all')
const slugArg = args.find(a => !a.startsWith('--'))

if (!validate && !summary) {
  console.error('Usage:')
  console.error('  node scripts/write-content.mjs --validate <slug>')
  console.error('  node scripts/write-content.mjs --validate --all')
  console.error('  node scripts/write-content.mjs --summary')
  process.exit(1)
}

// ── Helpers ─────────────────────────────────────────────────────────

function discoverSites() {
  const sitesDir = resolve(ROOT, 'sites')
  return readdirSync(sitesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
    .map(d => d.name)
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  return loadYaml(match[1]) || {}
}

function hasBodyContent(text) {
  const body = stripFrontmatter(text).trim()
  return body.length > 0
}

// Word count targets by page type (from content-rules.md)
const WORD_COUNT_TARGETS = {
  home: { min: 800, max: 1500 },
  service: { min: 500, max: 1000 },
  town: { min: 500, max: 1000 },
  cost_guide: { min: 500, max: 1000 },
  tool: { min: 300, max: 800 },
  faq: { min: 400, max: 1000 },
  guide: { min: 600, max: 1500 },
}

// ── Per-page validation ─────────────────────────────────────────────

function validatePage(filePath, siteYaml) {
  const raw = readFileSync(filePath, 'utf-8')
  const fm = parseFrontmatter(raw)
  const body = stripFrontmatter(raw)
  const issues = []
  let status = 'PASS'

  // No body content — report but not an error
  if (!hasBodyContent(raw)) {
    return { page: basename(filePath, '.md'), wordCount: 0, status: 'SKIP', issues: ['No body content'] }
  }

  // Word count
  const target = fm.word_count_target || WORD_COUNT_TARGETS[fm.type] || { min: 300, max: 1500 }
  const wcResult = validateWordCount(raw, target)
  if (!wcResult.valid) {
    issues.push(wcResult.error)
    status = 'FAIL'
  }

  // Banned claims
  const banned = detectBannedClaims(body)
  if (banned.length > 0) {
    for (const b of banned) {
      issues.push(`Banned claim: "${b.match}" (${b.pattern})`)
    }
    status = 'FAIL'
  }

  // Keyword in first 100 words
  if (fm.primary_keyword) {
    const kwResult = checkKeywordInFirstWords(raw, fm.primary_keyword, 100)
    if (!kwResult.valid) {
      issues.push(kwResult.error)
      if (status !== 'FAIL') status = 'WARN'
    }
  }

  // Title length
  if (fm.title) {
    const titleResult = validateTitleLength(fm.title)
    if (!titleResult.valid) {
      issues.push(titleResult.error)
      if (status !== 'FAIL') status = 'WARN'
    }
  }

  // Duplicate H2s
  const dupeH2s = detectDuplicateH2s(body)
  if (dupeH2s.length > 0) {
    issues.push(`Duplicate H2s: ${dupeH2s.join(', ')}`)
    status = 'FAIL'
  }

  // Town facts (town pages only)
  if (fm.type === 'town') {
    const factsResult = validateTownFacts(fm.town_facts)
    if (!factsResult.valid) {
      issues.push(factsResult.error)
      status = 'FAIL'
    }
  }

  return { page: basename(filePath, '.md'), wordCount: wcResult.count, status, issues }
}

// ── Per-site figure validation ──────────────────────────────────────

function validateSiteFigures(slug) {
  const figDir = resolve(ROOT, 'sites', slug, 'figures')
  const results = []

  if (!existsSync(figDir)) {
    return { figures: [], validCount: 0, issues: ['No figures directory'] }
  }

  const files = readdirSync(figDir).filter(f => f.endsWith('.json'))
  const issues = []

  for (const file of files) {
    const raw = readFileSync(resolve(figDir, file), 'utf-8')
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      results.push({ file, valid: false, errors: ['Invalid JSON'] })
      continue
    }
    const result = validateFigure(parsed)
    results.push({ file, ...result })
  }

  const validCount = results.filter(r => r.valid).length
  if (validCount < 3) {
    issues.push(`Only ${validCount} valid figures (need ≥3)`)
  }

  // Check that cost guide and tool pages reference figures
  const contentDir = resolve(ROOT, 'sites', slug, 'content')
  if (existsSync(contentDir)) {
    const contentFiles = readdirSync(contentDir).filter(f => f.endsWith('.md'))
    for (const file of contentFiles) {
      const raw = readFileSync(resolve(contentDir, file), 'utf-8')
      const fm = parseFrontmatter(raw)
      if ((fm.type === 'cost_guide' || fm.type === 'tool') && hasBodyContent(raw)) {
        if (!fm.figures || fm.figures.length === 0) {
          issues.push(`${file}: ${fm.type} page missing figure reference in frontmatter`)
        }
      }
    }
  }

  return { figures: results, validCount, issues }
}

// ── Cross-site similarity check ─────────────────────────────────────

function crossSiteCheck(slugs) {
  // Group sites by niche
  const byNiche = {}
  for (const slug of slugs) {
    const yamlPath = resolve(ROOT, 'sites', slug, 'site.yaml')
    if (!existsSync(yamlPath)) continue
    const siteYaml = loadYaml(readFileSync(yamlPath, 'utf-8'))
    const niche = siteYaml.niche
    if (!byNiche[niche]) byNiche[niche] = []
    byNiche[niche].push(slug)
  }

  const warnings = []
  const failures = []

  for (const [niche, nicheSlugs] of Object.entries(byNiche)) {
    if (nicheSlugs.length < 2) continue

    // Collect pages with body content, grouped by page type
    const sitePages = {}
    for (const slug of nicheSlugs) {
      const contentDir = resolve(ROOT, 'sites', slug, 'content')
      if (!existsSync(contentDir)) continue
      const files = readdirSync(contentDir).filter(f => f.endsWith('.md'))
      sitePages[slug] = []
      for (const file of files) {
        const raw = readFileSync(resolve(contentDir, file), 'utf-8')
        if (!hasBodyContent(raw)) continue
        const fm = parseFrontmatter(raw)
        const body = stripFrontmatter(raw)
        sitePages[slug].push({ file, type: fm.type, body })
      }
    }

    // Compare every page pair across sites in the same niche
    const slugList = Object.keys(sitePages)
    for (let i = 0; i < slugList.length; i++) {
      for (let j = i + 1; j < slugList.length; j++) {
        const slugA = slugList[i]
        const slugB = slugList[j]
        for (const pageA of sitePages[slugA]) {
          for (const pageB of sitePages[slugB]) {
            const { overlapPercent } = detectNearDuplicateContent(pageA.body, pageB.body)
            if (overlapPercent > 75) {
              failures.push(`FAIL ${niche}: ${slugA}/${pageA.file} ↔ ${slugB}/${pageB.file} = ${overlapPercent}%`)
            } else if (overlapPercent > 60) {
              warnings.push(`WARN ${niche}: ${slugA}/${pageA.file} ↔ ${slugB}/${pageB.file} = ${overlapPercent}%`)
            }
          }
        }
      }
    }
  }

  return { warnings, failures }
}

// ── Validate one site ───────────────────────────────────────────────

function validateSite(slug) {
  const siteDir = resolve(ROOT, 'sites', slug)
  const yamlPath = resolve(siteDir, 'site.yaml')

  if (!existsSync(yamlPath)) {
    console.error(`  site.yaml not found for ${slug}`)
    return { slug, pages: [], figures: { figures: [], validCount: 0, issues: [] }, pass: false }
  }

  const siteYaml = loadYaml(readFileSync(yamlPath, 'utf-8'))
  const contentDir = resolve(siteDir, 'content')

  // Per-page validation
  const pageResults = []
  if (existsSync(contentDir)) {
    const files = readdirSync(contentDir).filter(f => f.endsWith('.md')).sort()
    for (const file of files) {
      pageResults.push(validatePage(resolve(contentDir, file), siteYaml))
    }
  }

  // Figure validation
  const figResults = validateSiteFigures(slug)

  // Print results table
  console.log(`\n  ── ${slug} ──`)
  console.log(`  ${'Page'.padEnd(45)} ${'Words'.padStart(6)} ${'Status'.padEnd(6)} Issues`)
  console.log(`  ${'─'.repeat(45)} ${'─'.repeat(6)} ${'─'.repeat(6)} ${'─'.repeat(40)}`)

  let failCount = 0
  let warnCount = 0
  let passCount = 0
  let skipCount = 0

  for (const r of pageResults) {
    const issueStr = r.issues.length > 0 ? r.issues.join('; ') : ''
    console.log(`  ${r.page.padEnd(45)} ${String(r.wordCount).padStart(6)} ${r.status.padEnd(6)} ${issueStr}`)
    if (r.status === 'FAIL') failCount++
    else if (r.status === 'WARN') warnCount++
    else if (r.status === 'SKIP') skipCount++
    else passCount++
  }

  // Figure summary
  if (figResults.figures.length > 0) {
    console.log(`  Figures: ${figResults.validCount} valid / ${figResults.figures.length} total`)
    for (const fig of figResults.figures) {
      if (!fig.valid) {
        console.log(`    FAIL ${fig.file}: ${fig.errors.join(', ')}`)
      }
    }
  }
  for (const issue of figResults.issues) {
    console.log(`  ⚠ ${issue}`)
  }

  console.log(`  Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail, ${skipCount} skip`)

  const pass = failCount === 0
  return { slug, pages: pageResults, figures: figResults, pass }
}

// ── Summary mode ────────────────────────────────────────────────────

async function printSummary() {
  const hashes = await loadHashes(resolve(ROOT, 'data/content-hashes.json'))
  const hashSummary = buildHashSummary(hashes)

  console.log('\nParagraph hash counts by niche:')
  if (Object.keys(hashSummary).length === 0) {
    console.log('  (none — no paragraphs hashed yet)')
  } else {
    for (const [niche, count] of Object.entries(hashSummary).sort()) {
      console.log(`  ${niche}: ${count} paragraphs`)
    }
  }

  // Coverage: how many sites have body content
  const slugs = discoverSites()
  let withContent = 0
  let totalPages = 0
  let pagesWithBody = 0

  for (const slug of slugs) {
    const contentDir = resolve(ROOT, 'sites', slug, 'content')
    if (!existsSync(contentDir)) continue
    const files = readdirSync(contentDir).filter(f => f.endsWith('.md'))
    let siteHasContent = false
    for (const file of files) {
      totalPages++
      const raw = readFileSync(resolve(contentDir, file), 'utf-8')
      if (hasBodyContent(raw)) {
        pagesWithBody++
        siteHasContent = true
      }
    }
    if (siteHasContent) withContent++
  }

  console.log(`\nContent coverage:`)
  console.log(`  Sites with body content: ${withContent}/${slugs.length}`)
  console.log(`  Pages with body content: ${pagesWithBody}/${totalPages}`)
}

// ── Main ────────────────────────────────────────────────────────────

if (summary) {
  await printSummary()
} else if (validate) {
  const slugs = all ? discoverSites() : slugArg ? [slugArg] : []

  if (slugs.length === 0) {
    console.error('Specify a site slug or use --all')
    process.exit(1)
  }

  console.log(`Validating ${slugs.length} site(s)...`)

  let totalPass = 0
  let totalFail = 0

  for (const slug of slugs) {
    const result = validateSite(slug)
    if (result.pass) totalPass++
    else totalFail++
  }

  // Cross-site check (only when validating multiple sites)
  if (slugs.length > 1) {
    console.log('\n  ── Cross-site similarity ──')
    const { warnings, failures } = crossSiteCheck(slugs)
    for (const w of warnings) console.log(`  ${w}`)
    for (const f of failures) console.log(`  ${f}`)
    if (warnings.length === 0 && failures.length === 0) {
      console.log('  No cross-site similarity issues')
    }
  }

  console.log(`\n${totalPass} pass, ${totalFail} fail out of ${slugs.length} sites`)
  process.exit(totalFail > 0 ? 1 : 0)
}
