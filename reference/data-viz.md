# Data Visualization Standard

Every site shows its numbers, not just states them. Charts turn the cost ranges, comparisons, and local facts the research already produced into something a homeowner can read in two seconds — real user value that brochure competitors don't have, and one more reason a page is cited rather than classified as scaled content.

This file is the spec for **data figures**: where they are required, where their numbers come from, how they are built, and how `rr-seo-audit` checks them. `template-architecture.md` holds the component mechanics; `niche-design-specs.md` holds the token palettes the figures draw from; `content-rules.md` and `ranking-playbook.md` reference this file — do not restate these rules inline.

## 1. Minimums per site

| Page | Figures required | Typical figure |
|---|---|---|
| Tool page | 1, inside the island (the result screen) | The estimate range drawn against the typical range for that job size |
| Cost guide (`/cost/`) | 1 | Cost range by sub-service or by tier (range bars) |
| Service pages | 0 required, 1 recommended | That sub-service's range by option (finish, scope, film type…) |
| Informational guides | 1 on any "vs." or "how long / how often" guide | Side-by-side ranges or lifespan bars |
| Town pages | 0 required; allowed only when the facts sheet has real numbers | Drive distance from hub, permit fee, population growth — never invented |
| Home, FAQ, About | 0 | — |

Floor: **every site ships at least 3 figures** (tool + cost guide + one more). A figure counts only if it carries a sourced data file and passes §5.

## 2. Data provenance

Numbers in a figure come from the same sources as the copy, and the audit traces them:

- Allowed sources: the niche brief (`niches/<niche>/brief.md`), `reference/niche-economics.md`, the town facts sheet (`research/areas/<town>.md`), the tool's own data table, or a cited external source (permit fee schedule, state statute, published cost survey).
- Every figure has a data file `sites/<slug>/figures/<figure-id>.json` with `{ title, unit, series[], source: { label, url?, brief_section? }, updated }`. `rr-content` writes these; the template renders from them; nothing is hand-typed into a component.
- Ranges stay ranges (low/high), matching the "costs vary by contractor" rule. Never a single-point price unless the source is a fixed fee (a permit fee, a legal VLT limit).
- No made-up variance: if two towns have the same cost in the brief, the figure shows that, or the figure is dropped. Fabricating a number in a chart is a banned claim.
- `<figcaption>` names the source in plain words ("Ranges from manufacturer pricing and the 2026 Remodeling Cost vs. Value report") and the page's frontmatter `sources[]` includes it.

## 3. Choosing the form

Pick the form from the data's job, then the color, in that order.

| Data's job | Form | Not this |
|---|---|---|
| A range per category (cost by finish, by scope, by vehicle) | Horizontal range bars (low→high) with the midpoint ticked | Column chart of averages; pie |
| Two or three options compared on one measure (epoxy vs polyaspartic lifespan) | Side-by-side bars, direct-labeled | Radar / spider |
| How a total breaks down (pool base + features) | Segmented horizontal bar, legend kept | Pie / donut |
| Change over time (re-seal interval, seasonality) | Line or step line, 2px, one axis | Area with gradient fill |
| One headline number (legal VLT limit, cubic yards) | Stat tile, not a chart | A chart with one bar |
| Anything needing two y-scales | Two small charts | Dual-axis chart — never |

Rules of thumb: horizontal bars when labels are words; one axis only; no pie or donut anywhere in the portfolio; at most 6 categories per figure (fold the rest into "Other"); no 3-D, no gradients on data marks, no rainbow.

## 4. Build rules

- **Static pages are zero-JS.** Figures on cost guides, service pages, guides, and town pages are rendered **at build time as inline SVG** by `template/src/components/sections/DataFigure/<variant>.astro` from the JSON data file. No charting library, no `<canvas>`, no client script. A chart is never shipped as a raster image.
- **Tool-page figures live inside the Preact island** and re-render on every input change. The same SVG primitives (`template/src/lib/figures.ts`) are shared so static and island charts look identical.
- **Color comes from the site's token set**, never from a chart palette: data marks use `--accent` (one hue; a sequential ramp of it where magnitude varies), range tracks use `--surface`/`--border`, text uses `--text`/`--muted`. Status colors (legal / not legal on the tint tool) are a reserved green/red pair with an icon and a label, never color alone. Because every figure is one accent hue plus neutrals, there is nothing to validate for color-vision deficiency; a figure that needs more than one hue needs a different form.
- **Marks:** thin bars (≤ 24px), 4px rounded data-ends, 2px lines, recessive grid (one hairline per tick), axis labels in `--muted`, selective direct labels (low and high on each range; not every point). Text is never set in the accent color.
- **Variants (seed-picked, same as other sections):** `range-bars`, `dot-range` (two dots joined by a line), `columns` (vertical, for ≤ 4 categories with short labels). The resolver persists the pick into `site.yaml` `design.variants.DataFigure`.
- **Size and performance:** `viewBox`-scaled SVG, `width="100%"`, explicit `height`; usable at 360px with no horizontal scroll; no fonts loaded for the chart (inherits body font); ≤ 6 KB per figure after minification.
- **Dark token sets** (Showroom, Night Drive, Walnut, Resort): the same marks on the dark surface, checked for ≥ 3:1 contrast of mark against background — not an automatic inversion.

## 5. Accessibility and fallback (every figure)

1. `<figure>` with a visible title (`<figcaption>` or heading) that names the measure and unit.
2. The SVG has `role="img"` and an `aria-label` stating the takeaway in one sentence ("Flake epoxy runs $5 to $8 per square foot, metallic $8 to $14").
3. A `<details>` block "See the numbers" directly below, holding a real `<table>` of the same data. This is the no-JS/no-SVG fallback, the screen-reader path, and what Google indexes.
4. Source line with link when the source has one.
5. Reduced-motion: no animation at all on static figures; island figures may transition bar lengths only when `prefers-reduced-motion` is not set.

## 6. Per-niche figure set

Each `pack.yaml` gets a `figures:` block listing these. `rr-content` fills the data files from the brief; the operator can add more.

| Niche | Tool-page figure (in island) | Cost-guide figure | Guide figure |
|---|---|---|---|
| epoxy-flooring | Your estimate vs. typical range for that garage size | $/sq ft range by finish (solid, flake, metallic, polyaspartic) | Lifespan bars: epoxy vs polyaspartic vs paint (years) |
| bathroom-remodel | Your estimate across the three finish tiers (scope fixed) | Total range by scope (refresh / mid / full) | Timeline bars by scope (weeks) |
| window-tinting | Legal tab: your VLT vs the state limit per window (stat tile + bar); cost tab: range by film | Range by vehicle type × film | Heat-rejection % bars: dyed vs carbon vs ceramic |
| junk-removal | Truck-fraction gauge (segmented bar, ⅛…full) with price range | Price range by load fraction | Junk removal vs dumpster rental cost bars (same volume) |
| kitchen-remodel | Your estimate across tiers | Total range by scope | Reface vs replace cabinets: cost and timeline |
| pressure-washing | Per-surface ranges stacked into your total (segmented bar) | $/sq ft range by surface | Recommended frequency by surface (months) |
| pool-builders | Base + feature adds (segmented bar) with total range | Base range by pool type | Build timeline by type (weeks) |
| paver-sealing | Your estimate vs typical for that area | $/sq ft range by condition and finish | Re-seal interval by climate / finish (years) |

Town-page figures are opt-in per town: a "drive time from {hub}" bar across the site's towns is allowed when every town's facts sheet has the distance; a permit-fee comparison is allowed when the fee schedules are cited.

## 7. Audit checks (`rr-seo-audit`)

| Check | Scope | Fail condition |
|---|---|---|
| Figure minimum | site | fewer than 3 figures, or tool page or cost guide without one |
| Figure provenance | figure | data file missing `source`, or a value not traceable to brief / economics / facts sheet / cited URL |
| Figure fallback | figure | missing `<details>` table, `aria-label`, or caption |
| Figure form | figure | pie/donut, dual axis, > 6 categories, raster chart image, or client JS on a non-tool page |
| Figure palette | site | a data-mark fill outside the site's token values |
| Figure contrast | figure | mark vs background < 3:1 on the site's surface |
| Figure numbers match copy | page | a range in the figure that contradicts the same range in the page body |
| Figure duplication | niche | identical `series` data across two sites in the niche (ranges must be re-expressed per site, same as copy) |

`_audit.json` gains `figures[]` per page: `{ id, variant, form, categories, has_table, has_source, fills[] }`.
