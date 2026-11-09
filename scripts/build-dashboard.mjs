#!/usr/bin/env node

/**
 * build-dashboard.mjs
 * Reads Phase 2 research data and generates a self-contained HTML dashboard.
 *
 * Usage: node scripts/build-dashboard.mjs
 * Output: research/dashboard.html
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { parseCandidatesCsv } from '../lib/candidates.js'
import {
  buildFunnel,
  enrichCandidates,
  enrichWithJobEconomics,
  extractTeardownVerdict,
  buildRegionSummary,
  buildNicheSummary,
  findCommonSources,
  prioritizeLinkTargets,
} from '../lib/dashboard-data.js'
import { parseNicheEconomics } from '../lib/niche-economics-parser.js'

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

// Load teardown verdicts
const teardownMap = {}
for (const slug of readdirSync(researchDir)) {
  const tPath = join(researchDir, slug, 'teardown.md')
  if (existsSync(tPath)) {
    const verdict = extractTeardownVerdict(readFileSync(tPath, 'utf8'))
    if (verdict) teardownMap[slug] = verdict
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

// Load niche economics
const economicsPath = join(ROOT, 'reference', 'niche-economics.md')
const economicsMap = existsSync(economicsPath)
  ? parseNicheEconomics(readFileSync(economicsPath, 'utf8'))
  : new Map()

// ── Process data ───────────────────────────────────────────

const funnel = buildFunnel(candidates)
let enriched = enrichCandidates(candidates, validationMap, teardownMap, backlinkMap)
enriched = enrichWithJobEconomics(enriched, economicsMap)
const regionSummary = buildRegionSummary(candidates)
const nicheSummary = buildNicheSummary(candidates, economicsMap)

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

// ── Build candidate rows ───────────────────────────────────

function candidateRows() {
  return enriched.map((c, idx) => {
    const score = c.score_total || ''
    const bg = statusBg(c.status)
    const hasDetail = !!c.validation

    let detailHtml = ''
    if (c.validation) {
      const v = c.validation
      detailHtml = `
      <tr class="detail-row" data-slug="${esc(c.slug)}" data-status="${esc(c.status)}" id="detail-${idx}" style="display:none">
        <td colspan="13" style="padding:16px;background:#f9fafb;border-top:none">
          <div style="display:flex;gap:24px;flex-wrap:wrap">
            <div>
              <h4 style="margin:0 0 8px">Score Breakdown</h4>
              ${barChartSvg(v.signals)}
            </div>
            <div>
              <h4 style="margin:0 0 8px">Monthly Trends</h4>
              ${sparklineSvg(v.trends_monthly, 180, 40)}
            </div>
            <div>
              <h4 style="margin:0 0 8px">Map Pack Top 3</h4>
              ${v.maps_data && v.maps_data.topThree && v.maps_data.topThree.length > 0
                ? `<ul style="margin:0;padding-left:16px;font-size:13px">${v.maps_data.topThree.map((m) => `<li>${m.reviews} reviews (${m.rating}★)</li>`).join('')}</ul>`
                : '<span style="color:#999;font-size:13px">No map pack data</span>'}
            </div>
            <div>
              <h4 style="margin:0 0 8px">Organic Domains</h4>
              ${v.organic_domains && v.organic_domains.length > 0
                ? `<ul style="margin:0;padding-left:16px;font-size:13px">${v.organic_domains.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
                : '<span style="color:#999;font-size:13px">None</span>'}
            </div>
          </div>
          ${c.teardownVerdict ? `<div style="margin-top:12px"><strong>Teardown Verdict:</strong> ${verdictBadge(c.teardownVerdict)}</div>` : ''}
          ${buildBacklinkSection(c)}
        </td>
      </tr>`
    }

    return `
    <tr data-slug="${esc(c.slug)}" data-status="${esc(c.status)}" style="background:${bg};cursor:${hasDetail ? 'pointer' : 'default'}" ${hasDetail ? `onclick="toggleDetail(${idx})"` : ''}>
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
      <td>${c.teardownVerdict ? verdictBadge(c.teardownVerdict) : ''}</td>
    </tr>${detailHtml}`
  }).join('')
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
<title>Rank &amp; Rent — Phase 2 Research Dashboard</title>
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
.hide-walkaway tr[data-status="walk_away"] { display: none; }
#bulk-toolbar { position: fixed; bottom: 0; left: 0; right: 0; background: #1e293b; color: #fff; padding: 10px 24px; display: flex; align-items: center; gap: 12px; z-index: 100; font-size: 14px; box-shadow: 0 -2px 8px rgba(0,0,0,0.2); transform: translateY(100%); transition: transform 0.2s; }
#bulk-toolbar.visible { transform: translateY(0); }
#bulk-toolbar select { padding: 4px 8px; border-radius: 4px; border: 1px solid #475569; background: #334155; color: #fff; font-size: 13px; }
#bulk-toolbar button { padding: 4px 14px; border-radius: 4px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
#bulk-apply { background: #3b82f6; color: #fff; }
#bulk-apply:hover { background: #2563eb; }
#bulk-clear { background: #475569; color: #fff; }
#bulk-clear:hover { background: #64748b; }
</style>
</head>
<body>

<h1>Rank &amp; Rent — Research Dashboard</h1>
<p class="subtitle">Phase 2 Pipeline Results &bull; Generated ${new Date().toISOString().slice(0, 10)} &bull; ${funnel.total} candidates evaluated</p>

${shortlists.length > 0 ? `<p style="margin-bottom:16px;font-size:13px">📋 Shortlist memos: ${shortlists.map((f) => `<a href="${f}" style="color:#3b82f6">${f}</a>`).join(', ')}</p>` : ''}

<div class="tab-bar">
  <button class="tab active" onclick="showTab('funnel')">Pipeline Funnel</button>
  <button class="tab" onclick="showTab('candidates')">Candidates</button>
  <button class="tab" onclick="showTab('regions')">Regions &amp; Niches</button>
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

<script>
// Tab switching
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector('[onclick="showTab(\\'' + name + '\\')"]').classList.add('active');
}

// Detail row toggle
function toggleDetail(idx) {
  const row = document.getElementById('detail-' + idx);
  if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

// Walk_away toggle
(function() {
  const tbody = document.querySelector('#candidates-table tbody');
  const toggle = document.getElementById('show-walkaway');
  if (!tbody || !toggle) return;
  tbody.classList.add('hide-walkaway');
  toggle.addEventListener('change', function() {
    if (this.checked) {
      tbody.classList.remove('hide-walkaway');
    } else {
      tbody.classList.add('hide-walkaway');
      // Uncheck any selected walk_away rows
      tbody.querySelectorAll('tr[data-status="walk_away"] .row-select:checked').forEach(cb => { cb.checked = false; });
      updateToolbar();
    }
  });
})();

// Checkbox / toolbar logic
function getSelectedSlugs() {
  return Array.from(document.querySelectorAll('.row-select:checked')).map(cb => cb.dataset.slug);
}

function updateToolbar() {
  const selected = getSelectedSlugs();
  const toolbar = document.getElementById('bulk-toolbar');
  const count = document.getElementById('bulk-count');
  count.textContent = selected.length + ' selected';
  if (selected.length > 0) { toolbar.classList.add('visible'); } else { toolbar.classList.remove('visible'); }
}

// Select-all (visible rows only)
document.getElementById('select-all').addEventListener('change', function() {
  const checked = this.checked;
  document.querySelectorAll('#candidates-table tbody tr:not(.detail-row)').forEach(tr => {
    if (tr.offsetParent === null) return; // hidden (walk_away)
    const cb = tr.querySelector('.row-select');
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
  const slugs = getSelectedSlugs();
  if (slugs.length === 0) return;
  const status = document.getElementById('bulk-status').value;
  if (!confirm('Set ' + slugs.length + ' candidate(s) to "' + status + '"?')) return;
  const updates = slugs.map(slug => ({ slug, status }));
  fetch('/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  }).then(r => r.json()).then(data => {
    if (data.ok) location.reload();
    else alert('Error: ' + (data.error || 'unknown'));
  }).catch(err => alert('Request failed: ' + err.message));
});

// Clear button
document.getElementById('bulk-clear').addEventListener('click', function() {
  document.querySelectorAll('.row-select:checked').forEach(cb => { cb.checked = false; });
  document.getElementById('select-all').checked = false;
  updateToolbar();
});

// Sortable table
(function() {
  const table = document.getElementById('candidates-table');
  if (!table) return;
  const headers = table.querySelectorAll('th[data-col]');
  let sortCol = -1, sortAsc = true;

  headers.forEach(th => {
    th.addEventListener('click', function() {
      const col = parseInt(this.dataset.col);
      const isNum = this.dataset.type === 'num';
      if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = true; }

      // Collect row pairs (data row + optional detail row)
      const tbody = table.querySelector('tbody');
      const allRows = Array.from(tbody.children);
      const pairs = [];
      for (let i = 0; i < allRows.length; i++) {
        if (allRows[i].classList.contains('detail-row')) continue;
        const detail = allRows[i + 1] && allRows[i + 1].classList.contains('detail-row') ? allRows[i + 1] : null;
        pairs.push({ main: allRows[i], detail });
      }

      pairs.sort((a, b) => {
        const cellA = a.main.children[col];
        const cellB = b.main.children[col];
        let valA = cellA.dataset.sort !== undefined ? cellA.dataset.sort : cellA.textContent.trim();
        let valB = cellB.dataset.sort !== undefined ? cellB.dataset.sort : cellB.textContent.trim();
        if (isNum) { valA = parseFloat(valA) || 0; valB = parseFloat(valB) || 0; }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });

      // Re-append in sorted order (DOM move preserves checkbox state)
      pairs.forEach(p => { tbody.appendChild(p.main); if (p.detail) tbody.appendChild(p.detail); });

      // Update arrow indicators
      headers.forEach(h => { const arrow = h.querySelector('.sort-arrow'); if (arrow) arrow.remove(); });
      this.insertAdjacentHTML('beforeend', '<span class="sort-arrow">' + (sortAsc ? '▲' : '▼') + '</span>');
    });
  });
})();
</script>

</body>
</html>`

// ── Write output ───────────────────────────────────────────

const outPath = join(ROOT, 'research', 'dashboard.html')
writeFileSync(outPath, html, 'utf8')
console.log(`Dashboard written to ${outPath}`)
console.log(`  ${funnel.total} candidates, ${funnel.validated} validated, ${funnel.shortlisted} shortlisted`)
console.log(`  ${Object.keys(validationMap).length} validation files, ${Object.keys(teardownMap).length} teardowns, ${Object.keys(backlinkMap).length} backlink sources`)
