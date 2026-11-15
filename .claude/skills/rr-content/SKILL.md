# rr-content

**Purpose:** Write body prose for scaffold content files and create figure data JSON files.

## Inputs

- `sites/<slug>/site.yaml` — brand, city, state, towns, pages array
- `sites/<slug>/content/*.md` — scaffold files (frontmatter only, status: draft)
- `niches/<niche>/pack.yaml` — page outlines with `content_guidance`, figure definitions
- `niches/<niche>/brief.md` — economics, competitor patterns, editorial notes
- `research/areas/<town>.md` — local facts (town pages only)
- `reference/content-rules.md` — word counts, structure, banned claims
- `reference/ranking-playbook.md` — cross-site similarity thresholds (§1)
- `reference/data-viz.md` — figure provenance rules
- `reference/niche-economics.md` — job value ranges
- `data/content-hashes.json` — existing paragraph hashes for dedup

## Outputs

- Body prose in `sites/<slug>/content/*.md` below existing frontmatter
- Figure data in `sites/<slug>/figures/<id>.json` (≥3 per site)
- Updated `data/content-hashes.json` with new paragraph hashes
- Frontmatter updates: `sources[]`, `faqs[]`, `town_facts[]`, `figures[]`

## Page-Type Workflows

Each page type follows a specific content structure from `reference/content-rules.md`. The pilot site at `sites/epoxy-flooring-new-braunfels/content/` is the gold standard.

### Home (800–1,500 words)

1. Brand + city intro paragraph with primary keyword in first 100 words
2. What the service is and who it's for
3. Local context — geography, growth, climate, why it matters to the service
4. Services offered with internal links to service pages
5. Areas served with internal links to town pages
6. 3-step process (Request a Quote → Surface Prep → Installation)
7. Call to action with phone placeholder

### Service (500–1,000 words)

1. What the service involves — materials, process, applications
2. Common problems it solves
3. Cost range from the niche brief, with "costs vary by contractor" disclaimer
4. The process — what to expect from first call to finished job
5. Internal links to related services and the cost guide
6. Call to action

### Town (500–1,000 words)

1. Local intro tying the service to the town, primary keyword in first 100 words
2. At least 3 sourced facts from `research/areas/<town>.md`
3. Common local issues relevant to the service (soil type, climate, growth)
4. Permits and rules: whether a permit is needed, issuing office, HOA/land-use note — with source
5. Which 1–2 sub-services this town skews toward and why, linking to those pages
6. Service logistics: distance/response from hub city, named neighborhoods and corridors
7. At least one paragraph that could not be moved to another town page and still be true
8. Call to action

**Hard requirement:** Never write a town page without a ready fact sheet. If `research/areas/<town>.md` does not exist or cannot support steps 4–7, stop and report the town as blocked.

### Cost Guide (500–1,000 words)

1. Headline range for the typical job, primary keyword in first 100 words
2. Figure reference: cost range by sub-service or tier (frontmatter `figures[]`)
3. What drives price up or down (size, condition, materials, access, permits)
4. "Costs vary by contractor" disclaimer
5. Sources and "Last updated" date
6. Call to action

### Tool (300–800 words)

1. One-paragraph explanation of what the tool estimates and its inputs
2. The tool (Astro island) — its result screen draws the estimate as a figure
3. How the estimate was built (sources from the niche brief), "costs vary" note
4. 3–5 FAQs the tool raises (FAQPage schema in frontmatter)
5. Figure reference in frontmatter `figures[]`
6. Call to action

### FAQ (400–1,000 words)

1. Brief intro paragraph with primary keyword
2. H3 per question
3. 2–4 sentence answers per question
4. Practical, homeowner-oriented language
5. Internal links to relevant service or cost pages where natural

### Guide (600–1,500 words)

1. Overview paragraph tying the guide topic to the city
2. Key details — the comparison, the lifespan data, the maintenance schedule
3. Figure reference where the guide topic is "vs." or "how long" (frontmatter `figures[]`)
4. Practical takeaway for the homeowner
5. Call to action

## Figure Creation

Every site ships at least 3 data figures (tool + cost guide + one more). Each figure is a JSON file at `sites/<slug>/figures/<id>.json`.

### Figure JSON schema

```json
{
  "title": "Epoxy Flooring Cost by Finish Type",
  "unit": "$/sq ft",
  "series": [
    { "label": "Solid Color", "low": 3, "high": 7 },
    { "label": "Metallic", "low": 5, "high": 12 }
  ],
  "source": {
    "label": "Niche brief sub-service editorial notes",
    "brief_section": "Job Economics"
  },
  "updated": "2026-11-14"
}
```

### Figure rules (from `reference/data-viz.md`)

- Numbers must trace to: niche brief, `niche-economics.md`, town facts sheet, or a cited external source
- Ranges stay ranges (low/high) — never a single-point price unless the source is a fixed fee
- No fabricated variance: if two sites have the same cost in the brief, show the same number or drop the figure
- Re-express ranges per site (different rounding, different labels) — no identical series across same-niche sites
- 1–6 series entries per figure
- `source.label` is mandatory, `source.url` and `source.brief_section` are optional

## Paragraph Deduplication

Every body paragraph is checked via the content-hashes module before saving.

```javascript
import { loadHashes, checkAndAdd, saveHashes } from '../lib/content-hashes.js'

const hashes = await loadHashes('data/content-hashes.json')

// For each paragraph written:
const isNew = checkAndAdd(hashes, niche, paragraphText)
if (!isNew) {
  // Rewrite the paragraph — it duplicates content from another site in this niche
}

await saveHashes('data/content-hashes.json', hashes)
```

Cross-niche reuse is allowed. Within-niche reuse is rejected.

## Workflow

1. **Load context:** Read `site.yaml`, the niche pack, niche brief, and `data/content-hashes.json`.
2. **Pick pages:** Identify which content files have no body prose (frontmatter only, no text after the closing `---`). Town pages with missing fact sheets are skipped.
3. **Write non-town pages first:** Home, services, cost guide, tool, FAQ, guides — these have no town-fact dependency.
4. **Write town pages:** Only for towns with ready fact sheets at `research/areas/<town>.md`.
5. **Create figures:** At least 3 per site. Cost guide and tool page each reference ≥1 figure in frontmatter `figures[]`.
6. **Dedup check:** Every paragraph passes through `checkAndAdd()`. Rewrite any paragraph flagged as duplicate.
7. **Validate:** Run `node scripts/write-content.mjs --validate <slug>` to confirm all checks pass.
8. **Save hashes:** Write updated `data/content-hashes.json`.

## Tools

```bash
# Validate one site after writing content
node scripts/write-content.mjs --validate <slug>

# Validate all sites
node scripts/write-content.mjs --validate --all

# Print hash counts and coverage summary
node scripts/write-content.mjs --summary
```

## Guardrails

- **Never write a town page without a ready fact sheet** — if `research/areas/<town>.md` does not exist or `checkTownReadiness()` fails, skip the town and report it as blocked.
- **Every body paragraph checked via `checkAndAdd()`** — reject reuse within the same niche. Rewrite the paragraph with different phrasing.
- **`detectBannedClaims()` on every page before saving** — any match means the page cannot be saved until the claim is removed.
- **`validateWordCount()` on every page** — body must fall within the `word_count_target` range from frontmatter.
- **`validateFigure()` on every figure JSON** — schema must pass before the file is written.
- **Figure numbers trace to sources** — every number in a figure must come from the niche brief, `niche-economics.md`, a town facts sheet, or a cited external source. A number in a chart with no source is a banned claim.
- **Re-express ranges per site** — no identical series arrays across same-niche sites. Use different rounding, labels, or category groupings.
- **No fake claims** — never invent years in business, licenses, crew sizes, reviews, awards, or health claims.
- **No LocalBusiness schema** — sites do not represent a single business.
- **Primary keyword in first 100 words** of every page body.
- **No duplicate H2s** within a page.
- **Cross-site similarity** — `detectNearDuplicateContent()` must stay below 0.60 (warn) / 0.75 (fail) for same-niche page pairs.
- **Never buy domains or phone numbers** — no purchases of any kind.
- **Key security** — never print, log, or commit API keys.
