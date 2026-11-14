/**
 * Figure data file schema validation.
 * Validates JSON data files that back inline SVG charts.
 * Pure functions — no I/O, no API calls.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validate a parsed figure data object.
 *
 * @param {object} figure - Parsed figure JSON
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFigure(figure) {
  const errors = []

  if (!figure.title || typeof figure.title !== 'string') {
    errors.push('Missing or empty title')
  }

  if (!figure.unit || typeof figure.unit !== 'string') {
    errors.push('Missing or empty unit')
  }

  if (!figure.series || !Array.isArray(figure.series)) {
    errors.push('Missing or invalid series array')
  } else {
    if (figure.series.length === 0) {
      errors.push('series must not be empty')
    }
    if (figure.series.length > 6) {
      errors.push(`series must have at most 6 entries (has ${figure.series.length})`)
    }
    for (let i = 0; i < figure.series.length; i++) {
      const entry = figure.series[i]
      if (!entry.label || typeof entry.label !== 'string') {
        errors.push(`series[${i}] missing label`)
      }
      const hasRange = typeof entry.low === 'number' && typeof entry.high === 'number'
      const hasValue = typeof entry.value === 'number'
      if (!hasRange && !hasValue) {
        errors.push(`series[${i}] must have either low/high or value`)
      }
    }
  }

  if (!figure.source || typeof figure.source !== 'object') {
    errors.push('Missing source object')
  } else {
    if (!figure.source.label || typeof figure.source.label !== 'string') {
      errors.push('Missing or empty source.label')
    }
  }

  if (!figure.updated || typeof figure.updated !== 'string') {
    errors.push('Missing updated date')
  } else if (!ISO_DATE_RE.test(figure.updated)) {
    errors.push('updated must be an ISO date string (YYYY-MM-DD)')
  }

  return { valid: errors.length === 0, errors }
}
