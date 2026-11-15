import { describe, it, expect, vi } from 'vitest'
import {
  hashParagraph,
  checkAndAdd,
  loadHashes,
  saveHashes,
  buildHashSummary,
} from '../lib/content-hashes.js'

// --- hashParagraph ---

describe('hashParagraph', () => {
  it('returns consistent hex for same text', () => {
    const a = hashParagraph('This is a test paragraph.')
    const b = hashParagraph('This is a test paragraph.')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns different hash for different text', () => {
    const a = hashParagraph('First paragraph about epoxy flooring.')
    const b = hashParagraph('Second paragraph about bathroom remodeling.')
    expect(a).not.toBe(b)
  })

  it('normalizes whitespace before hashing', () => {
    const a = hashParagraph('hello   world')
    const b = hashParagraph('hello world')
    expect(a).toBe(b)
  })

  it('normalizes casing before hashing', () => {
    const a = hashParagraph('Hello World')
    const b = hashParagraph('hello world')
    expect(a).toBe(b)
  })

  it('strips non-alphanumeric except spaces before hashing', () => {
    const a = hashParagraph('Hello, world! This is great.')
    const b = hashParagraph('Hello world This is great')
    expect(a).toBe(b)
  })

  it('trims leading and trailing whitespace', () => {
    const a = hashParagraph('  hello world  ')
    const b = hashParagraph('hello world')
    expect(a).toBe(b)
  })
})

// --- checkAndAdd ---

describe('checkAndAdd', () => {
  it('returns true for unseen paragraph and adds hash', () => {
    const hashes = {}
    const result = checkAndAdd(hashes, 'epoxy-flooring', 'A unique paragraph about garage floors.')
    expect(result).toBe(true)
    expect(hashes['epoxy-flooring']).toHaveLength(1)
  })

  it('returns false for previously seen paragraph in same niche', () => {
    const hashes = {}
    checkAndAdd(hashes, 'epoxy-flooring', 'Duplicate paragraph text.')
    const result = checkAndAdd(hashes, 'epoxy-flooring', 'Duplicate paragraph text.')
    expect(result).toBe(false)
  })

  it('allows same text across different niches', () => {
    const hashes = {}
    checkAndAdd(hashes, 'epoxy-flooring', 'Shared paragraph text.')
    const result = checkAndAdd(hashes, 'bathroom-remodel', 'Shared paragraph text.')
    expect(result).toBe(true)
  })

  it('initializes niche key on first use', () => {
    const hashes = {}
    expect(hashes['new-niche']).toBeUndefined()
    checkAndAdd(hashes, 'new-niche', 'First paragraph.')
    expect(Array.isArray(hashes['new-niche'])).toBe(true)
  })
})

// --- loadHashes ---

describe('loadHashes', () => {
  it('returns {} when file does not exist', async () => {
    const result = await loadHashes('/tmp/nonexistent-hashes-test.json')
    expect(result).toEqual({})
  })

  it('returns parsed JSON when file exists', async () => {
    const fs = await import('node:fs/promises')
    const path = '/tmp/test-hashes-load.json'
    const data = { 'epoxy-flooring': ['abc123', 'def456'] }
    await fs.writeFile(path, JSON.stringify(data))
    const result = await loadHashes(path)
    expect(result).toEqual(data)
    await fs.unlink(path)
  })
})

// --- saveHashes ---

describe('saveHashes', () => {
  it('writes valid JSON with 2-space indent', async () => {
    const fs = await import('node:fs/promises')
    const path = '/tmp/test-hashes-save.json'
    const data = { 'epoxy-flooring': ['abc123'] }
    await saveHashes(path, data)
    const raw = await fs.readFile(path, 'utf-8')
    expect(JSON.parse(raw)).toEqual(data)
    expect(raw).toBe(JSON.stringify(data, null, 2) + '\n')
    await fs.unlink(path)
  })
})

// --- buildHashSummary ---

describe('buildHashSummary', () => {
  it('counts paragraphs per niche', () => {
    const hashes = {
      'epoxy-flooring': ['a', 'b', 'c'],
      'bathroom-remodel': ['d', 'e'],
    }
    const summary = buildHashSummary(hashes)
    expect(summary).toEqual({
      'epoxy-flooring': 3,
      'bathroom-remodel': 2,
    })
  })

  it('returns empty object for empty hashes', () => {
    expect(buildHashSummary({})).toEqual({})
  })
})
