import { useState } from 'preact/hooks'
import { calcLoadSize } from '../../lib/tool-calcs'
import { rangeBars } from '../../lib/figures'
import type { FigureData } from '../../lib/figures'

interface Props {
  phone?: string
  ctaPrimary?: string
}

const ITEM_OPTIONS = [
  { type: 'couch', label: 'Couch / Sofa' },
  { type: 'mattress', label: 'Mattress' },
  { type: 'dresser', label: 'Dresser' },
  { type: 'table', label: 'Table' },
  { type: 'chair', label: 'Chair' },
  { type: 'desk', label: 'Desk' },
  { type: 'appliance', label: 'Appliance' },
  { type: 'tv', label: 'TV / Monitor' },
  { type: 'boxes', label: 'Boxes (each)' },
  { type: 'tires', label: 'Tires (each)' },
  { type: 'yard_waste', label: 'Yard Waste (bag)' },
  { type: 'misc_bag', label: 'Misc Bag / Box' },
]

export default function LoadSizeEstimator({ phone, ctaPrimary = 'Call for a Free Quote' }: Props) {
  const [items, setItems] = useState<Record<string, number>>({})
  const [stairs, setStairs] = useState(false)

  const itemList = Object.entries(items)
    .filter(([, qty]) => qty > 0)
    .map(([type, qty]) => ({ type, qty }))

  const result = calcLoadSize({ items: itemList, stairsFlag: stairs })

  const updateQty = (type: string, delta: number) => {
    setItems((prev) => {
      const current = prev[type] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [type]: next }
    })
  }

  const figureData: FigureData = {
    title: 'Load Estimate',
    unit: 'dollars',
    series: result.cubicYards > 0
      ? [{ label: `${result.cubicYards} cu yd (${Math.round(result.truckFraction * 100)}% truck)`, low: result.priceRange.low, high: result.priceRange.high }]
      : [{ label: 'Add items above', value: 0 }],
    source: { label: 'Based on local junk removal pricing' },
    updated: new Date().toISOString().slice(0, 10),
  }

  const svg = result.cubicYards > 0 ? rangeBars(figureData) : ''

  return (
    <div class="tool-calc">
      <div class="tool-inputs item-picker">
        {ITEM_OPTIONS.map((opt) => (
          <div class="item-row" key={opt.type}>
            <span class="item-label">{opt.label}</span>
            <div class="item-controls">
              <button type="button" onClick={() => updateQty(opt.type, -1)} aria-label={`Remove ${opt.label}`}>−</button>
              <span class="item-qty">{items[opt.type] || 0}</span>
              <button type="button" onClick={() => updateQty(opt.type, 1)} aria-label={`Add ${opt.label}`}>+</button>
            </div>
          </div>
        ))}
        <label class="checkbox-label">
          <input type="checkbox" checked={stairs} onChange={() => setStairs(!stairs)} />
          Items require stairs
        </label>
      </div>
      {result.cubicYards > 0 && (
        <div class="tool-result">
          <div class="result-range">
            <span class="result-label">Estimated Cost</span>
            <span class="result-value">${result.priceRange.low} – ${result.priceRange.high}</span>
          </div>
          <p class="result-detail">
            {result.cubicYards} cubic yards · {Math.round(result.truckFraction * 8)}/8 truck load
            {result.extraCostItems.length > 0 && ` · +${result.extraCostItems.join(', ')}`}
          </p>
          <div class="result-figure" dangerouslySetInnerHTML={{ __html: svg }} />
          <p class="result-note">Final price depends on item weight, accessibility, and disposal fees.</p>
          {phone && (
            <a href={`tel:${phone}`} class="tool-cta">{ctaPrimary}</a>
          )}
          <a href="/contact/" class="tool-link">Or request a free quote online</a>
        </div>
      )}
    </div>
  )
}
