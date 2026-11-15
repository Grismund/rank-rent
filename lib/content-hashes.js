/**
 * Paragraph-level deduplication for cross-site content.
 * Tracks hashed paragraphs per niche to prevent reuse across same-niche sites.
 */

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

/**
 * Normalize text then return its MD5 hex digest.
 * Normalization: lowercase, collapse whitespace, strip non-alphanumeric except spaces, trim.
 */
export function hashParagraph(text) {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('md5').update(normalized).digest('hex')
}

/**
 * Check whether a paragraph already exists within a niche.
 * Returns true if new (and adds the hash), false if duplicate.
 */
export function checkAndAdd(hashes, niche, paragraph) {
  const hash = hashParagraph(paragraph)
  if (!hashes[niche]) {
    hashes[niche] = []
  }
  if (hashes[niche].includes(hash)) {
    return false
  }
  hashes[niche].push(hash)
  return true
}

/**
 * Load paragraph hashes from a JSON file.
 * Returns {} if the file does not exist.
 */
export async function loadHashes(filePath) {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

/**
 * Save paragraph hashes to a JSON file with 2-space indent.
 */
export async function saveHashes(filePath, hashes) {
  await writeFile(filePath, JSON.stringify(hashes, null, 2) + '\n')
}

/**
 * Build a summary of paragraph counts per niche.
 * Returns { niche: count }.
 */
export function buildHashSummary(hashes) {
  const summary = {}
  for (const [niche, arr] of Object.entries(hashes)) {
    summary[niche] = arr.length
  }
  return summary
}
