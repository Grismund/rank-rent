#!/usr/bin/env node
// scripts/validate-content.mjs
// Reads all content .md files for a site and runs content validators.
// Usage: node scripts/validate-content.mjs sites/epoxy-flooring-new-braunfels

import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import {
  validateWordCount,
  detectBannedClaims,
  checkKeywordInFirstWords,
  validateTitleLength,
  validateMetaDescriptionLength,
  detectDuplicateH2s,
  validateTownFacts,
  detectNearDuplicateContent,
} from '../lib/content-validator.js'

// --- CLI args ---
const siteDir = process.argv[2]
if (!siteDir) {
  console.error('Usage: node scripts/validate-content.mjs <site-dir>')
  console.error('Example: node scripts/validate-content.mjs sites/epoxy-flooring-new-braunfels')
  process.exit(1)
}

const contentDir = join(siteDir, 'content')

// --- Parse frontmatter from markdown ---
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm = {}
  // Simple YAML-like key: value parsing for the fields we need
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/)
    if (kv) {
      let val = kv[2].trim()
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      fm[kv[1]] = val
    }
  }
  // Parse word_count_target: { min: N, max: N }
  const wctMatch = text.match(/word_count_target:\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+)\s*\}/)
  if (wctMatch) {
    fm.word_count_target = { min: parseInt(wctMatch[1]), max: parseInt(wctMatch[2]) }
  }
  // Parse town_facts array
  const tfSection = match[1].match(/town_facts:\n((?:\s+-\s+.*\n?)*)/)
  if (tfSection && tfSection[1].trim()) {
    fm.town_facts = tfSection[1].split('\n')
      .map(l => l.replace(/^\s+-\s+/, '').replace(/^"(.*)"$/, '$1').trim())
      .filter(l => l.length > 0)
  } else {
    fm.town_facts = []
  }
  return fm
}

// --- Main ---
const files = readdirSync(contentDir).filter(f => f.endsWith('.md')).sort()
let totalErrors = 0
let totalWarnings = 0

console.log(`\nValidating ${files.length} content files in ${contentDir}\n`)
console.log('='.repeat(70))

for (const file of files) {
  const filePath = join(contentDir, file)
  const text = readFileSync(filePath, 'utf8')
  const fm = parseFrontmatter(text)
  const errors = []
  const warnings = []

  // 1. Title length
  if (fm.title) {
    const r = validateTitleLength(fm.title)
    if (!r.valid) errors.push(r.error)
  } else {
    errors.push('Missing title in frontmatter')
  }

  // 2. Meta description length
  if (fm.meta_description) {
    const r = validateMetaDescriptionLength(fm.meta_description)
    if (!r.valid) errors.push(r.error)
  } else {
    errors.push('Missing meta_description in frontmatter')
  }

  // 3. Word count
  if (fm.word_count_target) {
    const r = validateWordCount(text, fm.word_count_target)
    if (!r.valid) errors.push(r.error)
  }

  // 4. Primary keyword in first 100 words
  if (fm.primary_keyword) {
    const r = checkKeywordInFirstWords(text, fm.primary_keyword, 100)
    if (!r.valid) warnings.push(r.error)
  }

  // 5. Banned claims
  const banned = detectBannedClaims(text)
  for (const b of banned) {
    errors.push(`Banned claim detected: "${b.match}" (pattern: ${b.pattern})`)
  }

  // 6. Duplicate H2s
  const dupes = detectDuplicateH2s(text)
  for (const d of dupes) {
    errors.push(`Duplicate H2: "${d}"`)
  }

  // 7. Town facts (only for town pages)
  if (fm.type === 'town') {
    const r = validateTownFacts(fm.town_facts)
    if (!r.valid) errors.push(r.error)
  }

  // Print results
  const status = errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS'
  const icon = { PASS: '✓', WARN: '⚠', FAIL: '✗' }[status]
  console.log(`\n${icon} ${file} [${status}]`)
  for (const e of errors) console.log(`    ERROR: ${e}`)
  for (const w of warnings) console.log(`    WARN:  ${w}`)
  totalErrors += errors.length
  totalWarnings += warnings.length
}

// --- Cross-page: near-duplicate town pages ---
const townFiles = files.filter(f => f.startsWith('areas-'))
if (townFiles.length >= 2) {
  console.log('\n' + '='.repeat(70))
  console.log('\nNear-duplicate check (town pages):')
  const townTexts = townFiles.map(f => ({
    file: f,
    text: readFileSync(join(contentDir, f), 'utf8').replace(/^---\n[\s\S]*?\n---\n?/, '')
  }))

  for (let i = 0; i < townTexts.length; i++) {
    for (let j = i + 1; j < townTexts.length; j++) {
      const r = detectNearDuplicateContent(townTexts[i].text, townTexts[j].text)
      const status = r.overlapPercent > 40 ? 'FAIL' : 'OK'
      const icon = status === 'FAIL' ? '✗' : '✓'
      console.log(`  ${icon} ${townTexts[i].file} vs ${townTexts[j].file}: ${r.overlapPercent}% overlap${status === 'FAIL' ? ' (>40% threshold)' : ''}`)
      if (status === 'FAIL') totalErrors++
    }
  }
}

// --- Summary ---
console.log('\n' + '='.repeat(70))
console.log(`\nSummary: ${files.length} files, ${totalErrors} errors, ${totalWarnings} warnings`)
if (totalErrors > 0) {
  console.log('RESULT: FAIL — fix errors above before proceeding\n')
  process.exit(1)
} else if (totalWarnings > 0) {
  console.log('RESULT: PASS with warnings\n')
} else {
  console.log('RESULT: PASS\n')
}
