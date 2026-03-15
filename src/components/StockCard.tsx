import type { Stock, PricePoint } from '../lib/database.types'

interface StockCardProps {
  stock: Stock
  history: PricePoint[]
  onClick: () => void
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const w = 80
  const h = 32
  const step = w / (points.length - 1)

  const d = points
    .map((p, i) => {
      const x = i * step
      const y = h - ((p - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} className="shrink-0">
      <path d={d} fill="none" stroke={up ? '#48C1B5' : '#E8503A'} strokeWidth="1.5" />
    </svg>
  )
}

export function StockCard({ stock, history, onClick }: StockCardProps) {
  const change = stock.current_price - stock.previous_close
  const changePct = stock.previous_close > 0 ? (change / stock.previous_close) * 100 : 0
  const up = change >= 0
  const prices = history.map(h => Number(h.price))

  return (
    <div
      onClick={onClick}
      className="bg-surface rounded-xl border border-border hover:border-border-hover transition-all cursor-pointer p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{stock.emoji}</span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-dark">{stock.ticker}</div>
            <div className="text-[11px] text-text-muted truncate">{stock.name}</div>
          </div>
        </div>
        <Sparkline points={prices} up={up} />
      </div>

      <div className="flex items-end justify-between">
        <span className="text-lg font-bold text-dark">{Number(stock.current_price).toFixed(2)}</span>
        <span className={`text-xs font-semibold ${up ? 'text-yes' : 'text-no'}`}>
          {up ? '+' : ''}{changePct.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}
