import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { load as loadYaml } from 'js-yaml'

export interface ContentFrontmatter {
  title?: string
  description?: string
  updated?: string
  robots?: string
  [key: string]: unknown
}

export interface ContentSection {
  heading: string
  body: string
}

export interface PageContent {
  frontmatter: ContentFrontmatter
  intro: string
  sections: ContentSection[]
  raw: string
}

/**
 * Convert a page slug (e.g. /areas/winter-park/) to a markdown filename stem.
 * / → index, /foo/ → foo, /areas/bar/ → areas--bar
 */
export function pageSlugToFilename(pageSlug: string): string {
  const trimmed = pageSlug.replace(/^\/|\/$/g, '')
  if (trimmed === '') return 'index'
  return trimmed.replace(/\//g, '--')
}

/**
 * Split markdown body by ## headings.
 * Text before the first ## is intro; ### and deeper are not split.
 */
export function splitByHeadings(markdown: string): { intro: string; sections: ContentSection[] } {
  const lines = markdown.split('\n')
  let intro = ''
  const sections: ContentSection[] = []
  let currentHeading: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const match = line.match(/^## (.+)$/)
    if (match) {
      if (currentHeading !== null) {
        sections.push({ heading: currentHeading, body: currentLines.join('\n').trim() })
      } else {
        intro = currentLines.join('\n').trim()
      }
      currentHeading = match[1].trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  // Flush last section or remaining intro
  if (currentHeading !== null) {
    sections.push({ heading: currentHeading, body: currentLines.join('\n').trim() })
  } else {
    intro = currentLines.join('\n').trim()
  }

  return { intro, sections }
}

/**
 * Load and parse a page's markdown content file.
 * Returns null if the file does not exist.
 *
 * File path: rootDir/siteSlug/pageFilename.md
 * When siteSlug is empty, resolves to rootDir/pageFilename.md
 */
export function loadPageContent(
  siteSlug: string,
  pageFilename: string,
  rootDir: string
): PageContent | null {
  const dir = siteSlug ? resolve(rootDir, siteSlug) : rootDir
  const filePath = resolve(dir, `${pageFilename}.md`)

  if (!existsSync(filePath)) return null

  const raw = readFileSync(filePath, 'utf-8')

  // Parse frontmatter
  let frontmatter: ContentFrontmatter = {}
  let body = raw

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (fmMatch) {
    frontmatter = (loadYaml(fmMatch[1]) as ContentFrontmatter) ?? {}
    body = fmMatch[2]
  }

  const { intro, sections } = splitByHeadings(body.trim())

  return { frontmatter, intro, sections, raw }
}

/**
 * Match content sections to section-order keys.
 * A section matches a key if the heading contains the key as a word.
 * E.g. heading "Services We Offer" matches key "services".
 */
export function matchSectionContent(
  order: string[],
  sections: ContentSection[]
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const key of order) {
    const keyLower = key.toLowerCase()
    const match = sections.find((s) => {
      const headingLower = s.heading.toLowerCase()
      // Check if key appears as a word boundary match in the heading
      const regex = new RegExp(`\\b${keyLower}\\b`)
      return regex.test(headingLower)
    })
    if (match) {
      result[key] = match.body
    }
  }

  return result
}
