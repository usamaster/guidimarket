import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Stock } from '../lib/database.types'

interface AdminPanelProps {
  stocks: Stock[]
  onUpdate: () => void
}

const ADJUSTMENTS = [
  { label: '-50%', value: -50 },
  { label: '-20%', value: -20 },
  { label: '-10%', value: -10 },
  { label: '-5%', value: -5 },
  { label: '+5%', value: 5 },
  { label: '+10%', value: 10 },
  { label: '+20%', value: 20 },
  { label: '+50%', value: 50 },
  { label: '+100%', value: 100 },
]

export function AdminPanel({ stocks, onUpdate }: AdminPanelProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const adjust = async (stockId: string, pct: number) => {
    setBusy(stockId + pct)
    await supabase.rpc('admin_adjust_price', { p_stock_id: stockId, p_percentage: pct })
    setBusy(null)
    onUpdate()
  }

  const generateNoise = async () => {
    setGenerating(true)
    await supabase.rpc('generate_fake_trades')
    setGenerating(false)
    onUpdate()
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-dark">Admin Panel</h2>
        <button
          onClick={generateNoise}
          disabled={generating}
          className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer"
        >
          {generating ? 'Generating...' : 'Generate Market Noise'}
        </button>
      </div>

      <div className="space-y-2">
        {stocks.map(stock => (
          <div key={stock.id} className="bg-surface rounded-xl border border-border p-3 flex items-center gap-3">
            <span className="text-lg">{stock.emoji}</span>
            <div className="w-16">
              <div className="text-xs font-bold text-dark">{stock.ticker}</div>
              <div className="text-[11px] text-text-muted">{Number(stock.current_price).toFixed(2)}</div>
            </div>
            <div className="flex-1 flex flex-wrap gap-1">
              {ADJUSTMENTS.map(a => (
                <button
                  key={a.value}
                  onClick={() => adjust(stock.id, a.value)}
                  disabled={busy === stock.id + a.value}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                    a.value < 0
                      ? 'bg-no-light text-no hover:bg-no hover:text-white'
                      : 'bg-yes-light text-yes hover:bg-yes hover:text-white'
                  } disabled:opacity-40`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
