import { useState } from 'preact/hooks'
import { calcSurfaceCost } from '../../lib/tool-calcs'
import { rangeBars } from '../../lib/figures'
import type { FigureData } from '../../lib/figures'

interface Props {
  phone?: string
  ctaPrimary?: string
}

const SURFACE_OPTIONS = [
  { type: 'driveway', label: 'Driveway', defaultSqFt: 600 },
  { type: 'house', label: 'House Exterior', defaultSqFt: 2000 },
  { type: 'deck', label: 'Deck / Patio', defaultSqFt: 400 },
  { type: 'patio', label: 'Patio / Walkway', defaultSqFt: 300 },
  { type: 'fence', label: 'Fence', defaultSqFt: 500 },
  { type: 'roof', label: 'Roof (Soft Wash)', defaultSqFt: 1500 },
]

interface SurfaceEntry {
  type: string
  sqFt: number
  enabled: boolean
}

export default function SurfaceCostEstimator({ phone, ctaPrimary = 'Call for a Free Quote' }: Props) {
  const [surfaces, setSurfaces] = useState<SurfaceEntry[]>(
    SURFACE_OPTIONS.map((o) => ({ type: o.type, sqFt: o.defaultSqFt, enabled: false }))
  )

  const toggleSurface = (idx: number) => {
    setSurfaces((prev) => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s))
  }

  const updateSqFt = (idx: number, sqFt: number) => {
    setSurfaces((prev) => prev.map((s, i) => i === idx ? { ...s, sqFt } : s))
  }

  const activeSurfaces = surfaces
    .filter((s) => s.enabled)
    .map((s) => ({ type: s.type, sqFt: s.sqFt }))

  const result = calcSurfaceCost({ surfaces: activeSurfaces })

  const figureSeries = result.perSurface.map((p) => ({
    label: SURFACE_OPTIONS.find((o) => o.type === p.label)?.label ?? p.label,
    low: p.low,
    high: p.high,
  }))

  const figureData: FigureData = {
    title: 'Cost Breakdown',
    unit: 'dollars',
    series: figureSeries.length > 0 ? figureSeries.slice(0, 6) : [{ label: 'Select surfaces above', value: 0 }],
    source: { label: 'Based on local pressure washing pricing' },
    updated: new Date().toISOString().slice(0, 10),
  }

  const svg = figureSeries.length > 0 ? rangeBars(figureData) : ''

  return (
    <div class="tool-calc">
      <div class="tool-inputs surface-picker">
        {surfaces.map((s, idx) => {
          const opt = SURFACE_OPTIONS[idx]
          return (
            <div class="surface-row" key={s.type}>
              <label class="checkbox-label">
                <input type="checkbox" checked={s.enabled} onChange={() => toggleSurface(idx)} />
                {opt.label}
              </label>
              {s.enabled && (
                <label class="sqft-input">
                  <input
                    type="number"
                    min="50"
                    max="10000"
                    step="50"
                    value={s.sqFt}
                    onChange={(e) => updateSqFt(idx, Number((e.target as HTMLInputElement).value))}
                  />
                  sq ft
                </label>
              )}
            </div>
          )
        })}
      </div>
      {activeSurfaces.length > 0 && (
        <div class="tool-result">
          <div class="result-range">
            <span class="result-label">Estimated Total</span>
            <span class="result-value">${result.total.low} – ${result.total.high}</span>
          </div>
          <p class="result-detail">Recommended frequency: every {result.frequencyMonths} months</p>
          <div class="result-figure" dangerouslySetInnerHTML={{ __html: svg }} />
          <p class="result-note">Final price depends on surface condition, stain severity, and accessibility.</p>
          {phone && (
            <a href={`tel:${phone}`} class="tool-cta">{ctaPrimary}</a>
          )}
          <a href="/contact/" class="tool-link">Or request a free quote online</a>
        </div>
      )}
    </div>
  )
}
