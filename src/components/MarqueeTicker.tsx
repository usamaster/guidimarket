import type { Stock } from '../lib/database.types'

interface MarqueeTickerProps {
  stocks: Stock[]
}

export function MarqueeTicker({ stocks }: MarqueeTickerProps) {
  if (stocks.length === 0) return null

  const items = [...stocks, ...stocks]

  return (
    <div className="bg-dark text-white overflow-hidden whitespace-nowrap h-8 flex items-center text-xs font-mono">
      <div className="animate-[marquee_40s_linear_infinite] flex gap-6 pr-6">
        {items.map((s, i) => {
          const pctChange = s.previous_close > 0
            ? ((s.current_price - s.previous_close) / s.previous_close) * 100
            : 0
          const up = pctChange >= 0
          return (
            <span key={`${s.id}-${i}`} className="inline-flex items-center gap-1.5">
              <span>{s.emoji}</span>
              <span className="font-semibold">{s.ticker}</span>
              <span>{Number(s.current_price).toFixed(2)}</span>
              <span className={up ? 'text-green-400' : 'text-red-400'}>
                {up ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
