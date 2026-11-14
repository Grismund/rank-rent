import { describe, it, expect } from 'vitest'
import { generateOgImage } from '../src/lib/og-image'

describe('generateOgImage', () => {
  it('returns a Uint8Array (PNG)', async () => {
    const result = await generateOgImage({
      brand: 'Orlando Epoxy Works',
      h1: 'Professional Epoxy Flooring in Orlando',
      accent: '#1F6FEB',
    })
    expect(result).toBeInstanceOf(Uint8Array)
    // PNG magic bytes: 137 80 78 71
    expect(result[0]).toBe(137)
    expect(result[1]).toBe(80) // 'P'
    expect(result[2]).toBe(78) // 'N'
    expect(result[3]).toBe(71) // 'G'
  })

  it('output is 1200×630 dimensions', async () => {
    const result = await generateOgImage({
      brand: 'Test Brand',
      h1: 'Test Heading',
      accent: '#F2B134',
    })
    // PNG IHDR chunk starts at byte 16, width at 16-19, height at 20-23 (big-endian)
    const view = new DataView(result.buffer, result.byteOffset, result.byteLength)
    const width = view.getUint32(16)
    const height = view.getUint32(20)
    expect(width).toBe(1200)
    expect(height).toBe(630)
  })

  it('accepts brand name and H1 text as input', async () => {
    // Should not throw with valid inputs
    const result = await generateOgImage({
      brand: 'My Brand',
      h1: 'Some Heading Text',
      accent: '#0077B6',
    })
    expect(result.length).toBeGreaterThan(0)
  })
})
