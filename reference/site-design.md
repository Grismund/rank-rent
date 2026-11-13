# Site Design Principles

Brand-first design standards for rank-and-rent sites. These complement `seo-standards.md` (heading/keyword rules), `content-rules.md` (word counts/fact minimums), and `ranking-playbook.md` (portfolio footprint, tools, growth).

## Brand Identity

Sites must look like a **professional local service brand**, not a lead capture page.

- **A real, distinct brand name per site** before any content is written. `brand: TBD` blocks `rr-content`. No shared naming pattern across sites (no "X Pros / Y Pros" series).
- Simple text/SVG logo generated from the brand name at build; replaced with a real logo when available
- Design tokens per niche (palette, type pairing, radius, imagery style) in `niches/<niche>/pack.yaml`; per-site overrides in `site.yaml`
- Licensed or generated image set per sub-service shipped with the pack (`template/public/img/<niche>/`); operator photos replace them when available and **do not block launch**
- Consistent typography and spacing throughout
- No generic stock watermarks, Lorem ipsum, or placeholder text in published pages

## Page Inventory

Each site launches with **10-15 pages**:

| Page type | Count | Source |
|-----------|-------|--------|
| Home | 1 | pack.yaml `home` outline |
| Service pages | 3-5 | pack.yaml `sub_services` (one per sub-service) |
| Town/area pages | 3-5 | site.yaml `towns` list (cut towns whose facts sheet can't support `ranking-playbook.md` §2) |
| Cost guide | 1 | pack.yaml `guide_topics` (type: cost_guide) |
| Informational guides | 2+ | pack.yaml `guide_topics` (type: guide) — cost/"how long"/"is it worth it"/comparison topics |
| Tool page | 1 | pack.yaml `tool` — Astro island, own target keyword, `WebApplication` schema |
| FAQ | 1 | pack.yaml `guide_topics` (type: faq) + FAQPage schema |
| About / How It Works | 1 | Static outline in pack.yaml; names Vantabox LLC as operator |
| Contact, Privacy, Thank-you, 404 | 4 | Template (privacy/thank-you `noindex`) |

The template reserves `/guides/` for pages added post-launch by `rr-weekly-review`.

## Template Structure

- **Framework:** Astro — shared template in `template/`
- **Shells and variants:** four layout shells (A–D), section-component variants, section-order sets, copy banks, heading variants, class-name map — specified in `template-architecture.md`, assigned per site in `sites/ASSIGNMENTS.md`. Two sites in the same niche may not share both shell and token set.
- **Per-site config:** `sites/<domain>/site.yaml` — niche, brand, `design` block (shell, tokens, orders, variants, classmap), `copy` block, `tool`, `images`, towns, phone number, page plan
- **Niche pack:** `niches/<niche>/pack.yaml` — page outlines, sub-services, guide topics, tool definition, design tokens, image set, local variables
- Pack outlines define structure, not sentences; `rr-content` never reuses a paragraph across sites
- No third-party scripts other than call tracking

## Content Review

- All AI-generated content is marked **draft** until operator reviews
- No page publishes without explicit operator approval
- Draft status tracked in site.yaml per page
- Operator may edit, rewrite, or reject any page

## Visual Requirements

- **Mobile-first** responsive layout
- **Click-to-call** button prominent on every page (header + CTA block after every major section + sticky mobile call bar)
- Visible breadcrumbs on every non-home page
- Hero image is the only above-the-fold image and is preloaded; all others lazy-load
- One generated OG image per page (brand + H1, 1200×630)
- No stock photo watermarks in any published page
- No Lorem ipsum or placeholder text in any published page
- **Lighthouse score 80+** on mobile across Performance, Accessibility, Best Practices, SEO — run in `rr-seo-audit`
- Clean footer with service area list, phone number, simple nav, and the disclosure line "We connect homeowners with independent local contractors."
- Contact form: name, phone, town, short description only; submits via Resend
