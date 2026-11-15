import { useState } from 'preact/hooks'
import { calcBathBudget } from '../../lib/tool-calcs'
import { rangeBars } from '../../lib/figures'
import type { FigureData } from '../../lib/figures'

interface Props {
  phone?: string
  ctaPrimary?: string
}

export default function BathBudgetEstimator({ phone, ctaPrimary = 'Call for a Free Quote' }: Props) {
  const [type, setType] = useState('full')
  const [scope, setScope] = useState('standard')
  const [tier, setTier] = useState('mid')

  const result = calcBathBudget({ type, scope, tier })

  const figureData: FigureData = {
    title: 'Your Estimate',
    unit: 'dollars',
    series: [
      { label: `${type} bath (${scope})`, low: result.total.low, high: result.total.high },
    ],
    source: { label: 'Based on local contractor pricing' },
    updated: new Date().toISOString().slice(0, 10),
  }

  const svg = rangeBars(figureData)

  return (
    <div class="tool-calc">
      <div class="tool-inputs">
        <label>
          Bathroom Type
          <select value={type} onChange={(e) => setType((e.target as HTMLSelectElement).value)}>
            <option value="half">Half Bath</option>
            <option value="full">Full Bathroom</option>
            <option value="master">Master Bath</option>
          </select>
        </label>
        <label>
          Remodel Scope
          <select value={scope} onChange={(e) => setScope((e.target as HTMLSelectElement).value)}>
            <option value="cosmetic">Cosmetic (paint, fixtures)</option>
            <option value="standard">Standard (tile, vanity, fixtures)</option>
            <option value="full">Full (layout changes, plumbing)</option>
          </select>
        </label>
        <label>
          Material Tier
          <select value={tier} onChange={(e) => setTier((e.target as HTMLSelectElement).value)}>
            <option value="budget">Budget</option>
            <option value="mid">Mid-Range</option>
            <option value="premium">Premium</option>
          </select>
        </label>
      </div>
      <div class="tool-result">
        <div class="result-range">
          <span class="result-label">Estimated Budget</span>
          <span class="result-value">${result.total.low.toLocaleString()} – ${result.total.high.toLocaleString()}</span>
        </div>
        <p class="result-detail">{result.timelineWeeks} week{result.timelineWeeks > 1 ? 's' : ''} typical{result.permitRequired ? ' · Permit likely required' : ''}</p>
        <div class="result-figure" dangerouslySetInnerHTML={{ __html: svg }} />
        <p class="result-note">Costs vary by contractor, materials chosen, and local permit fees.</p>
        {phone && (
          <a href={`tel:${phone}`} class="tool-cta">{ctaPrimary}</a>
        )}
        <a href="/contact/" class="tool-link">Or request a free quote online</a>
      </div>
    </div>
  )
}
