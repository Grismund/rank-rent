/**
 * Report loader — reads markdown report files and converts to HTML.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { markdownToHtml } from './markdown-html.js'

export function loadTeardownHtml(slug, researchDir) {
  const path = join(researchDir, slug, 'teardown.md')
  if (!existsSync(path)) return null
  return markdownToHtml(readFileSync(path, 'utf8'))
}

export function loadViabilityHtml(slug, researchDir) {
  const path = join(researchDir, slug, 'viability.md')
  if (!existsSync(path)) return null
  return markdownToHtml(readFileSync(path, 'utf8'))
}

export function loadShortlistHtml(filename, researchDir) {
  const path = join(researchDir, filename)
  return markdownToHtml(readFileSync(path, 'utf8'))
}

export function buildReportMaps(slugs, researchDir) {
  const teardownHtmlMap = {}
  const viabilityHtmlMap = {}

  for (const slug of slugs) {
    const td = loadTeardownHtml(slug, researchDir)
    if (td) teardownHtmlMap[slug] = td

    const vb = loadViabilityHtml(slug, researchDir)
    if (vb) viabilityHtmlMap[slug] = vb
  }

  return { teardownHtmlMap, viabilityHtmlMap }
}

export function buildShortlistMap(filenames, researchDir) {
  const map = {}
  for (const f of filenames) {
    map[f] = loadShortlistHtml(f, researchDir)
  }
  return map
}
