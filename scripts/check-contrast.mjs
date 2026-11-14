#!/usr/bin/env node

import { resolve } from 'path'

const rootDir = resolve(import.meta.dirname, '..')
const tokensDir = resolve(rootDir, 'template', 'src', 'tokens')

// Dynamic import of the TS module via vitest's runner won't work here,
// so we re-implement the check in plain JS for the script.
import { readFileSync, readdirSync } from 'fs'

function srgbToLinear(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(hex) {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  )
}

function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function parseTokenCSS(css) {
  const tokens = {}
  const re = /--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g
  let m
  while ((m = re.exec(css)) !== null) tokens[m[1]] = m[2]
  return tokens
}

const files = readdirSync(tokensDir)
  .filter((f) => f.endsWith('.css') && f !== 'base.css')
  .sort()

let allPass = true

for (const file of files) {
  const css = readFileSync(resolve(tokensDir, file), 'utf-8')
  const t = parseTokenCSS(css)
  const checks = []

  if (t.text && t.bg) {
    const r = contrastRatio(t.text, t.bg)
    checks.push({ pair: 'text/bg', ratio: r, required: 4.5, pass: r >= 4.5 })
  }
  if (t.muted && t.bg) {
    const r = contrastRatio(t.muted, t.bg)
    checks.push({ pair: 'muted/bg', ratio: r, required: 3, pass: r >= 3 })
  }
  if (t['accent-text'] && t.accent) {
    const r = contrastRatio(t['accent-text'], t.accent)
    checks.push({
      pair: 'accent-text/accent',
      ratio: r,
      required: 4.5,
      pass: r >= 4.5,
    })
  }

  const filePass = checks.every((c) => c.pass)
  if (!filePass) allPass = false

  const status = filePass ? 'PASS' : 'FAIL'
  const details = checks
    .map((c) => `  ${c.pass ? '  ' : '! '} ${c.pair}: ${c.ratio.toFixed(2)}:1 (min ${c.required}:1)`)
    .join('\n')
  console.log(`${status}  ${file}`)
  console.log(details)
}

console.log(`\n${allPass ? 'All files pass.' : 'Some files FAILED.'}`)
process.exit(allPass ? 0 : 1)
