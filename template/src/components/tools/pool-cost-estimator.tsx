import { useState } from 'preact/hooks'
import { calcPoolCost } from '../../lib/tool-calcs'
import { rangeBars } from '../../lib/figures'
import type { FigureData } from '../../lib/figures'

interface Props {
  phone?: string
  ctaPrimary?: string
}

const FEATURE_OPTIONS = [
  { id: 'screen_enclosure', label: 'Screen Enclosure' },
  { id: 'decking', label: 'Pool Decking' },
  { id: 'landscaping', label: 'Landscaping' },
  { id: 'lighting', label: 'Lighting Package' },
  { id: 'heater', label: 'Pool Heater' },
  { id: 'spa', label: 'Spa / Hot Tub' },
]

export default function PoolCostEstimator({ phone, ctaPrimary = 'Call for a Free Quote' }: Props) {
  const [type, setType] = useState('fiberglass')
  const [size, setSize] = useState('medium')
  const [features, setFeatures] = useState<string[]>([])

  const toggleFeature = (id: string) => {
    setFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }

  const result = calcPoolCost({ type, size, features })

  const series = [
    { label: 'Base Pool', low: result.baseRange.low, high: result.baseRange.high },
    ...result.featureAdds.map((f) => ({ label: f.label, low: f.low, high: f.high })),
  ]
  // Cap at 6 for figure
  const figureSeries = series.slice(0, 6)

  const figureData: FigureData = {
    title: 'Cost Breakdown',
    unit: 'dollars',
    series: figureSeries,
    source: { label: 'Based on local pool builder pricing' },
    updated: new Date().toISOString().slice(0, 10),
  }

  const svg = rangeBars(figureData)

  return (
    <div class="tool-calc">
      <div class="tool-inputs">
        <label>
          Pool Type
          <select value={type} onChange={(e) => setType((e.target as HTMLSelectElement).value)}>
            <option value="fiberglass">Fiberglass</option>
            <option value="concrete">Concrete / Gunite</option>
            <option value="vinyl">Vinyl Liner</option>
          </select>
        </label>
        <label>
          Pool Size
          <select value={size} onChange={(e) => setSize((e.target as HTMLSelectElement).value)}>
            <option value="small">Small (up to 400 sq ft)</option>
            <option value="medium">Medium (400–600 sq ft)</option>
            <option value="large">Large (600+ sq ft)</option>
          </select>
        </label>
        <fieldset class="feature-fieldset">
          <legend>Add-On Features</legend>
          {FEATURE_OPTIONS.map((opt) => (
            <label key={opt.id} class="checkbox-label">
              <input
                type="checkbox"
                checked={features.includes(opt.id)}
                onChange={() => toggleFeature(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>
      </div>
      <div class="tool-result">
        <div class="result-range">
          <span class="result-label">Estimated Total</span>
          <span class="result-value">${result.total.low.toLocaleString()} – ${result.total.high.toLocaleString()}</span>
        </div>
        <p class="result-detail">{result.timelineWeeks} weeks typical · Permit required</p>
        <div class="result-figure" dangerouslySetInnerHTML={{ __html: svg }} />
        <p class="result-note">Actual costs depend on site conditions, soil type, and local permits.</p>
        {phone && (
          <a href={`tel:${phone}`} class="tool-cta">{ctaPrimary}</a>
        )}
        <a href="/contact/" class="tool-link">Or request a free quote online</a>
      </div>
    </div>
  )
}
