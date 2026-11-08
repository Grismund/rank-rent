#!/usr/bin/env node
// scripts/teardown.mjs
// Runs rr-teardown procedure for candidates scoring 11+
// Pulls backlink data via DataForSEO, audits competitor pages, writes reports

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv, extractCompetitorDomains } from '../lib/candidates.js'
import { createClient } from '../lib/dataforseo-client.js'

// --- CLI args ---
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const filterSlugs = args.find(a => a.startsWith('--filter='))?.split('=')[1]?.split(',') || null

// --- DataForSEO client ---
const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
const { apiPost, sleep } = createClient.fromEnvContent(envContent)

// --- Fetch page content (simple fetch, no browser) ---
async function fetchPage(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RankRentBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return { error: `HTTP ${resp.status}`, html: '' }
    const html = await resp.text()
    return { error: null, html }
  } catch (e) {
    return { error: e.message, html: '' }
  }
}

function analyzeOnPage(html, keyword, domain) {
  const checks = {
    keywordInDomain: domain.toLowerCase().includes(keyword.split(' ')[0]),
    keywordInTitle: false,
    keywordInH1: false,
    headingHierarchy: true,
    contentLength: 0,
    https: true, // we fetch via https
    phoneVisible: false,
    mobileViewport: false,
  }

  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleMatch) {
    checks.keywordInTitle = titleMatch[1].toLowerCase().includes(keyword.split(' ')[0])
  }

  // H1
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1Match) {
    checks.keywordInH1 = h1Match[1].toLowerCase().replace(/<[^>]+>/g, '').includes(keyword.split(' ')[0])
  }

  // Content length (strip tags, approximate word count)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) {
    const text = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    checks.contentLength = text.split(' ').filter(w => w.length > 0).length
  }

  // Phone number pattern
  checks.phoneVisible = /(\(\d{3}\)\s*\d{3}[-.\s]?\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4})/.test(html)

  // Viewport
  checks.mobileViewport = /<meta[^>]*viewport/i.test(html)

  return checks
}

// --- Main ---
async function main() {
  const csv = readFileSync('data/candidates.csv', 'utf8')
  const allCandidates = parseCandidatesCsv(csv)
  let qualifiers = allCandidates.filter(
    (c) => c.status === 'validated' && Number(c.score_total) >= 11
  )
  if (filterSlugs) {
    qualifiers = qualifiers.filter((c) => filterSlugs.includes(c.slug))
  }

  console.log(`Found ${qualifiers.length} candidates for teardown (score >= 11)\n`)
  if (qualifiers.length === 0) { console.log('Nothing to tear down.'); return }

  // Build competitor list per candidate
  const teardowns = []
  for (const c of qualifiers) {
    const rawPath = `research/${c.slug}/validation-data.json`
    const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
    teardowns.push({
      candidate: c,
      competitors: extractCompetitorDomains(raw),
      backlinks: [],
      onPage: [],
    })
  }

  // Cost gate
  const totalCalls = teardowns.reduce((s, t) => s + t.competitors.length * 2, 0)
  const estCost = totalCalls * 0.02
  console.log(`Estimated cost: $${estCost.toFixed(2)} (${totalCalls} API calls × $0.02)`)
  if (estCost > 2) {
    console.error('Cost exceeds $2 — aborting.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('\n── Dry Run — Candidates ──')
    for (const td of teardowns) {
      console.log(`  ${td.candidate.slug} — ${td.competitors.length} competitors: ${td.competitors.join(', ')}`)
    }
    return
  }

  const today = new Date().toISOString().split('T')[0]

  // --- Pull backlink data ---
  for (const td of teardowns) {
    console.log(`\n── ${td.candidate.slug} ──`)
    console.log(`  Competitors: ${td.competitors.join(', ')}`)

    for (const comp of td.competitors) {
      process.stdout.write(`  Backlinks for ${comp}: `)

      // Summary
      const summResp = await apiPost('/v3/backlinks/summary/live', [{
        target: comp,
        internal_links_limit: 0,
        backlinks_status_type: 'live',
      }])
      const summResult = summResp.tasks?.[0]?.result?.[0] || {}
      const summary = {
        backlinks: summResult.backlinks || 0,
        referring_domains: summResult.referring_domains || 0,
        rank: summResult.rank || 0,
        dofollow: summResult.dofollow || 0,
        referring_domains_nofollow: summResult.referring_domains_nofollow || 0,
        broken_backlinks: summResult.broken_backlinks || 0,
      }
      console.log(`${summary.backlinks} backlinks, ${summary.referring_domains} ref domains, rank ${summary.rank}`)
      await sleep(100)

      // Referring domains
      process.stdout.write(`  Referring domains for ${comp}: `)
      const refResp = await apiPost('/v3/backlinks/referring_domains/live', [{
        target: comp,
        backlinks_status_type: 'live',
        order_by: ['rank,desc'],
        limit: 50,
      }])
      const refItems = refResp.tasks?.[0]?.result?.[0]?.items || []
      const topReferring = refItems.map((r) => ({
        domain: r.domain || '',
        rank: r.rank || 0,
        backlinks: r.backlinks || 0,
        first_seen: r.first_seen || '',
        backlink_types: r.backlink_types || null,
        last_seen: r.last_seen || '',
        is_broken: r.is_broken ?? false,
      }))
      console.log(`${topReferring.length} domains`)
      await sleep(100)

      td.backlinks.push({ domain: comp, summary, top_referring_domains: topReferring })
    }

    // --- On-page audit ---
    console.log(`  On-page audits:`)
    const keyword = td.candidate.primary_phrase.replace(/ (houston|tulsa|tucson|albuquerque|oklahoma city|el paso|midland|odessa|abilene)$/i, '')
    for (const comp of td.competitors) {
      const url = `https://${comp}`
      process.stdout.write(`    ${comp}: `)
      const { error, html } = await fetchPage(url)
      if (error) {
        console.log(`FAILED (${error})`)
        td.onPage.push({ domain: comp, error, checks: null })
        continue
      }
      const checks = analyzeOnPage(html, keyword, comp)
      console.log(`${checks.contentLength} words, title=${checks.keywordInTitle}, phone=${checks.phoneVisible}`)
      td.onPage.push({ domain: comp, error: null, checks })
    }
  }

  // --- Write reports ---
  console.log('\n\n── Writing Reports ──')
  for (const td of teardowns) {
    const c = td.candidate
    const dir = `research/${c.slug}`
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    // Determine verdict
    const refDomainCounts = td.backlinks.map((b) => b.summary.referring_domains).sort((a, b) => a - b)
    const medianRefDomains = refDomainCounts.length > 0
      ? refDomainCounts[Math.floor(refDomainCounts.length / 2)]
      : 0
    const weakOnPage = td.onPage.filter((op) => {
      if (!op.checks) return true // couldn't fetch = potentially weak
      return op.checks.contentLength < 500 || !op.checks.keywordInTitle || !op.checks.phoneVisible
    }).length
    // "Strong" = 200+ referring domains
    const strongCompetitors = td.backlinks.filter((b) => b.summary.referring_domains >= 200).length

    let verdict, effort
    if (td.competitors.length === 0) {
      // No real competitors in organic results — wide open
      verdict = 'BEATABLE'
      effort = 'low'
    } else if (strongCompetitors >= 2 && strongCompetitors >= td.competitors.length) {
      verdict = 'SKIP'
      effort = 'high'
    } else if (medianRefDomains < 100 || weakOnPage >= Math.ceil(td.competitors.length / 2)) {
      verdict = 'BEATABLE'
      effort = medianRefDomains < 30 ? 'low' : 'medium'
    } else {
      verdict = 'TOUGH'
      effort = 'medium'
    }

    // Weaknesses
    const weaknesses = []
    for (const op of td.onPage) {
      if (!op.checks) { weaknesses.push(`${op.domain}: could not fetch (${op.error})`); continue }
      const w = []
      if (op.checks.contentLength < 500) w.push('thin content')
      if (!op.checks.keywordInTitle) w.push('no keyword in title')
      if (!op.checks.keywordInH1) w.push('no keyword in H1')
      if (!op.checks.phoneVisible) w.push('no visible phone')
      if (!op.checks.mobileViewport) w.push('no viewport meta')
      if (w.length > 0) weaknesses.push(`${op.domain}: ${w.join(', ')}`)
    }

    // Common referring domain sources
    const allRefDomains = new Map()
    for (const bl of td.backlinks) {
      for (const rd of bl.top_referring_domains) {
        if (!allRefDomains.has(rd.domain)) allRefDomains.set(rd.domain, { count: 0, rank: rd.rank })
        allRefDomains.get(rd.domain).count++
      }
    }
    const commonSources = [...allRefDomains.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].rank - a[1].rank)
      .map(([d]) => d)

    const linkTargets = [...commonSources]
    for (const bl of td.backlinks) {
      for (const rd of bl.top_referring_domains) {
        if (!linkTargets.includes(rd.domain)) linkTargets.push(rd.domain)
      }
    }

    // Write backlink-sources.json
    const blJson = {
      slug: c.slug,
      analyzed_at: today,
      competitors: td.backlinks,
      common_sources: commonSources,
      link_building_targets: linkTargets.slice(0, 50),
    }
    writeFileSync(`${dir}/backlink-sources.json`, JSON.stringify(blJson, null, 2))

    // Write teardown.md
    const competitorRows = td.backlinks.map((bl, i) => {
      const op = td.onPage.find((o) => o.domain === bl.domain)
      const checks = op?.checks
      return `| ${i + 1} | ${bl.domain} | ${bl.summary.backlinks} | ${bl.summary.referring_domains} | ${bl.summary.rank} | ${checks ? (checks.keywordInDomain ? 'Yes' : 'No') : 'N/A'} | ${checks ? (checks.keywordInTitle ? 'Yes' : 'No') : 'N/A'} | Yes | ${checks ? checks.contentLength : 'N/A'} | ${weaknesses.find((w) => w.startsWith(bl.domain))?.split(': ')[1] || 'none found'} |`
    }).join('\n')

    const md = `# Teardown: ${c.niche} in ${c.area}

## Competitor Summary

| # | Domain | Backlinks | Ref. Domains | Domain Rank | Keyword in Domain | Keyword in Title | HTTPS | Content Words | Weaknesses |
|---|--------|-----------|--------------|-------------|-------------------|------------------|-------|---------------|------------|
${competitorRows}

## Backlink Gap

- Median referring domains among competitors: ${medianRefDomains}
- Estimated effort to match: ${effort}
- Common backlink sources (shared by 2+ competitors): ${commonSources.length > 0 ? commonSources.slice(0, 5).join(', ') : 'none found'}

## Weaknesses Found

${weaknesses.length > 0 ? weaknesses.map((w) => `- ${w}`).join('\n') : '- No significant weaknesses found'}

## Verdict: ${verdict}

${verdict === 'BEATABLE' ? 'Majority of competitors have thin content, few referring domains, or poor on-page SEO. This niche is winnable with solid content and basic link building.' : verdict === 'TOUGH' ? 'Competitors are established but have exploitable gaps. Will require sustained effort on content and link building.' : 'All competitors are strong with 100+ referring domains and solid on-page SEO. Not recommended.'}
`

    writeFileSync(`${dir}/teardown.md`, md)
    console.log(`  ${c.slug}: ${verdict} (median ${medianRefDomains} ref domains)`)

    // Update CSV
    c.teardown_date = today
    if (verdict === 'SKIP') {
      c.status = 'walk_away'
    } else {
      c.status = 'torn_down'
    }
  }

  // Save CSV
  writeFileSync('data/candidates.csv', serializeCandidatesCsv(allCandidates))
  console.log('\nCSV updated')

  // Summary
  const beaten = teardowns.filter((t) => t.candidate.status === 'torn_down')
  const skipped = teardowns.filter((t) => t.candidate.status === 'walk_away')
  console.log(`\nTeardown complete: ${beaten.length} BEATABLE/TOUGH, ${skipped.length} SKIP`)
}

main().catch((err) => { console.error(err); process.exit(1) })
