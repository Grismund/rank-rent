# Site Design Principles

Brand-first design standards for rank-and-rent sites. These complement `seo-standards.md` (heading/keyword rules) and `content-rules.md` (word counts/fact minimums).

## Brand Identity

Sites must look like a **professional local service brand**, not a lead capture page.

- Logo placeholder in header — replaced with real logo when available
- Professional color scheme per niche (defined in `niches/<niche>/pack.yaml` or site.yaml)
- Photo placeholders for real project photos — operator supplies before launch
- Consistent typography and spacing throughout
- No generic stock watermarks, Lorem ipsum, or placeholder text in published pages

## Page Inventory

Each site launches with **10-15 pages**:

| Page type | Count | Source |
|-----------|-------|--------|
| Home | 1 | pack.yaml `home` outline |
| Service pages | 3-5 | pack.yaml `sub_services` (one per sub-service) |
| Town/area pages | 3-5 | site.yaml `towns` list |
| Cost guides | 1-2 | pack.yaml `guide_topics` (type: cost_guide) |
| FAQ | 1 | pack.yaml `guide_topics` (type: faq) + FAQPage schema |
| About / How It Works | 1 | Static outline in pack.yaml |

## Template Structure

- **Framework:** Astro — shared template in `template/`
- **Per-site config:** `sites/<domain>/site.yaml` — niche, towns, phone number, page plan
- **Niche pack:** `niches/<niche>/pack.yaml` — page outlines, sub-services, local variables
- All sites share the same base template; niche-specific styling comes from pack config

## Content Review

- All AI-generated content is marked **draft** until operator reviews
- No page publishes without explicit operator approval
- Draft status tracked in site.yaml per page
- Operator may edit, rewrite, or reject any page

## Visual Requirements

- **Mobile-first** responsive layout
- **Click-to-call** button prominent on every page (header + CTA sections)
- No stock photo watermarks in any published page
- No Lorem ipsum or placeholder text in any published page
- **Lighthouse score 80+** across Performance, Accessibility, Best Practices, SEO
- Clean footer with service area list, phone number, and simple nav
