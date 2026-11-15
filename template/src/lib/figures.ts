/**
 * SVG figure primitives — pure functions returning SVG markup strings.
 * Used by DataFigure (build-time) and Preact tool islands (runtime).
 * Colors use CSS variables only — same SVG works on any token set.
 */

export interface FigureSeriesEntry {
  label: string
  low?: number
  high?: number
  value?: number
}

export interface FigureData {
  title: string
  unit: string
  series: FigureSeriesEntry[]
  source: { label: string; url?: string }
  updated: string
}

function validateSeries(data: FigureData, maxEntries: number): void {
  if (!data.series || data.series.length === 0) {
    throw new Error('series must not be empty')
  }
  if (data.series.length > maxEntries) {
    throw new Error(`series must have at most ${maxEntries} entries (has ${data.series.length})`)
  }
}

/** Get the effective value for a series entry: value, or midpoint of low/high. */
function effectiveValue(entry: FigureSeriesEntry): number {
  if (typeof entry.value === 'number') return entry.value
  return ((entry.low ?? 0) + (entry.high ?? 0)) / 2
}

/** Get the low bound: value or low. */
function lowBound(entry: FigureSeriesEntry): number {
  if (typeof entry.low === 'number') return entry.low
  return entry.value ?? 0
}

/** Get the high bound: value or high. */
function highBound(entry: FigureSeriesEntry): number {
  if (typeof entry.high === 'number') return entry.high
  return entry.value ?? 0
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Horizontal range bars — low→high with midpoint tick.
 * Up to 6 series entries.
 */
export function rangeBars(data: FigureData): string {
  validateSeries(data, 6)

  const labelWidth = 120
  const valueWidth = 50
  const barAreaWidth = 200
  const rowHeight = 20
  const rowGap = 12
  const padTop = 8
  const padBottom = 8
  const totalWidth = labelWidth + barAreaWidth + valueWidth
  const totalHeight = padTop + data.series.length * (rowHeight + rowGap) - rowGap + padBottom

  // Find global min/max for scale
  const allLows = data.series.map(lowBound)
  const allHighs = data.series.map(highBound)
  const globalMin = Math.min(...allLows)
  const globalMax = Math.max(...allHighs)
  const range = globalMax - globalMin || 1

  const rows = data.series.map((entry, i) => {
    const y = padTop + i * (rowHeight + rowGap)
    const lo = lowBound(entry)
    const hi = highBound(entry)
    const barX = labelWidth + ((lo - globalMin) / range) * barAreaWidth
    const barW = Math.max(((hi - lo) / range) * barAreaWidth, 2)
    const mid = (barX + barX + barW) / 2
    const barH = 16

    const trackX = labelWidth
    const trackW = barAreaWidth

    // Value label
    const isRange = typeof entry.low === 'number' && typeof entry.high === 'number'
    const valText = isRange ? `${lo}–${hi}` : `${entry.value}`

    return [
      // Track
      `<rect x="${trackX}" y="${y + (rowHeight - barH) / 2}" width="${trackW}" height="${barH}" rx="4" fill="var(--surface)" stroke="var(--border)" stroke-width="0.5"/>`,
      // Data bar
      `<rect x="${barX}" y="${y + (rowHeight - barH) / 2}" width="${barW}" height="${barH}" rx="4" fill="var(--accent)"/>`,
      // Midpoint tick
      `<line x1="${mid}" y1="${y + 1}" x2="${mid}" y2="${y + rowHeight - 1}" stroke="var(--text)" stroke-width="1" opacity="0.5"/>`,
      // Label
      `<text x="${labelWidth - 8}" y="${y + rowHeight / 2 + 1}" text-anchor="end" fill="var(--muted)" font-size="11" dominant-baseline="middle">${escapeXml(entry.label)}</text>`,
      // Value
      `<text x="${labelWidth + barAreaWidth + 8}" y="${y + rowHeight / 2 + 1}" fill="var(--text)" font-size="11" dominant-baseline="middle">${valText}</text>`,
    ].join('\n    ')
  })

  // Grid lines
  const gridSteps = 4
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const x = labelWidth + (i / gridSteps) * barAreaWidth
    return `<line x1="${x}" y1="0" x2="${x}" y2="${totalHeight}" stroke="var(--border)" stroke-width="0.5" opacity="0.5"/>`
  })

  return `<svg viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  ${gridLines.join('\n  ')}
  ${rows.join('\n  ')}
</svg>`
}

/**
 * Dot-range — two dots joined by a line per series entry.
 * Up to 6 series entries.
 */
export function dotRange(data: FigureData): string {
  validateSeries(data, 6)

  const labelWidth = 120
  const dotAreaWidth = 200
  const valueWidth = 50
  const rowHeight = 20
  const rowGap = 14
  const padTop = 8
  const padBottom = 8
  const totalWidth = labelWidth + dotAreaWidth + valueWidth
  const totalHeight = padTop + data.series.length * (rowHeight + rowGap) - rowGap + padBottom
  const dotR = 4

  const allLows = data.series.map(lowBound)
  const allHighs = data.series.map(highBound)
  const globalMin = Math.min(...allLows)
  const globalMax = Math.max(...allHighs)
  const range = globalMax - globalMin || 1

  const rows = data.series.map((entry, i) => {
    const cy = padTop + i * (rowHeight + rowGap) + rowHeight / 2
    const lo = lowBound(entry)
    const hi = highBound(entry)
    const x1 = labelWidth + ((lo - globalMin) / range) * dotAreaWidth
    const x2 = labelWidth + ((hi - globalMin) / range) * dotAreaWidth
    const isSingle = lo === hi

    const parts = [
      // Label
      `<text x="${labelWidth - 8}" y="${cy + 1}" text-anchor="end" fill="var(--muted)" font-size="11" dominant-baseline="middle">${escapeXml(entry.label)}</text>`,
    ]

    if (!isSingle) {
      // Connecting line
      parts.push(
        `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="var(--accent)" stroke-width="2"/>`
      )
      // Low dot
      parts.push(
        `<circle cx="${x1}" cy="${cy}" r="${dotR}" fill="var(--accent)"/>`
      )
      // High dot
      parts.push(
        `<circle cx="${x2}" cy="${cy}" r="${dotR}" fill="var(--accent)"/>`
      )
    } else {
      // Single value dot
      parts.push(
        `<circle cx="${x1}" cy="${cy}" r="${dotR}" fill="var(--accent)"/>`
      )
    }

    // Value label
    const isRange = typeof entry.low === 'number' && typeof entry.high === 'number'
    const valText = isRange ? `${lo}–${hi}` : `${entry.value}`
    parts.push(
      `<text x="${labelWidth + dotAreaWidth + 8}" y="${cy + 1}" fill="var(--text)" font-size="11" dominant-baseline="middle">${valText}</text>`
    )

    return parts.join('\n    ')
  })

  // Grid lines
  const gridSteps = 4
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const x = labelWidth + (i / gridSteps) * dotAreaWidth
    return `<line x1="${x}" y1="0" x2="${x}" y2="${totalHeight}" stroke="var(--border)" stroke-width="0.5" opacity="0.5"/>`
  })

  return `<svg viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  ${gridLines.join('\n  ')}
  ${rows.join('\n  ')}
</svg>`
}

/**
 * Vertical columns — up to 4 categories.
 * For range entries, shows a bar spanning low→high.
 * For single-value entries, shows a bar from 0 to value.
 */
export function columns(data: FigureData): string {
  validateSeries(data, 4)

  const padLeft = 40
  const padRight = 16
  const padTop = 16
  const labelHeight = 36
  const chartHeight = 140
  const totalWidth = 360
  const totalHeight = padTop + chartHeight + labelHeight
  const barArea = totalWidth - padLeft - padRight
  const barGap = 16
  const n = data.series.length
  const barWidth = Math.min((barArea - barGap * (n - 1)) / n, 60)
  const groupWidth = n * barWidth + (n - 1) * barGap
  const startX = padLeft + (barArea - groupWidth) / 2

  // Find global max for scale
  const allValues = data.series.map(highBound)
  const globalMax = Math.max(...allValues) || 1

  // Y-axis grid
  const gridSteps = 4
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const y = padTop + chartHeight - (i / gridSteps) * chartHeight
    const val = Math.round((i / gridSteps) * globalMax)
    return [
      `<line x1="${padLeft}" y1="${y}" x2="${totalWidth - padRight}" y2="${y}" stroke="var(--border)" stroke-width="0.5" opacity="0.5"/>`,
      `<text x="${padLeft - 6}" y="${y + 1}" text-anchor="end" fill="var(--muted)" font-size="10" dominant-baseline="middle">${val}</text>`,
    ].join('\n  ')
  })

  const bars = data.series.map((entry, i) => {
    const x = startX + i * (barWidth + barGap)
    const val = effectiveValue(entry)
    const barH = (val / globalMax) * chartHeight
    const y = padTop + chartHeight - barH

    return [
      `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="var(--accent)"/>`,
      // Value label above bar
      `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" fill="var(--text)" font-size="11">${Math.round(val)}</text>`,
      // Category label below
      `<text x="${x + barWidth / 2}" y="${padTop + chartHeight + 16}" text-anchor="middle" fill="var(--muted)" font-size="10">${escapeXml(entry.label)}</text>`,
    ].join('\n    ')
  })

  return `<svg viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  ${gridLines.join('\n  ')}
  ${bars.join('\n  ')}
</svg>`
}
