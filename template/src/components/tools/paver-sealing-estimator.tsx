import { useState } from 'preact/hooks'
import { calcPaverSealing } from '../../lib/tool-calcs'
import { rangeBars } from '../../lib/figures'
import type { FigureData } from '../../lib/figures'

interface Props {
  phone?: string
  ctaPrimary?: string
}

const AREA_PRESETS = [
  { label: 'Walkway (~200 sq ft)', value: 200 },
  { label: 'Patio (~400 sq ft)', value: 400 },
  { label: 'Driveway (~600 sq ft)', value: 600 },
  { label: 'Large Driveway (~1,000 sq ft)', value: 1000 },
]

export default function PaverSealingEstimator({ phone, ctaPrimary = 'Call for a Free Quote' }: Props) {
  const [areaSqFt, setAreaSqFt] = useState(600)
  const [condition, setCondition] = useState('good')
  const [finish, setFinish] = useState('wet_look')
  const [resand, setResand] = useState(false)

  const result = calcPaverSealing({ areaSqFt, condition, finish, resand })

  const figureData: FigureData = {
    title: 'Your Estimate',
    unit: 'dollars',
    series: [
      { label: `${areaSqFt} sq ft (${finish.replace('_', ' ')})`, low: result.total.low, high: result.total.high },
    ],
    source: { label: 'Based on local paver sealing pricing' },
    updated: new Date().toISOString().slice(0, 10),
  }

  const svg = rangeBars(figureData)

  return (
    <div class="tool-calc">
      <div class="tool-inputs">
        <label>
          Area Size
          <select value={areaSqFt} onChange={(e) => setAreaSqFt(Number((e.target as HTMLSelectElement).value))}>
            {AREA_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label>
          Paver Condition
          <select value={condition} onChange={(e) => setCondition((e.target as HTMLSelectElement).value)}>
            <option value="good">Good (minimal wear)</option>
            <option value="fair">Fair (some settling/weeds)</option>
            <option value="poor">Poor (needs repair first)</option>
          </select>
        </label>
        <label>
          Sealer Finish
          <select value={finish} onChange={(e) => setFinish((e.target as HTMLSelectElement).value)}>
            <option value="wet_look">Wet Look (enhances color)</option>
            <option value="matte">Matte (natural look)</option>
            <option value="penetrating">Penetrating (invisible protection)</option>
          </select>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" checked={resand} onChange={() => setResand(!resand)} />
          Include polymeric re-sanding
        </label>
      </div>
      <div class="tool-result">
        <div class="result-range">
          <span class="result-label">Estimated Cost</span>
          <span class="result-value">${result.total.low.toLocaleString()} – ${result.total.high.toLocaleString()}</span>
        </div>
        <p class="result-detail">Reseal every {result.resealIntervalYears} years for best protection</p>
        <div class="result-figure" dangerouslySetInnerHTML={{ __html: svg }} />
        <p class="result-note">Costs vary by paver type, stain severity, and accessibility.</p>
        {phone && (
          <a href={`tel:${phone}`} class="tool-cta">{ctaPrimary}</a>
        )}
        <a href="/contact/" class="tool-link">Or request a free quote online</a>
      </div>
    </div>
  )
}
