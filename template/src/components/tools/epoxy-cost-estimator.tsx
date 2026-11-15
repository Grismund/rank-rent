import { useState } from 'preact/hooks'
import { calcEpoxyCost } from '../../lib/tool-calcs'
import { rangeBars } from '../../lib/figures'
import type { FigureData } from '../../lib/figures'

interface Props {
  phone?: string
  ctaPrimary?: string
}

export default function EpoxyCostEstimator({ phone, ctaPrimary = 'Call for a Free Quote' }: Props) {
  const [garageCars, setGarageCars] = useState(2)
  const [finish, setFinish] = useState('solid')
  const [condition, setCondition] = useState('new')

  const result = calcEpoxyCost({ garageCars, finish, condition })

  const figureData: FigureData = {
    title: 'Your Estimate',
    unit: 'dollars',
    series: [
      { label: `${result.sqFt} sq ft (${finish})`, low: result.total.low, high: result.total.high },
    ],
    source: { label: 'Based on local contractor pricing' },
    updated: new Date().toISOString().slice(0, 10),
  }

  const svg = rangeBars(figureData)

  return (
    <div class="tool-calc">
      <div class="tool-inputs">
        <label>
          Garage Size
          <select value={garageCars} onChange={(e) => setGarageCars(Number((e.target as HTMLSelectElement).value))}>
            <option value={1}>1-Car (~250 sq ft)</option>
            <option value={2}>2-Car (~450 sq ft)</option>
            <option value={3}>3-Car (~700 sq ft)</option>
          </select>
        </label>
        <label>
          Finish Type
          <select value={finish} onChange={(e) => setFinish((e.target as HTMLSelectElement).value)}>
            <option value="solid">Solid Color</option>
            <option value="flake">Flake / Chip</option>
            <option value="metallic">Metallic</option>
            <option value="polyaspartic">Polyaspartic</option>
          </select>
        </label>
        <label>
          Floor Condition
          <select value={condition} onChange={(e) => setCondition((e.target as HTMLSelectElement).value)}>
            <option value="new">New / Good</option>
            <option value="minor_cracks">Minor Cracks</option>
            <option value="oil_stains">Oil Stains / Old Coating</option>
          </select>
        </label>
      </div>
      <div class="tool-result">
        <div class="result-range">
          <span class="result-label">Estimated Cost</span>
          <span class="result-value">${result.total.low.toLocaleString()} – ${result.total.high.toLocaleString()}</span>
        </div>
        <p class="result-detail">{result.perSqFt.low}–${result.perSqFt.high}/sq ft · {result.days} day{result.days > 1 ? 's' : ''} typical</p>
        <div class="result-figure" dangerouslySetInnerHTML={{ __html: svg }} />
        <p class="result-note">Costs vary by contractor, floor condition, and material brand.</p>
        {phone && (
          <a href={`tel:${phone}`} class="tool-cta">{ctaPrimary}</a>
        )}
        <a href="/contact/" class="tool-link">Or request a free quote online</a>
      </div>
    </div>
  )
}
