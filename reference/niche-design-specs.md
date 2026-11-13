# Niche Design Specs

Per-niche inputs to `template-architecture.md`: two token sets, an imagery brief and image set, the interactive tool, and the informational guide topics every site in the niche must ship with. `rr-site-build` copies the `tool:` and `guide_topics` entries into `pack.yaml`; token CSS lives in `template/src/tokens/`.

Palette values are starting points; adjust for WCAG AA contrast (≥ 4.5:1 body, ≥ 3:1 large text) and record the final values in the token file. Accent is used for the phone button and primary CTA only.

Image sets: 8–12 licensed or generated images per niche covering each sub-service plus two hero candidates. Filenames are descriptive (`<subject>-<detail>.avif`); town-specific variants are not required. Store at `template/public/img/<niche>/`. No people's faces, no visible brand logos, no text in images.

Tools are Preact islands in `template/src/components/tools/<type>.tsx`. Every tool: inputs → a **range** output → "Costs vary by contractor and site conditions" note → phone CTA + form link. Ranges come from the niche brief (`niches/<niche>/brief.md`) and `niche-economics.md`; record the source table in the component's header comment.

---

## epoxy-flooring (5 sites)

**Token set 1 — "Showroom":** bg `#0F1115`, surface `#181B22`, text `#F2F3F5`, muted `#A7ADB8`, accent `#F2B134`, accent-text `#141414`, border `#2A2F3A`. Dark, glossy; radius 6px; dense spacing; sharp shadows; image treatment: none.
**Token set 2 — "Clean Garage":** bg `#FFFFFF`, surface `#F4F6F8`, text `#1B2430`, muted `#5B6573`, accent `#1F6FEB`, accent-text `#FFFFFF`, border `#DCE1E7`. Light, technical; radius 12px; airy spacing; soft shadows; image treatment: rounded.

**Imagery:** finished floors — flake, metallic, solid color; two-car garage wide shots; close-up of flake texture; prep (grinding) in progress; commercial/warehouse floor; patio/pool-deck coating. Hero candidates: wide two-car garage with flake floor; metallic epoxy close-up.

**Tool — `epoxy-cost-estimator`** (`/garage-floor-cost-calculator/`): inputs — garage size (1/2/3-car or custom sq ft), finish (solid / flake / metallic / polyaspartic), existing floor condition (new / minor cracks / oil stains or old coating). Output: sq ft, price-per-sq-ft range, total range, estimated days. Data: brief cost ranges by finish; condition multiplier for prep.

**Guide topics (ship ≥ 2):**
- "Epoxy vs. polyaspartic garage floors" — `epoxy vs polyaspartic {city}`
- "How long does an epoxy floor last?" — `how long does epoxy garage floor last`
- "Can you epoxy over a cracked garage floor?" — `epoxy over cracked concrete`
- "Best time of year to coat a garage floor in {state}" — `epoxy floor humidity {state}`

---

## bathroom-remodel (4 sites)

**Token set 1 — "Spa":** bg `#FBFAF7`, surface `#F1EEE7`, text `#2A2A2A`, muted `#6B6B6B`, accent `#2F7A6D`, accent-text `#FFFFFF`, border `#E2DDD2`. Warm neutral; radius 16px; airy; soft shadows; image treatment: framed.
**Token set 2 — "Tile":** bg `#FFFFFF`, surface `#EEF3F6`, text `#1E2A33`, muted `#5A6B78`, accent `#C26A3D`, accent-text `#FFFFFF`, border `#D5DEE5`. Cool base, terracotta accent; radius 4px; medium spacing; no shadows, 1px borders; image treatment: duotone on secondary images only.

**Imagery:** walk-in shower with frameless glass; tub-to-shower conversion before/after pairs (two separate images, not composites); double vanity; tile work close-up; small-bathroom layout; accessible/curbless shower. Hero candidates: finished walk-in shower; vanity and mirror wide shot.

**Tool — `bath-budget-estimator`** (`/bathroom-remodel-cost-calculator/`): inputs — bathroom type (half / full / primary), scope (refresh: fixtures + paint; mid: tile + vanity + fixtures; full: layout change + plumbing), finish tier (standard / upgraded / premium). Output: total range, typical timeline, "permit likely required" flag when scope is full. Data: brief ranges; scope × tier matrix.

**Guide topics (ship ≥ 2):**
- "Tub-to-shower conversion: cost, timeline, resale" — `tub to shower conversion cost {city}`
- "How long does a bathroom remodel take?" — `how long does a bathroom remodel take`
- "Do you need a permit to remodel a bathroom in {city}?" — `bathroom remodel permit {city}`
- "Walk-in shower vs. tub: which is right for your home" — `walk in shower vs tub`

---

## window-tinting (3 sites — TX, AZ, FL)

**Token set 1 — "Night Drive":** bg `#101418`, surface `#1A2027`, text `#EEF1F4`, muted `#9AA4AE`, accent `#38BDF8`, accent-text `#0B1015`, border `#2A333D`. Dark, cool; radius 8px; dense; sharp shadows; image treatment: none.
**Token set 2 — "Daylight":** bg `#FFFFFF`, surface `#F6F7F9`, text `#15202B`, muted `#5F6B77`, accent `#E85D04`, accent-text `#FFFFFF`, border `#E1E5EA`. Light with hot accent; radius 999px on buttons, 10px on cards; medium spacing; soft shadows; image treatment: rounded.

**Imagery:** sedan and truck with tint (side and rear views); film application in progress; ceramic film roll; residential window with film vs. without (two images); storefront glass; paint protection film on a hood. Hero candidates: SUV rear three-quarter with tint; installer squeegeeing film.

**Tool — `tint-law-and-cost`** (`/window-tint-calculator/`): two tabs. **Legal check:** state (fixed per site), window (front side / rear side / rear / windshield strip), desired VLT → legal / not legal / medical exemption note, with citation to the state statute. **Cost estimate:** vehicle type (coupe / sedan / SUV / truck), film (dyed / carbon / ceramic), old tint removal yes/no → total range. Data: state VLT limits from the local-facts sheet (`tint_laws`); brief ranges. Residential/commercial estimate: window count × film type.

**Guide topics (ship ≥ 2):**
- "{State} window tint laws explained" — `{state} window tint laws`
- "Ceramic vs. carbon vs. dyed tint" — `ceramic vs carbon tint`
- "Does window tint really lower your energy bill?" — `residential window tint energy savings`
- "How long after tinting before you can roll windows down" — `how long after tint roll down windows`

---

## junk-removal (2 sites)

**Token set 1 — "Hi-Vis":** bg `#FFFFFF`, surface `#F3F4F2`, text `#1C1F1A`, muted `#5C6158`, accent `#2E7D32`, accent-text `#FFFFFF`, border `#D9DCD5`. Light, green accent; radius 8px; medium; soft shadows; image treatment: rounded.
**Token set 2 — "Work Truck":** bg `#FAF7F2`, surface `#F0EAE0`, text `#2B2520`, muted `#6F655C`, accent `#D64D1F`, accent-text `#FFFFFF`, border `#E3DACB`. Warm, orange accent; radius 2px; dense; hard 2px borders instead of shadows; image treatment: none.

**Imagery:** loaded box truck (no logos); garage cleanout before and after (separate images); couch on a curb; appliance on a dolly; construction debris pile; donation center drop-off. Hero candidates: crew-less loaded truck bed; cleared garage.

**Tool — `load-size-estimator`** (`/junk-removal-cost-estimator/`): inputs — item picker with quantities (couch, mattress, refrigerator, washer/dryer, bags of debris, boxes, furniture misc., yard waste cu yd), stairs/long carry yes/no. Output: estimated cubic yards, fraction of a standard 15–16 yd truck (⅛ … full), price range, plus "items that usually cost extra" (mattresses, refrigerants, tires) from the brief. Data: per-item volume table; brief pricing by load fraction.

**Guide topics (ship ≥ 2):**
- "Junk removal vs. renting a dumpster in {city}" — `junk removal vs dumpster rental {city}`
- "What junk removal companies won't take (and where it goes instead)" — `what junk removal won't take`
- "How to prepare for a junk pickup" — `prepare for junk removal pickup`
- "Bulk trash pickup rules in {city}" — `{city} bulk trash pickup`

---

## kitchen-remodel (1 site)

**Token set 1 — "Marble":** bg `#FFFFFF`, surface `#F7F5F2`, text `#222222`, muted `#666666`, accent `#1F4E5F`, accent-text `#FFFFFF`, border `#E6E1DA`. Light, deep teal accent; radius 10px; airy; soft shadows; image treatment: framed.
**Token set 2 — "Walnut":** bg `#1E1B18`, surface `#2A2521`, text `#F3EEE7`, muted `#B5AA9D`, accent `#D9A441`, accent-text `#1E1B18`, border `#3A332D`. Dark, warm; radius 6px; medium; sharp shadows; image treatment: none.

**Imagery:** island with seating; cabinet refacing close-up; countertop install; open-plan kitchen wide shot; backsplash tile; under-cabinet lighting; galley kitchen. Hero candidates: wide island shot; cabinet-and-counter detail.

**Tool — `kitchen-budget-estimator`** (`/kitchen-remodel-cost-calculator/`): inputs — kitchen size (small < 100 sq ft / medium / large > 200), scope (cosmetic: paint + hardware + counters; mid: cabinets refaced + counters + backsplash + appliances; full: new cabinets + layout + electrical/plumbing), finish tier. Output: total range, timeline, permit flag. Data: brief ranges; scope × tier matrix.

**Guide topics (ship ≥ 2):**
- "Cabinet refacing vs. replacement" — `cabinet refacing vs replacing`
- "How long does a kitchen remodel take?" — `how long does a kitchen remodel take`
- "Kitchen remodel permits in {city}" — `kitchen remodel permit {city}`
- "Quartz vs. granite countertops" — `quartz vs granite countertops cost`

---

## pressure-washing (1 site)

**Token set 1 — "Fresh":** bg `#FFFFFF`, surface `#EEF6FB`, text `#14232E`, muted `#55687A`, accent `#0E7C86`, accent-text `#FFFFFF`, border `#D7E5EE`. Light, aqua accent; radius 12px; airy; soft shadows; image treatment: rounded.
**Token set 2 — "Concrete":** bg `#F5F5F4`, surface `#E8E8E6`, text `#1F1F1F`, muted `#5E5E5C`, accent `#B91C1C`, accent-text `#FFFFFF`, border `#D4D4D2`. Neutral grey, red accent; radius 0; dense; 1px borders; image treatment: duotone on secondary images.

**Imagery:** driveway half-cleaned (single image, genuine half-and-half); house siding soft-wash; deck before and after (separate); roof soft-wash; commercial sidewalk; fence. Hero candidates: half-cleaned driveway; clean two-story facade.

**Tool — `surface-cost-estimator`** (`/pressure-washing-cost-calculator/`): inputs — surfaces with sizes (driveway sq ft or car count, house siding stories + approx. sq ft, deck/patio sq ft, roof yes/no + type, fence linear ft), soft-wash vs. pressure (auto-selected by surface with explanation). Output: per-surface range and total, recommended frequency. Data: brief per-sq-ft ranges by surface.

**Guide topics (ship ≥ 2):**
- "Soft washing vs. pressure washing" — `soft wash vs pressure wash`
- "How often should you pressure wash your house in {state}?" — `how often pressure wash house {state}`
- "Can pressure washing damage siding or pavers?" — `pressure washing damage siding`
- "Pressure washing water restrictions in {city}" — `{city} water restrictions pressure washing`

---

## pool-builders (1 site)

**Token set 1 — "Lagoon":** bg `#FFFFFF`, surface `#F0F7F9`, text `#102A33`, muted `#4F6B75`, accent `#0077B6`, accent-text `#FFFFFF`, border `#D3E4EA`. Light, water blue; radius 20px; airy; soft shadows; image treatment: rounded.
**Token set 2 — "Resort":** bg `#101D24`, surface `#17272F`, text `#EAF2F5`, muted `#9FB3BC`, accent `#F4A261`, accent-text `#101D24`, border `#243640`. Dark, sunset accent; radius 8px; medium; sharp shadows; image treatment: none.

**Imagery:** gunite pool with spa; fiberglass shell being set; plain rectangular lap pool; screened enclosure (Florida); paver deck and coping; pool at dusk with lighting; small backyard plunge pool. Hero candidates: finished pool with deck; dusk shot.

**Tool — `pool-cost-estimator`** (`/pool-cost-calculator/`): inputs — pool type (gunite / fiberglass / vinyl), size (small ≤ 300 sq ft / medium / large ≥ 600), features (spa, screen enclosure, heater, saltwater, lighting, deck sq ft). Output: base range + per-feature adds + total, typical build timeline, permit note. Data: brief ranges; feature add table.

**Guide topics (ship ≥ 2):**
- "Gunite vs. fiberglass vs. vinyl pools in {state}" — `gunite vs fiberglass pool {state}`
- "How long does it take to build a pool?" — `how long to build a pool`
- "Pool permits and setbacks in {city}" — `pool permit {city}`
- "Do you need a screen enclosure in {city}?" — `pool screen enclosure cost {city}`

---

## paver-sealing (1 site)

**Token set 1 — "Sandstone":** bg `#FDFBF7`, surface `#F3EDE2`, text `#2E2924`, muted `#746A5E`, accent `#8B5E34`, accent-text `#FFFFFF`, border `#E6DCCB`. Warm stone; radius 6px; medium; soft shadows; image treatment: framed.
**Token set 2 — "Wet Look":** bg `#FFFFFF`, surface `#F2F4F7`, text `#1A2027`, muted `#5B6672`, accent `#0F766E`, accent-text `#FFFFFF`, border `#DBE0E6`. Cool neutral, teal accent; radius 12px; airy; soft shadows; image treatment: rounded.

**Imagery:** sealed vs. unsealed pavers side by side (one image, genuine); driveway pavers; pool deck pavers; joint sand re-sanding; efflorescence close-up; wet-look vs. matte finish. Hero candidates: half-sealed driveway; pool deck in sun.

**Tool — `paver-sealing-estimator`** (`/paver-sealing-cost-calculator/`): inputs — area (sq ft or driveway/patio/pool deck presets), condition (clean / stained or efflorescence / failed old sealer needing stripping), finish (natural / wet look / high gloss), re-sand yes/no. Output: total range, recommended re-seal interval for {state} climate. Data: brief per-sq-ft ranges; condition multipliers.

**Guide topics (ship ≥ 2):**
- "How often should pavers be sealed in {state}?" — `how often seal pavers {state}`
- "Wet-look vs. natural paver sealer" — `wet look vs natural paver sealer`
- "Why are my pavers turning white? (efflorescence)" — `white haze on pavers`
- "Can you seal pavers yourself?" — `diy paver sealing vs professional`

---

## Cross-niche rules

- A site's two heroes and all section images come from its niche set; no image file is shared across niches.
- Within a niche, sites on different token sets should prefer different hero candidates.
- Tool pages are the only pages allowed to load JS beyond the sticky bar; FAQ accordions use native `<details>`.
- Every tool's output screen includes the exact phone number and the `cta.primary` string from `site.yaml`.
