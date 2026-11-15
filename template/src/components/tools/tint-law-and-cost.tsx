import { useState } from 'preact/hooks'
import { calcTintLegality, calcTintCost } from '../../lib/tool-calcs'
import { rangeBars } from '../../lib/figures'
import type { FigureData } from '../../lib/figures'

interface Props {
  phone?: string
  ctaPrimary?: string
  state?: string
}

export default function TintLawAndCost({ phone, ctaPrimary = 'Call for a Free Quote', state: siteState = 'TX' }: Props) {
  const [tab, setTab] = useState<'legal' | 'cost'>('legal')

  // Legal check
  const [window, setWindow] = useState('front_side')
  const [desiredVLT, setDesiredVLT] = useState(25)
  const legalResult = calcTintLegality({ state: siteState, window, desiredVLT })

  // Cost check
  const [vehicle, setVehicle] = useState('sedan')
  const [film, setFilm] = useState('dyed')
  const [removal, setRemoval] = useState(false)
  const costResult = calcTintCost({ vehicle, film, removal })

  const costFigure: FigureData = {
    title: 'Your Estimate',
    unit: 'dollars',
    series: [
      { label: `${vehicle} (${film})`, low: costResult.total.low, high: costResult.total.high },
    ],
    source: { label: 'Based on local pricing' },
    updated: new Date().toISOString().slice(0, 10),
  }

  const costSvg = rangeBars(costFigure)

  return (
    <div class="tool-calc">
      <div class="tool-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'legal'} onClick={() => setTab('legal')} class={tab === 'legal' ? 'tab-active' : ''}>
          Tint Law Check
        </button>
        <button role="tab" aria-selected={tab === 'cost'} onClick={() => setTab('cost')} class={tab === 'cost' ? 'tab-active' : ''}>
          Cost Estimate
        </button>
      </div>

      {tab === 'legal' && (
        <div role="tabpanel">
          <div class="tool-inputs">
            <label>
              Window Position
              <select value={window} onChange={(e) => setWindow((e.target as HTMLSelectElement).value)}>
                <option value="windshield">Windshield</option>
                <option value="front_side">Front Side</option>
                <option value="rear_side">Rear Side</option>
                <option value="rear">Rear Window</option>
              </select>
            </label>
            <label>
              Desired VLT %
              <select value={desiredVLT} onChange={(e) => setDesiredVLT(Number((e.target as HTMLSelectElement).value))}>
                <option value={5}>5% (Limo)</option>
                <option value={15}>15%</option>
                <option value={20}>20%</option>
                <option value={25}>25%</option>
                <option value={30}>30%</option>
                <option value={35}>35%</option>
                <option value={50}>50%</option>
              </select>
            </label>
          </div>
          <div class="tool-result">
            <div class={`legal-badge ${legalResult.legal ? 'legal-pass' : 'legal-fail'}`}>
              {legalResult.legal ? 'Legal' : 'Not Legal'}
            </div>
            <p class="result-detail">
              {siteState} {window.replace('_', ' ')} limit: {legalResult.limit ?? 'Any'}% VLT
            </p>
            <p class="result-note">{legalResult.statute}</p>
          </div>
        </div>
      )}

      {tab === 'cost' && (
        <div role="tabpanel">
          <div class="tool-inputs">
            <label>
              Vehicle Type
              <select value={vehicle} onChange={(e) => setVehicle((e.target as HTMLSelectElement).value)}>
                <option value="sedan">Sedan</option>
                <option value="coupe">Coupe</option>
                <option value="suv">SUV</option>
                <option value="truck">Truck</option>
                <option value="van">Van / Minivan</option>
              </select>
            </label>
            <label>
              Film Type
              <select value={film} onChange={(e) => setFilm((e.target as HTMLSelectElement).value)}>
                <option value="dyed">Dyed</option>
                <option value="carbon">Carbon</option>
                <option value="ceramic">Ceramic</option>
              </select>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" checked={removal} onChange={() => setRemoval(!removal)} />
              Includes old tint removal
            </label>
          </div>
          <div class="tool-result">
            <div class="result-range">
              <span class="result-label">Estimated Cost</span>
              <span class="result-value">${costResult.total.low} – ${costResult.total.high}</span>
            </div>
            <div class="result-figure" dangerouslySetInnerHTML={{ __html: costSvg }} />
            <p class="result-note">Costs vary by installer, number of windows, and film brand.</p>
          </div>
        </div>
      )}

      {phone && (
        <a href={`tel:${phone}`} class="tool-cta">{ctaPrimary}</a>
      )}
      <a href="/contact/" class="tool-link">Or request a free quote online</a>
    </div>
  )
}
