import { useState } from 'preact/hooks'
import { calcKitchenBudget } from '../../lib/tool-calcs'
import { rangeBars } from '../../lib/figures'
import type { FigureData } from '../../lib/figures'

interface Props {
  phone?: string
  ctaPrimary?: string
}

export default function KitchenBudgetEstimator({ phone, ctaPrimary = 'Call for a Free Quote' }: Props) {
  const [size, setSize] = useState('medium')
  const [scope, setScope] = useState('standard')
  const [tier, setTier] = useState('mid')

  const result = calcKitchenBudget({ size, scope, tier })

  const figureData: FigureData = {
    title: 'Your Estimate',
    unit: 'dollars',
    series: [
      { label: `${size} kitchen (${scope})`, low: result.total.low, high: result.total.high },
    ],
    source: { label: 'Based on local contractor pricing' },
    updated: new Date().toISOString().slice(0, 10),
  }

  const svg = rangeBars(figureData)

  return (
    <div class="tool-calc">
      <div class="tool-inputs">
        <label>
          Kitchen Size
          <select value={size} onChange={(e) => setSize((e.target as HTMLSelectElement).value)}>
            <option value="small">Small (under 100 sq ft)</option>
            <option value="medium">Medium (100–200 sq ft)</option>
            <option value="large">Large (over 200 sq ft)</option>
          </select>
        </label>
        <label>
          Remodel Scope
          <select value={scope} onChange={(e) => setScope((e.target as HTMLSelectElement).value)}>
            <option value="cosmetic">Cosmetic (paint, hardware)</option>
            <option value="standard">Standard (cabinets, counters, fixtures)</option>
            <option value="full">Full (layout changes, plumbing, electrical)</option>
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
        <p class="result-note">Costs vary by cabinet brand, countertop material, and local labor rates.</p>
        {phone && (
          <a href={`tel:${phone}`} class="tool-cta">{ctaPrimary}</a>
        )}
        <a href="/contact/" class="tool-link">Or request a free quote online</a>
      </div>
    </div>
  )
}
