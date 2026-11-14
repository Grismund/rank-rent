#!/usr/bin/env node

/**
 * build-dashboard.mjs
 * Reads Phase 2 research data and generates a self-contained HTML dashboard.
 *
 * Usage: node scripts/build-dashboard.mjs
 * Output: dashboard.html
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { parseCandidatesCsv } from '../lib/candidates.js'
import {
  buildFunnel,
  enrichCandidates,
  enrichWithJobEconomics,
  extractTeardownData,
  buildRegionSummary,
  buildNicheSummary,
  findCommonSources,
  prioritizeLinkTargets,
  buildRentersSummary,
  buildKeywordsSummary,
} from '../lib/dashboard-data.js'
import { parseBuyersCsv } from '../lib/renters.js'
import { load as yamlLoad } from 'js-yaml'
import { parseNicheEconomics } from '../lib/niche-economics-parser.js'
import { buildReportMaps, buildShortlistMap } from '../lib/report-loader.js'

const ROOT = new URL('..', import.meta.url).pathname

// ── Load data ──────────────────────────────────────────────

const csvPath = join(ROOT, 'data', 'candidates.csv')
const csvText = readFileSync(csvPath, 'utf8')
const candidates = parseCandidatesCsv(csvText)

// Load validation data
const validationMap = {}
const researchDir = join(ROOT, 'research')
for (const slug of readdirSync(researchDir)) {
  const vPath = join(researchDir, slug, 'validation-data.json')
  if (existsSync(vPath)) {
    validationMap[slug] = JSON.parse(readFileSync(vPath, 'utf8'))
  }
}

// Load teardown data (verdict + assessment + keyFinding)
const teardownMap = {}
for (const slug of readdirSync(researchDir)) {
  const tPath = join(researchDir, slug, 'teardown.md')
  if (existsSync(tPath)) {
    const data = extractTeardownData(readFileSync(tPath, 'utf8'))
    if (data.verdict) teardownMap[slug] = data
  }
}

// Load backlink sources
const backlinkMap = {}
for (const slug of readdirSync(researchDir)) {
  const bPath = join(researchDir, slug, 'backlink-sources.json')
  if (existsSync(bPath)) {
    backlinkMap[slug] = JSON.parse(readFileSync(bPath, 'utf8'))
  }
}

// Find shortlist memos
const shortlists = readdirSync(researchDir)
  .filter((f) => f.startsWith('shortlist-') && f.endsWith('.md'))
  .map((f) => f)

// Load report HTML (teardowns, viability, shortlists)
const allSlugs = readdirSync(researchDir).filter((f) => existsSync(join(researchDir, f, 'validation-data.json')) || existsSync(join(researchDir, f, 'teardown.md')) || existsSync(join(researchDir, f, 'viability.md')))
const { teardownHtmlMap, viabilityHtmlMap } = buildReportMaps(allSlugs, researchDir)
const shortlistHtmlMap = buildShortlistMap(shortlists, researchDir)

// Load niche economics
const economicsPath = join(ROOT, 'reference', 'niche-economics.md')
const economicsMap = existsSync(economicsPath)
  ? parseNicheEconomics(readFileSync(economicsPath, 'utf8'))
  : new Map()

// Load buyers data
const buyersPath = join(ROOT, 'data', 'buyers.csv')
const buyers = existsSync(buyersPath)
  ? parseBuyersCsv(readFileSync(buyersPath, 'utf8'))
  : []

// Load site.yaml files
const sitesDir = join(ROOT, 'sites')
const siteYamls = {}
if (existsSync(sitesDir)) {
  for (const dir of readdirSync(sitesDir)) {
    const yPath = join(sitesDir, dir, 'site.yaml')
    if (existsSync(yPath)) {
      siteYamls[dir] = yamlLoad(readFileSync(yPath, 'utf8'))
    }
  }
}

// ── Process data ───────────────────────────────────────────

const funnel = buildFunnel(candidates)
let enriched = enrichCandidates(candidates, validationMap, teardownMap, backlinkMap)
enriched = enrichWithJobEconomics(enriched, economicsMap)
const regionSummary = buildRegionSummary(candidates)
const nicheSummary = buildNicheSummary(candidates, economicsMap)
const rentersSummary = buildRentersSummary(buyers)
const keywordsSummary = buildKeywordsSummary(siteYamls)

// Split candidates: only non-walk_away go into HTML; walk_away go into a JS blob
const visibleCandidates = enriched.filter(c => c.status !== 'walk_away')
const walkAwayCandidates = enriched.filter(c => c.status === 'walk_away')

// ── HTML generation helpers ────────────────────────────────

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function statusColor(status) {
  switch (status) {
    case 'shortlisted': return '#22c55e'
    case 'validated': return '#eab308'
    case 'torn_down': return '#3b82f6'
    case 'walk_away': return '#ef4444'
    default: return '#6b7280'
  }
}

function statusBg(status) {
  switch (status) {
    case 'shortlisted': return '#dcfce7'
    case 'validated': return '#fef9c3'
    case 'torn_down': return '#dbeafe'
    case 'walk_away': return '#fee2e2'
    default: return '#f3f4f6'
  }
}

function sparklineSvg(values, width = 120, height = 30) {
  if (!values || values.length === 0) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="vertical-align:middle">
    <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

function barChartSvg(signals) {
  if (!signals) return ''
  const labels = ['Vol', 'CPC', 'Map', 'Org', 'Rent', 'Lic', 'Seas', 'RentP']
  const keys = ['volume', 'cpc', 'mapPack', 'organic', 'renters', 'license', 'seasonality', 'rent']
  const barW = 28
  const gap = 4
  const maxH = 50
  const totalW = keys.length * (barW + gap)

  let bars = ''
  keys.forEach((k, i) => {
    const val = signals[k] || 0
    const h = (val / 2) * maxH
    const x = i * (barW + gap)
    const y = maxH - h
    const color = val === 2 ? '#22c55e' : val === 1 ? '#eab308' : '#ef4444'
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h || 2}" fill="${color}" rx="2"/>`
    bars += `<text x="${x + barW / 2}" y="${maxH + 14}" text-anchor="middle" font-size="9" fill="#666">${labels[i]}</text>`
    bars += `<text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#333">${val}</text>`
  })

  return `<svg width="${totalW}" height="${maxH + 20}" viewBox="0 0 ${totalW} ${maxH + 20}">${bars}</svg>`
}

function verdictBadge(verdict) {
  if (!verdict) return ''
  const colors = { BEATABLE: '#22c55e', TOUGH: '#eab308', SKIP: '#ef4444' }
  const bg = colors[verdict] || '#6b7280'
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${bg};color:#fff;font-weight:bold;font-size:12px">${verdict}</span>`
}

// ── Build candidate rows (main rows only, no detail rows) ──

function candidateMainRow(c) {
  const score = c.score_total || ''
  const bg = statusBg(c.status)
  const hasDetail = !!c.validation
  const kwSummary = keywordsSummary[c.slug]
  const rSummary = rentersSummary.byCandidate[c.slug]

  return `
    <tr data-slug="${esc(c.slug)}" data-status="${esc(c.status)}" style="background:${bg};cursor:${hasDetail ? 'pointer' : 'default'}" ${hasDetail ? `onclick="toggleDetail(this)"` : ''}>
      <td onclick="event.stopPropagation()"><input type="checkbox" class="row-select" data-slug="${esc(c.slug)}"></td>
      <td>${esc(c.slug)}</td>
      <td>${esc(c.niche)}</td>
      <td>${esc(c.area)}</td>
      <td data-sort="${c.vol_total || 0}">${c.vol_total || '—'}</td>
      <td data-sort="${c.vol_primary || 0}">${c.vol_primary || '—'}</td>
      <td data-sort="${c.cpc || 0}">${c.cpc ? '$' + parseFloat(c.cpc).toFixed(2) : '—'}</td>
      <td data-sort="${c.rent_estimate || 0}">${c.rent_estimate ? '$' + parseFloat(c.rent_estimate).toFixed(0) : '—'}</td>
      <td data-sort="${c.avgJobLow || 0}">${c.jobValueRange || '—'}</td>
      <td data-sort="${score}">${score || '—'}</td>
      <td data-sort="${c.score_organic != null && c.score_organic !== '' ? c.score_organic : ''}">${c.score_organic != null && c.score_organic !== '' ? `<span style="color:${String(c.score_organic) === '2' ? '#22c55e' : String(c.score_organic) === '1' ? '#eab308' : '#ef4444'};font-weight:bold">${c.score_organic}</span>` : '—'}</td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${statusColor(c.status)};color:#fff;font-size:11px">${esc(c.status)}</span></td>
      <td>${c.teardownVerdict ? verdictBadge(c.teardownVerdict) : ''}${c.teardownKeyFinding ? `<div style="font-size:11px;color:#555;margin-top:2px;max-width:220px;line-height:1.3">${esc(c.teardownKeyFinding)}</div>` : ''}</td>
      <td data-sort="${kwSummary ? kwSummary.pageCount : 0}">${kwSummary ? kwSummary.pageCount : '—'}</td>
      <td data-sort="${rSummary ? rSummary.total : 0}">${rSummary ? `${rSummary.total} (${rSummary.hot} hot)` : '—'}</td>
    </tr>`
}

function candidateRows() {
  return visibleCandidates.map(c => candidateMainRow(c)).join('')
}

// ── Build detail data JSON for lazy rendering ────────────────

function buildDetailsJson() {
  const details = {}
  for (const c of enriched) {
    if (!c.validation) continue
    // Skip walk_away candidates with no teardown/backlink data — their detail rows
    // would only show bar charts derived from CSV scores, which isn't worth the payload
    if (c.status === 'walk_away' && !c.teardownVerdict && !c.backlinkSources) continue
    const v = c.validation
    const entry = {
      signals: v.signals || null,
      trends_monthly: v.trends_monthly || null,
      maps_data: v.maps_data ? { topThree: v.maps_data.topThree || [] } : null,
      organic_domains: v.organic_domains || null,
      teardownVerdict: c.teardownVerdict || null,
      teardownAssessment: c.teardownAssessment || null,
      hasTeardownReport: !!teardownHtmlMap[c.slug],
      hasViabilityReport: !!viabilityHtmlMap[c.slug],
    }
    if (c.backlinkSources) {
      const bl = c.backlinkSources
      entry.backlinkSources = {
        competitors: (bl.competitors || []).map(comp => ({
          domain: comp.domain,
          summary: comp.summary ? { referring_domains: comp.summary.referring_domains, rank: comp.summary.rank } : null,
          top_referring_domains: (comp.top_referring_domains || []).slice(0, 20).map(r => ({
            domain: r.domain, rank: r.rank, backlinks: r.backlinks, first_seen: r.first_seen
          })),
        })),
        common_sources: bl.common_sources || [],
        link_building_targets: bl.link_building_targets || [],
      }
    }
    details[c.slug] = entry
  }
  return details
}

// ── Build walk_away data as columnar JSON [cols, ...rows] ────

const WALKAWAY_COLS = ['slug','niche','area','vol_total','vol_primary','cpc','rent_estimate','avgJobLow','jobValueRange','score_total','score_organic','status','teardownVerdict','teardownKeyFinding','pageCount','renterTotal','renterHot','hasDetail']

function buildWalkawayJson() {
  const rows = walkAwayCandidates.map(c => {
    const kwSummary = keywordsSummary[c.slug]
    const rSummary = rentersSummary.byCandidate[c.slug]
    return [
      c.slug, c.niche, c.area,
      c.vol_total || 0, c.vol_primary || 0, c.cpc || 0, c.rent_estimate || 0,
      c.avgJobLow || 0, c.jobValueRange || null,
      c.score_total || '', c.score_organic != null && c.score_organic !== '' ? c.score_organic : null,
      c.status, c.teardownVerdict || null, c.teardownKeyFinding || null,
      kwSummary ? kwSummary.pageCount : 0, rSummary ? rSummary.total : 0, rSummary ? rSummary.hot : 0,
      !!(c.validation && (c.teardownVerdict || c.backlinkSources)),
    ]
  })
  return [WALKAWAY_COLS, ...rows]
}

// ── Build backlink section for detail card ──────────────────

function buildBacklinkSection(c) {
  if (!c.backlinkSources) return ''
  const bl = c.backlinkSources

  let competitorTables = ''
  if (bl.competitors && bl.competitors.length > 0) {
    competitorTables = bl.competitors.map((comp) => {
      const rows = (comp.top_referring_domains || []).slice(0, 20).map((ref) => `
        <tr>
          <td style="font-size:12px">${esc(ref.domain)}</td>
          <td style="font-size:12px">${ref.rank || '—'}</td>
          <td style="font-size:12px">${ref.backlinks || '—'}</td>
          <td style="font-size:12px">${ref.first_seen || '—'}</td>
        </tr>`).join('')

      return `
      <div style="margin-bottom:12px">
        <h5 style="margin:0 0 4px">Referring Domains for <em>${esc(comp.domain)}</em>
          <span style="font-weight:normal;color:#666;font-size:12px">(${comp.summary?.referring_domains || '?'} ref. domains, rank ${comp.summary?.rank || '?'})</span>
        </h5>
        <table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr><th style="text-align:left;padding:4px">Domain</th><th style="text-align:left;padding:4px">Rank</th><th style="text-align:left;padding:4px">Backlinks</th><th style="text-align:left;padding:4px">First Seen</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    }).join('')
  }

  const commonHtml = bl.common_sources && bl.common_sources.length > 0
    ? `<div style="margin-top:8px"><strong>Common Sources</strong> (link to 2+ competitors): <span style="color:#22c55e;font-weight:bold">${bl.common_sources.map(esc).join(', ')}</span></div>`
    : ''

  const targetsHtml = bl.link_building_targets && bl.link_building_targets.length > 0
    ? `<div style="margin-top:8px"><strong>Link Building Targets:</strong> ${bl.link_building_targets.map(esc).join(', ')}</div>`
    : ''

  return `
  <div class="backlink-section">
    <h4>Backlink Sources</h4>
    ${competitorTables}
    ${commonHtml}
    ${targetsHtml}
  </div>`
}

// ── Region / Niche summary tables ──────────────────────────

function regionTable() {
  return Object.entries(regionSummary).map(([area, s]) => `
    <tr>
      <td><strong>${esc(area)}</strong></td>
      <td>${s.count}</td>
      <td>${s.viable}</td>
      <td>${s.bestScore}</td>
    </tr>`).join('')
}

function nicheTable() {
  return Object.entries(nicheSummary)
    .sort((a, b) => b[1].bestScore - a[1].bestScore)
    .map(([niche, s]) => `
    <tr>
      <td><strong>${esc(niche)}</strong></td>
      <td>${s.count}</td>
      <td>${s.viable}</td>
      <td>${s.bestScore}</td>
      <td>${s.avgJobRange || '—'}</td>
    </tr>`).join('')
}

// ── Phase 3 per-candidate cards ─────────────────────────────

function phase3Cards() {
  const phase3Candidates = enriched.filter((c) => c.status === 'renters_found')
  if (phase3Candidates.length === 0) return '<p style="color:#64748b;margin-top:16px">No shortlisted candidates yet.</p>'

  return phase3Candidates.map((c) => {
    const kw = keywordsSummary[c.slug]
    const r = rentersSummary.byCandidate[c.slug]

    const kwHtml = kw ? `
      <div>
        <h4 style="margin:0 0 6px">Page Plan</h4>
        <div style="font-size:13px"><strong>${kw.pageCount}</strong> pages &mdash;
          ${Object.entries(kw.pageTypes).map(([t, n]) => `${n} ${t}`).join(', ')}
        </div>
        ${kw.towns.length > 0 ? `<div style="font-size:12px;color:#64748b;margin-top:4px">Towns: ${kw.towns.map(esc).join(', ')}</div>` : ''}
        <div style="margin-top:6px;font-size:12px;color:#475569">
          <strong>Keywords:</strong> ${kw.keywords.slice(0, 5).map(esc).join(', ')}${kw.keywords.length > 5 ? ` +${kw.keywords.length - 5} more` : ''}
        </div>
      </div>` : '<div style="color:#999;font-size:13px">No site.yaml yet</div>'

    const rHtml = r ? `
      <div>
        <h4 style="margin:0 0 6px">Renters (${r.total})</h4>
        <div style="display:flex;gap:12px;margin-bottom:8px;font-size:13px">
          <span style="color:#ef4444;font-weight:bold">${r.hot} hot</span>
          <span style="color:#eab308;font-weight:bold">${r.warm} warm</span>
          <span style="color:#6b7280">${r.cold} cold</span>
        </div>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px">
          ${r.withEmail || 0} with email · ${r.withPhone || 0} with phone · ${r.withOwner || 0} with owner
        </div>
        ${r.topRenters.length > 0 ? `
        <div style="max-height:320px;overflow-y:auto">
        <table class="renter-table" style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr>
            <th data-col="0" data-type="text" style="text-align:left;padding:3px 6px;position:sticky;top:0;z-index:1;background:#f1f5f9">Business</th>
            <th data-col="1" data-type="num" style="padding:3px 6px;position:sticky;top:0;z-index:1;background:#f1f5f9">Rating</th>
            <th data-col="2" data-type="num" style="padding:3px 6px;position:sticky;top:0;z-index:1;background:#f1f5f9">Reviews</th>
            <th data-col="3" data-type="text" style="padding:3px 6px;position:sticky;top:0;z-index:1;background:#f1f5f9">Weakness</th>
            <th data-col="4" data-type="num" style="padding:3px 6px;position:sticky;top:0;z-index:1;background:#f1f5f9">Contact Details</th>
            <th data-col="5" data-type="priority" style="padding:3px 6px;position:sticky;top:0;z-index:1;background:#f1f5f9">Priority</th>
          </tr></thead>
          <tbody>${r.topRenters.map((b) => {
            const contactFields = [b.phone, b.email, b.owner_name].filter(Boolean).length
            const contactLines = [
              b.phone ? `<div>☎ ${esc(b.phone)}</div>` : '',
              b.email ? `<div style="color:#2563eb">✉ ${esc(b.email)}</div>` : '',
              b.owner_name ? `<div>👤 ${esc(b.owner_name)}</div>` : '',
            ].filter(Boolean).join('')
            const bizName = b.website ? `<a href="${esc(b.website)}" target="_blank" style="color:#2563eb;text-decoration:none">${esc(b.business_name)}</a>` : esc(b.business_name)
            return `
            <tr>
              <td style="padding:3px 6px">${bizName}</td>
              <td style="padding:3px 6px;text-align:center" data-sort="${b.rating || 0}">${b.rating || '—'}</td>
              <td style="padding:3px 6px;text-align:center" data-sort="${b.review_count || 0}">${b.review_count || '—'}</td>
              <td style="padding:3px 6px;font-size:11px">${esc(b.website_weakness)}</td>
              <td style="padding:3px 6px;font-size:11px;line-height:1.4" data-sort="${contactFields}">${contactLines || '—'}</td>
              <td style="padding:3px 6px" data-sort="${b.pitch_priority === 'hot' ? 0 : b.pitch_priority === 'warm' ? 1 : 2}"><span style="color:${b.pitch_priority === 'hot' ? '#ef4444' : b.pitch_priority === 'warm' ? '#eab308' : '#6b7280'};font-weight:bold;font-size:11px">${esc(b.pitch_priority)}</span></td>
            </tr>`}).join('')}
          </tbody>
        </table>
        </div>` : ''}
      </div>` : '<div style="color:#999;font-size:13px">No renters researched yet</div>'

    return `
    <div class="card" style="margin-top:16px">
      <h3>${esc(c.slug)} <span style="font-weight:normal;color:#64748b;font-size:13px">${esc(c.niche)} &mdash; ${esc(c.area)}</span></h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
        ${kwHtml}
        ${rHtml}
      </div>
    </div>`
  }).join('')
}

// ── Funnel bar ─────────────────────────────────────────────

function funnelBar() {
  const stages = [
    { label: 'Total', count: funnel.total, color: '#6b7280' },
    { label: 'Validated (8+)', count: funnel.validated, color: '#eab308' },
    { label: 'High Scorers (11+)', count: funnel.highScorers, color: '#3b82f6' },
    { label: 'Torn Down', count: funnel.tornDown, color: '#8b5cf6' },
    { label: 'Shortlisted', count: funnel.shortlisted, color: '#22c55e' },
  ]
  const maxCount = Math.max(funnel.total, 1)
  return stages.map((s) => {
    const pct = Math.max((s.count / maxCount) * 100, 2)
    return `
    <div style="margin-bottom:6px;display:flex;align-items:center;gap:8px">
      <div style="width:140px;font-size:13px;text-align:right;color:#555">${s.label}</div>
      <div style="flex:1;background:#f3f4f6;border-radius:4px;height:28px;position:relative">
        <div style="width:${pct}%;background:${s.color};height:100%;border-radius:4px;transition:width 0.3s"></div>
        <span style="position:absolute;left:8px;top:5px;font-size:13px;font-weight:bold;color:${pct > 15 ? '#fff' : '#333'}">${s.count}</span>
      </div>
    </div>`
  }).join('')
}

// ── Assemble full HTML ─────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rank &amp; Rent — Research Dashboard</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.5; padding: 24px; max-width: 1400px; margin: 0 auto; }
h1 { font-size: 24px; margin-bottom: 4px; }
h2 { font-size: 18px; margin: 24px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
h3 { font-size: 15px; margin: 16px 0 8px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
th { background: #f1f5f9; }
#candidates-table > thead > tr > th { cursor: pointer; user-select: none; position: sticky; top: 0; z-index: 2; background: #f1f5f9; }
#candidates-table > thead > tr > th:hover { background: #e2e8f0; }
.backlink-section { margin-top:16px; border-top:1px solid #e5e7eb; padding-top:12px; border-left:3px solid #3b82f6; padding-left:12px; background:#f0f7ff; border-radius:0 6px 6px 0; }
.backlink-section h4 { margin:0 0 8px; color:#1e40af; }
.backlink-section table th { background:#cbd5e1; font-size:11px; font-style:italic; padding:3px 8px; }
tr:hover { background: #f8fafc; }
.subtitle { color: #64748b; font-size: 14px; margin-bottom: 16px; }
.tab-bar { display: flex; gap: 0; margin-bottom: 0; border-bottom: 2px solid #e2e8f0; }
.tab { padding: 8px 20px; cursor: pointer; font-size: 14px; font-weight: 500; border: none; background: none; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tab.active { color: #1e293b; border-bottom-color: #3b82f6; }
.tab-content { display: none; }
.tab-content.active { display: block; }
.sort-arrow { font-size: 10px; margin-left: 4px; }
#bulk-toolbar { position: fixed; bottom: 0; left: 0; right: 0; background: #1e293b; color: #fff; padding: 10px 24px; display: flex; align-items: center; gap: 12px; z-index: 100; font-size: 14px; box-shadow: 0 -2px 8px rgba(0,0,0,0.2); transform: translateY(100%); transition: transform 0.2s; }
#bulk-toolbar.visible { transform: translateY(0); }
#bulk-toolbar select { padding: 4px 8px; border-radius: 4px; border: 1px solid #475569; background: #334155; color: #fff; font-size: 13px; }
#bulk-toolbar button { padding: 4px 14px; border-radius: 4px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
#bulk-apply { background: #3b82f6; color: #fff; }
#bulk-apply:hover { background: #2563eb; }
#bulk-clear { background: #475569; color: #fff; }
#bulk-clear:hover { background: #64748b; }
#report-panel { position:fixed;top:0;right:0;width:50%;height:100vh;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,0.15);z-index:200;transform:translateX(100%);transition:transform 0.25s ease;display:flex;flex-direction:column; }
#report-panel.open { transform:translateX(0); }
#report-panel-header { display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;flex-shrink:0; }
#report-panel-header h3 { font-size:16px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
#report-panel-close { background:none;border:none;font-size:22px;cursor:pointer;color:#64748b;padding:4px 8px;border-radius:4px; }
#report-panel-close:hover { background:#e2e8f0;color:#1e293b; }
#report-panel-body { flex:1;overflow-y:auto;padding:20px;font-size:14px;line-height:1.6; }
#report-panel-body h1 { font-size:20px;margin:0 0 12px;border-bottom:none; }
#report-panel-body h2 { font-size:16px;margin:16px 0 8px;border-bottom:1px solid #e2e8f0; }
#report-panel-body h3 { font-size:14px;margin:12px 0 6px; }
#report-panel-body table { font-size:13px;margin:8px 0 16px; }
#report-panel-body ul, #report-panel-body ol { margin:8px 0;padding-left:20px; }
#report-panel-body p { margin:8px 0; }
#report-panel-body hr { margin:16px 0;border:none;border-top:1px solid #e2e8f0; }
#report-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.2);z-index:199;display:none; }
#report-overlay.open { display:block; }
.report-btn { display:inline-block;padding:4px 12px;margin:4px 4px 0 0;border-radius:4px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#475569;transition:all 0.15s; }
.report-btn:hover { background:#f1f5f9;border-color:#94a3b8; }
.shortlist-btn { display:inline-block;padding:2px 10px;border-radius:4px;border:1px solid #3b82f6;background:#eff6ff;cursor:pointer;font-size:13px;color:#3b82f6;font-weight:500;transition:all 0.15s; }
.shortlist-btn:hover { background:#dbeafe; }
.renter-table > thead > tr > th { cursor: pointer; user-select: none; }
.renter-table > thead > tr > th:hover { background: #e2e8f0 !important; }
</style>
</head>
<body>

<div style="display:flex;align-items:center;gap:16px">
  <h1>Rank &amp; Rent — Research Dashboard</h1>
  <button id="rebuild-btn" onclick="rebuildDashboard()" style="padding:6px 16px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#475569;white-space:nowrap;transition:all 0.15s;user-select:none" onmousedown="this.style.transform='scale(0.96)'" onmouseup="this.style.transform=''" onmouseleave="this.style.transform=''">&#x21bb; Rebuild</button>
</div>
<p class="subtitle">Pipeline Results &bull; Generated ${new Date().toISOString().slice(0, 10)} &bull; ${funnel.total} candidates evaluated &bull; ${Object.keys(siteYamls).length} site plans &bull; ${buyers.length} renters found</p>

${shortlists.length > 0 ? `<p style="margin-bottom:16px;font-size:13px">Shortlist memos: ${shortlists.map((f) => `<button class="shortlist-btn" onclick="openReport('shortlist','${esc(f)}','${esc(f)}')">${esc(f)}</button>`).join(' ')}</p>` : ''}

<div class="tab-bar">
  <button class="tab active" onclick="showTab('funnel')">Pipeline Funnel</button>
  <button class="tab" onclick="showTab('candidates')">Candidates</button>
  <button class="tab" onclick="showTab('regions')">Regions &amp; Niches</button>
  <button class="tab" onclick="showTab('phase3')">Phase 3 — Sites &amp; Renters</button>
</div>

<div id="tab-funnel" class="tab-content active">
  <div class="card" style="margin-top:16px">
    <h3>Pipeline Funnel</h3>
    <div style="margin-top:12px">${funnelBar()}</div>
  </div>
</div>

<div id="tab-candidates" class="tab-content">
  <div class="card" style="margin-top:16px">
    <h3>All Candidates</h3>
    <p style="font-size:12px;color:#64748b;margin-bottom:8px">Click column headers to sort. Click a row with validation data to expand score details.</p>
    <label style="display:inline-flex;align-items:center;gap:6px;margin-bottom:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="show-walkaway"> Show walk_away candidates</label>
    <div style="overflow:auto;max-height:80vh">
      <table id="candidates-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="select-all"></th>
            <th data-col="1">Slug</th>
            <th data-col="2">Niche</th>
            <th data-col="3">Area</th>
            <th data-col="4" data-type="num">Vol Total</th>
            <th data-col="5" data-type="num">Vol Primary</th>
            <th data-col="6" data-type="num">CPC</th>
            <th data-col="7" data-type="num">Rent Est.</th>
            <th data-col="8" data-type="num">Avg Job</th>
            <th data-col="9" data-type="num">Score</th>
            <th data-col="10" data-type="num">Org</th>
            <th data-col="11">Status</th>
            <th data-col="12">Verdict</th>
            <th data-col="13" data-type="num">Pages</th>
            <th data-col="14" data-type="num">Renters</th>
          </tr>
        </thead>
        <tbody>
          ${candidateRows()}
        </tbody>
      </table>
    </div>
  </div>
</div>

<div id="tab-regions" class="tab-content">
  <div class="grid" style="margin-top:16px">
    <div class="card">
      <h3>By Area</h3>
      <table>
        <thead><tr><th>Area</th><th>Candidates</th><th>Viable (8+)</th><th>Best Score</th></tr></thead>
        <tbody>${regionTable()}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>By Niche</h3>
      <table>
        <thead><tr><th>Niche</th><th>Candidates</th><th>Viable (8+)</th><th>Best Score</th><th>Avg Job</th></tr></thead>
        <tbody>${nicheTable()}</tbody>
      </table>
    </div>
  </div>
</div>

<div id="tab-phase3" class="tab-content">
  <div class="grid" style="margin-top:16px">
    <div class="card">
      <h3 style="color:#6b7280">Site Plans</h3>
      <div style="font-size:28px;font-weight:bold">${Object.keys(keywordsSummary).length}</div>
      <div style="font-size:12px;color:#64748b">of ${funnel.shortlisted} shortlisted</div>
    </div>
    <div class="card">
      <h3 style="color:#6b7280">Total Renters</h3>
      <div style="font-size:28px;font-weight:bold">${rentersSummary.totals.total}</div>
      <div style="font-size:12px;color:#64748b">${rentersSummary.totals.hot} hot &bull; ${rentersSummary.totals.warm} warm &bull; ${rentersSummary.totals.cold} cold</div>
    </div>
    <div class="card">
      <h3 style="color:#6b7280">Hot Leads</h3>
      <div style="font-size:28px;font-weight:bold;color:#ef4444">${rentersSummary.totals.hot}</div>
      <div style="font-size:12px;color:#64748b">ready for pitch</div>
    </div>
  </div>

  ${phase3Cards()}
</div>

<div id="bulk-toolbar">
  <span id="bulk-count">0 selected</span>
  <select id="bulk-status">
    <option value="discovered">discovered</option>
    <option value="validated">validated</option>
    <option value="torn_down">torn_down</option>
    <option value="viable">viable</option>
    <option value="shortlisted">shortlisted</option>
    <option value="walk_away">walk_away</option>
  </select>
  <button id="bulk-apply">Apply</button>
  <button id="bulk-clear">Clear</button>
</div>

<div id="report-overlay" onclick="closeReport()"></div>
<div id="report-panel">
  <div id="report-panel-header">
    <h3 id="report-panel-title"></h3>
    <button id="report-panel-close" onclick="closeReport()">&times;</button>
  </div>
  <div id="report-panel-body"></div>
</div>

<script>
window.__REPORTS__ = {
  teardowns: ${JSON.stringify(teardownHtmlMap)},
  viability: ${JSON.stringify(viabilityHtmlMap)},
  shortlists: ${JSON.stringify(shortlistHtmlMap)}
};
window.__DETAILS__ = ${JSON.stringify(buildDetailsJson())};
window.__WALKAWAY__ = ${JSON.stringify(buildWalkawayJson())};

function esc(str) {
  var d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

function statusColor(s) {
  switch (s) {
    case 'shortlisted': return '#22c55e';
    case 'validated': return '#eab308';
    case 'torn_down': return '#3b82f6';
    case 'walk_away': return '#ef4444';
    default: return '#6b7280';
  }
}

function statusBg(s) {
  switch (s) {
    case 'shortlisted': return '#dcfce7';
    case 'validated': return '#fef9c3';
    case 'torn_down': return '#dbeafe';
    case 'walk_away': return '#fee2e2';
    default: return '#f3f4f6';
  }
}

function verdictBadgeHtml(v) {
  if (!v) return '';
  var colors = { BEATABLE: '#22c55e', TOUGH: '#eab308', SKIP: '#ef4444' };
  var bg = colors[v] || '#6b7280';
  return '<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:' + bg + ';color:#fff;font-weight:bold;font-size:12px">' + esc(v) + '</span>';
}

function barChartSvgHtml(signals) {
  if (!signals) return '';
  var labels = ['Vol', 'CPC', 'Map', 'Org', 'Rent', 'Lic', 'Seas', 'RentP'];
  var keys = ['volume', 'cpc', 'mapPack', 'organic', 'renters', 'license', 'seasonality', 'rent'];
  var barW = 28, gap = 4, maxH = 50;
  var totalW = keys.length * (barW + gap);
  var bars = '';
  keys.forEach(function(k, i) {
    var val = signals[k] || 0;
    var h = (val / 2) * maxH;
    var x = i * (barW + gap);
    var y = maxH - h;
    var color = val === 2 ? '#22c55e' : val === 1 ? '#eab308' : '#ef4444';
    bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + (h || 2) + '" fill="' + color + '" rx="2"/>';
    bars += '<text x="' + (x + barW / 2) + '" y="' + (maxH + 14) + '" text-anchor="middle" font-size="9" fill="#666">' + labels[i] + '</text>';
    bars += '<text x="' + (x + barW / 2) + '" y="' + (y - 3) + '" text-anchor="middle" font-size="9" fill="#333">' + val + '</text>';
  });
  return '<svg width="' + totalW + '" height="' + (maxH + 20) + '" viewBox="0 0 ' + totalW + ' ' + (maxH + 20) + '">' + bars + '</svg>';
}

function sparklineSvgHtml(values, width, height) {
  width = width || 120; height = height || 30;
  if (!values || values.length === 0) return '';
  var max = Math.max.apply(null, values);
  var min = Math.min.apply(null, values);
  var range = max - min || 1;
  var step = width / (values.length - 1);
  var points = values.map(function(v, i) { return (i * step) + ',' + (height - ((v - min) / range) * (height - 4) - 2); }).join(' ');
  return '<svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" style="vertical-align:middle"><polyline points="' + points + '" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function buildBacklinkHtml(bl) {
  if (!bl) return '';
  var competitorTables = '';
  if (bl.competitors && bl.competitors.length > 0) {
    competitorTables = bl.competitors.map(function(comp) {
      var rows = (comp.top_referring_domains || []).slice(0, 20).map(function(ref) {
        return '<tr><td style="font-size:12px">' + esc(ref.domain) + '</td><td style="font-size:12px">' + (ref.rank || '—') + '</td><td style="font-size:12px">' + (ref.backlinks || '—') + '</td><td style="font-size:12px">' + (ref.first_seen || '—') + '</td></tr>';
      }).join('');
      return '<div style="margin-bottom:12px"><h5 style="margin:0 0 4px">Referring Domains for <em>' + esc(comp.domain) + '</em> <span style="font-weight:normal;color:#666;font-size:12px">(' + ((comp.summary && comp.summary.referring_domains) || '?') + ' ref. domains, rank ' + ((comp.summary && comp.summary.rank) || '?') + ')</span></h5><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:4px">Domain</th><th style="text-align:left;padding:4px">Rank</th><th style="text-align:left;padding:4px">Backlinks</th><th style="text-align:left;padding:4px">First Seen</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }).join('');
  }
  var commonHtml = bl.common_sources && bl.common_sources.length > 0
    ? '<div style="margin-top:8px"><strong>Common Sources</strong> (link to 2+ competitors): <span style="color:#22c55e;font-weight:bold">' + bl.common_sources.map(esc).join(', ') + '</span></div>'
    : '';
  var targetsHtml = bl.link_building_targets && bl.link_building_targets.length > 0
    ? '<div style="margin-top:8px"><strong>Link Building Targets:</strong> ' + bl.link_building_targets.map(esc).join(', ') + '</div>'
    : '';
  return '<div class="backlink-section"><h4>Backlink Sources</h4>' + competitorTables + commonHtml + targetsHtml + '</div>';
}

function renderDetail(mainRow) {
  var slug = mainRow.dataset.slug;
  var d = window.__DETAILS__[slug];
  if (!d) return null;
  var html = '<td colspan="15" style="padding:16px;background:#f9fafb;border-top:none"><div style="display:flex;gap:24px;flex-wrap:wrap">';
  html += '<div><h4 style="margin:0 0 8px">Score Breakdown</h4>' + barChartSvgHtml(d.signals) + '</div>';
  html += '<div><h4 style="margin:0 0 8px">Monthly Trends</h4>' + sparklineSvgHtml(d.trends_monthly, 180, 40) + '</div>';
  html += '<div><h4 style="margin:0 0 8px">Map Pack Top 3</h4>';
  if (d.maps_data && d.maps_data.topThree && d.maps_data.topThree.length > 0) {
    html += '<ul style="margin:0;padding-left:16px;font-size:13px">' + d.maps_data.topThree.map(function(m) { return '<li>' + m.reviews + ' reviews (' + m.rating + '★)</li>'; }).join('') + '</ul>';
  } else {
    html += '<span style="color:#999;font-size:13px">No map pack data</span>';
  }
  html += '</div>';
  html += '<div><h4 style="margin:0 0 8px">Organic Domains</h4>';
  if (d.organic_domains && d.organic_domains.length > 0) {
    html += '<ul style="margin:0;padding-left:16px;font-size:13px">' + d.organic_domains.map(function(x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  } else {
    html += '<span style="color:#999;font-size:13px">None</span>';
  }
  html += '</div></div>';
  if (d.teardownVerdict) {
    html += '<div style="margin-top:12px"><strong>Teardown Verdict:</strong> ' + verdictBadgeHtml(d.teardownVerdict) + '</div>';
  }
  if (d.teardownAssessment) {
    var borderColor = d.teardownVerdict === 'BEATABLE' ? '#22c55e' : d.teardownVerdict === 'TOUGH' ? '#eab308' : '#ef4444';
    html += '<div style="margin-top:8px;padding:8px 12px;background:#f0f4f8;border-radius:6px;font-size:13px;line-height:1.5;color:#334155;border-left:3px solid ' + borderColor + '">' + esc(d.teardownAssessment) + '</div>';
  }
  html += '<div style="margin-top:10px">';
  if (d.hasTeardownReport) html += '<button class="report-btn" onclick="event.stopPropagation();openReport(&quot;teardown&quot;,&quot;' + esc(slug) + '&quot;,&quot;Teardown: ' + esc(slug) + '&quot;)">View Full Teardown</button>';
  if (d.hasViabilityReport) html += '<button class="report-btn" onclick="event.stopPropagation();openReport(&quot;viability&quot;,&quot;' + esc(slug) + '&quot;,&quot;Viability: ' + esc(slug) + '&quot;)">View Viability Report</button>';
  html += '</div>';
  html += buildBacklinkHtml(d.backlinkSources);
  html += '</td>';
  var tr = document.createElement('tr');
  tr.className = 'detail-row';
  tr.dataset.slug = slug;
  tr.innerHTML = html;
  return tr;
}

function toggleDetail(mainRow) {
  var next = mainRow.nextElementSibling;
  if (next && next.classList.contains('detail-row')) {
    next.style.display = next.style.display === 'none' ? 'table-row' : 'none';
  } else {
    var detailTr = renderDetail(mainRow);
    if (detailTr) mainRow.parentNode.insertBefore(detailTr, mainRow.nextSibling);
  }
}

function openReport(type, key, title) {
  var map = type === 'teardown' ? window.__REPORTS__.teardowns
          : type === 'viability' ? window.__REPORTS__.viability
          : window.__REPORTS__.shortlists;
  var html = map[key];
  if (!html) return;
  document.getElementById('report-panel-title').textContent = title;
  document.getElementById('report-panel-body').innerHTML = html;
  document.getElementById('report-panel').classList.add('open');
  document.getElementById('report-overlay').classList.add('open');
}

function closeReport() {
  document.getElementById('report-panel').classList.remove('open');
  document.getElementById('report-overlay').classList.remove('open');
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeReport();
});

// Tab switching
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(el) { el.classList.remove('active'); });
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector('[onclick="showTab(\\'' + name + '\\')"]').classList.add('active');
}

// Walk_away toggle — builds rows from __WALKAWAY__ columnar data on demand
(function() {
  var tbody = document.querySelector('#candidates-table tbody');
  var toggle = document.getElementById('show-walkaway');
  if (!tbody || !toggle) return;
  var walkawayRows = [];
  var cols = window.__WALKAWAY__[0]; // column names
  var ci = {}; cols.forEach(function(name, i) { ci[name] = i; });

  function buildWalkawayRow(row) {
    var slug = row[ci.slug], niche = row[ci.niche], area = row[ci.area];
    var vol_total = row[ci.vol_total], vol_primary = row[ci.vol_primary], cpc = row[ci.cpc];
    var rent_estimate = row[ci.rent_estimate], avgJobLow = row[ci.avgJobLow];
    var jobValueRange = row[ci.jobValueRange], score = row[ci.score_total] || '';
    var score_organic = row[ci.score_organic], status = row[ci.status];
    var teardownVerdict = row[ci.teardownVerdict], teardownKeyFinding = row[ci.teardownKeyFinding];
    var pageCount = row[ci.pageCount], renterTotal = row[ci.renterTotal], renterHot = row[ci.renterHot];
    var hasDetail = row[ci.hasDetail];

    var bg = statusBg(status);
    var orgHtml = score_organic != null ? '<span style="color:' + (String(score_organic) === '2' ? '#22c55e' : String(score_organic) === '1' ? '#eab308' : '#ef4444') + ';font-weight:bold">' + score_organic + '</span>' : '—';
    var renterHtml = renterTotal ? renterTotal + ' (' + renterHot + ' hot)' : '—';

    var tr = document.createElement('tr');
    tr.dataset.slug = slug;
    tr.dataset.status = status;
    tr.style.background = bg;
    tr.style.cursor = hasDetail ? 'pointer' : 'default';
    if (hasDetail) tr.onclick = function() { toggleDetail(tr); };
    tr.innerHTML =
      '<td onclick="event.stopPropagation()"><input type="checkbox" class="row-select" data-slug="' + esc(slug) + '"></td>' +
      '<td>' + esc(slug) + '</td>' +
      '<td>' + esc(niche) + '</td>' +
      '<td>' + esc(area) + '</td>' +
      '<td data-sort="' + vol_total + '">' + (vol_total || '—') + '</td>' +
      '<td data-sort="' + vol_primary + '">' + (vol_primary || '—') + '</td>' +
      '<td data-sort="' + cpc + '">' + (cpc ? '$' + parseFloat(cpc).toFixed(2) : '—') + '</td>' +
      '<td data-sort="' + rent_estimate + '">' + (rent_estimate ? '$' + parseFloat(rent_estimate).toFixed(0) : '—') + '</td>' +
      '<td data-sort="' + avgJobLow + '">' + (jobValueRange || '—') + '</td>' +
      '<td data-sort="' + score + '">' + (score || '—') + '</td>' +
      '<td data-sort="' + (score_organic != null ? score_organic : '') + '">' + orgHtml + '</td>' +
      '<td><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:' + statusColor(status) + ';color:#fff;font-size:11px">' + esc(status) + '</span></td>' +
      '<td>' + (teardownVerdict ? verdictBadgeHtml(teardownVerdict) : '') + (teardownKeyFinding ? '<div style="font-size:11px;color:#555;margin-top:2px;max-width:220px;line-height:1.3">' + esc(teardownKeyFinding) + '</div>' : '') + '</td>' +
      '<td data-sort="' + pageCount + '">' + (pageCount || '—') + '</td>' +
      '<td data-sort="' + renterTotal + '">' + renterHtml + '</td>';
    return tr;
  }

  toggle.addEventListener('change', function() {
    if (this.checked) {
      if (walkawayRows.length === 0) {
        for (var i = 1; i < window.__WALKAWAY__.length; i++) {
          walkawayRows.push(buildWalkawayRow(window.__WALKAWAY__[i]));
        }
      }
      walkawayRows.forEach(function(tr) { tbody.appendChild(tr); });
    } else {
      walkawayRows.forEach(function(tr) {
        var next = tr.nextElementSibling;
        if (next && next.classList.contains('detail-row')) next.remove();
        tr.remove();
        var cb = tr.querySelector('.row-select');
        if (cb) cb.checked = false;
      });
      updateToolbar();
    }
  });
})();

// Checkbox / toolbar logic
function getSelectedSlugs() {
  return Array.from(document.querySelectorAll('.row-select:checked')).map(function(cb) { return cb.dataset.slug; });
}

function updateToolbar() {
  var selected = getSelectedSlugs();
  var toolbar = document.getElementById('bulk-toolbar');
  var count = document.getElementById('bulk-count');
  count.textContent = selected.length + ' selected';
  if (selected.length > 0) { toolbar.classList.add('visible'); } else { toolbar.classList.remove('visible'); }
}

// Select-all (visible rows only)
document.getElementById('select-all').addEventListener('change', function() {
  var checked = this.checked;
  document.querySelectorAll('#candidates-table tbody tr:not(.detail-row)').forEach(function(tr) {
    if (tr.offsetParent === null) return;
    var cb = tr.querySelector('.row-select');
    if (cb) cb.checked = checked;
  });
  updateToolbar();
});

// Per-row checkbox
document.addEventListener('change', function(e) {
  if (e.target.classList.contains('row-select')) updateToolbar();
});

// Apply button
document.getElementById('bulk-apply').addEventListener('click', function() {
  var slugs = getSelectedSlugs();
  if (slugs.length === 0) return;
  var status = document.getElementById('bulk-status').value;
  if (!confirm('Set ' + slugs.length + ' candidate(s) to "' + status + '"?')) return;
  var updates = slugs.map(function(slug) { return { slug: slug, status: status }; });
  fetch('/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates: updates }),
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.ok) location.reload();
    else alert('Error: ' + (data.error || 'unknown'));
  }).catch(function(err) { alert('Request failed: ' + err.message); });
});

// Clear button
document.getElementById('bulk-clear').addEventListener('click', function() {
  document.querySelectorAll('.row-select:checked').forEach(function(cb) { cb.checked = false; });
  document.getElementById('select-all').checked = false;
  updateToolbar();
});

// Rebuild button
function rebuildDashboard() {
  var btn = document.getElementById('rebuild-btn');
  btn.disabled = true;
  btn.style.background = '#e2e8f0';
  btn.style.color = '#94a3b8';
  btn.style.cursor = 'wait';
  btn.innerHTML = '&#x23f3; Rebuilding\u2026';
  if (location.protocol === 'file:') {
    alert('Rebuild requires the dashboard server.\\nRun: node scripts/serve-dashboard.mjs');
    resetBtn();
    return;
  }
  fetch('/api/rebuild', { method: 'POST' })
    .then(function(r) {
      if (r.status === 404) throw new Error('Server does not have /api/rebuild. Restart serve-dashboard.mjs.');
      return r.json();
    })
    .then(function(data) {
      if (data.ok) { btn.innerHTML = '&#x2713; Done'; location.reload(); }
      else { alert('Rebuild failed: ' + (data.error || 'unknown')); resetBtn(); }
    })
    .catch(function(err) { alert(err.message); resetBtn(); });
  function resetBtn() { btn.disabled = false; btn.style.background = '#fff'; btn.style.color = '#475569'; btn.style.cursor = 'pointer'; btn.innerHTML = '&#x21bb; Rebuild'; }
}

// Sortable table
(function() {
  var table = document.getElementById('candidates-table');
  if (!table) return;
  var headers = table.querySelectorAll('th[data-col]');
  var sortCol = -1, sortAsc = true;

  headers.forEach(function(th) {
    th.addEventListener('click', function() {
      var col = parseInt(this.dataset.col);
      var isNum = this.dataset.type === 'num';
      if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = true; }

      // Collect row pairs (data row + optional detail row)
      var tbody = table.querySelector('tbody');
      var allRows = Array.from(tbody.children);
      var pairs = [];
      for (var i = 0; i < allRows.length; i++) {
        if (allRows[i].classList.contains('detail-row')) continue;
        var detail = allRows[i + 1] && allRows[i + 1].classList.contains('detail-row') ? allRows[i + 1] : null;
        pairs.push({ main: allRows[i], detail: detail });
      }

      pairs.sort(function(a, b) {
        var cellA = a.main.children[col];
        var cellB = b.main.children[col];
        var valA = cellA.dataset.sort !== undefined ? cellA.dataset.sort : cellA.textContent.trim();
        var valB = cellB.dataset.sort !== undefined ? cellB.dataset.sort : cellB.textContent.trim();
        if (isNum) { valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0; }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });

      // Re-append in sorted order
      pairs.forEach(function(p) { tbody.appendChild(p.main); if (p.detail) tbody.appendChild(p.detail); });

      // Update arrow indicators
      headers.forEach(function(h) { var arrow = h.querySelector('.sort-arrow'); if (arrow) arrow.remove(); });
      this.insertAdjacentHTML('beforeend', '<span class="sort-arrow">' + (sortAsc ? '▲' : '▼') + '</span>');
    });
  });
})();

// Sortable renter tables
(function() {
  document.addEventListener('click', function(e) {
    var th = e.target.closest('.renter-table > thead > tr > th');
    if (!th) return;
    var table = th.closest('table');
    var col = parseInt(th.dataset.col);
    var type = th.dataset.type;
    var prev = th.dataset.sortDir;
    var asc = prev === 'asc' ? false : true;

    // Reset arrows on sibling headers
    table.querySelectorAll('thead th').forEach(function(h) {
      var arrow = h.querySelector('.sort-arrow');
      if (arrow) arrow.remove();
      delete h.dataset.sortDir;
    });
    th.dataset.sortDir = asc ? 'asc' : 'desc';
    th.insertAdjacentHTML('beforeend', '<span class="sort-arrow">' + (asc ? '▲' : '▼') + '</span>');

    var tbody = table.querySelector('tbody');
    var rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort(function(a, b) {
      var cellA = a.children[col];
      var cellB = b.children[col];
      var valA, valB;
      if (type === 'num' || type === 'priority') {
        valA = parseFloat(cellA.dataset.sort) || 0;
        valB = parseFloat(cellB.dataset.sort) || 0;
      } else {
        valA = cellA.textContent.trim().toLowerCase();
        valB = cellB.textContent.trim().toLowerCase();
      }
      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    });
    rows.forEach(function(r) { tbody.appendChild(r); });
  });
})();
</script>

</body>
</html>`

// ── Write output ───────────────────────────────────────────

const outPath = join(ROOT, 'index.html')
writeFileSync(outPath, html, 'utf8')
console.log(`Dashboard written to ${outPath}`)
console.log(`  ${funnel.total} candidates, ${funnel.validated} validated, ${funnel.shortlisted} shortlisted`)
console.log(`  ${Object.keys(validationMap).length} validation files, ${Object.keys(teardownMap).length} teardowns, ${Object.keys(backlinkMap).length} backlink sources`)
console.log(`  ${Object.keys(siteYamls).length} site plans, ${buyers.length} renters (${rentersSummary.totals.hot} hot)`)
