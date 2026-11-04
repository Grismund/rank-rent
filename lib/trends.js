/**
 * Aggregate weekly trend values into 12 monthly values.
 *
 * @param {number[]} values - Raw trend values (typically 52 weekly)
 * @param {string[]} dates - ISO date strings for each value (week start dates)
 * @returns {number[]} 12 monthly averages (rounded to integers)
 */
export function aggregateWeeklyToMonthly(values, dates) {
  if (values.length === 0) return []
  if (values.length <= 12 && dates.length === 0) return values

  // If we have dates, group by YYYY-MM and average
  if (dates.length === values.length) {
    const buckets = new Map()
    for (let i = 0; i < values.length; i++) {
      const month = dates[i].slice(0, 7) // "YYYY-MM"
      if (!buckets.has(month)) buckets.set(month, [])
      buckets.get(month).push(values[i])
    }
    // Sort months chronologically and average each
    const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    return sorted.map(([, vals]) => Math.round(vals.reduce((s, v) => s + v, 0) / vals.length))
  }

  // Fallback: no dates, split into 12 roughly equal chunks
  const result = []
  const chunkSize = values.length / 12
  for (let i = 0; i < 12; i++) {
    const start = Math.round(i * chunkSize)
    const end = Math.round((i + 1) * chunkSize)
    const chunk = values.slice(start, end)
    const avg = chunk.reduce((s, v) => s + v, 0) / chunk.length
    result.push(Math.round(avg))
  }
  return result
}
