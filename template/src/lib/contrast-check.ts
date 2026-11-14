import { readFileSync, readdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'

/** Parse a hex color (#RRGGBB) into [r, g, b] in 0-255 range. */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Convert an sRGB channel (0-255) to linear. */
function srgbToLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** Compute relative luminance per WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  )
}

/** Compute contrast ratio between two hex colors. */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export interface ContrastResult {
  ratio: number
  passes: boolean
}

/**
 * Check contrast between fg and bg at a given level.
 * - 'AA': requires 4.5:1
 * - 'AA-large': requires 3:1
 */
export function checkContrast(
  fg: string,
  bg: string,
  level: 'AA' | 'AA-large'
): ContrastResult {
  const ratio = contrastRatio(fg, bg)
  const threshold = level === 'AA' ? 4.5 : 3
  return { ratio, passes: ratio >= threshold }
}

/** Extract CSS custom property hex values from a token CSS string. */
export function parseTokenCSS(
  css: string
): Record<string, string> {
  const tokens: Record<string, string> = {}
  const re = /--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g
  let match: RegExpExecArray | null
  while ((match = re.exec(css)) !== null) {
    tokens[match[1]] = match[2]
  }
  return tokens
}

export interface PairCheck {
  pair: string
  ratio: number
  required: number
  pass: boolean
}

export interface FileResult {
  file: string
  pass: boolean
  checks: PairCheck[]
}

/**
 * Check all token CSS files in a directory for WCAG AA contrast.
 * Required pairs:
 *  - text / bg — 4.5:1
 *  - muted / bg — 3:1
 *  - accent-text / accent — 4.5:1
 */
export async function checkAllTokenFiles(dir: string): Promise<FileResult[]> {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.css') && f !== 'base.css')
    .sort()

  return files.map((file) => {
    const css = readFileSync(resolve(dir, file), 'utf-8')
    const tokens = parseTokenCSS(css)
    const checks: PairCheck[] = []

    if (tokens.text && tokens.bg) {
      const r = contrastRatio(tokens.text, tokens.bg)
      checks.push({ pair: 'text/bg', ratio: r, required: 4.5, pass: r >= 4.5 })
    }

    if (tokens.muted && tokens.bg) {
      const r = contrastRatio(tokens.muted, tokens.bg)
      checks.push({
        pair: 'muted/bg',
        ratio: r,
        required: 3,
        pass: r >= 3,
      })
    }

    if (tokens['accent-text'] && tokens.accent) {
      const r = contrastRatio(tokens['accent-text'], tokens.accent)
      checks.push({
        pair: 'accent-text/accent',
        ratio: r,
        required: 4.5,
        pass: r >= 4.5,
      })
    }

    return {
      file,
      pass: checks.every((c) => c.pass),
      checks,
    }
  })
}
