import type { Holding, Stock } from '../lib/database.types'

interface PortfolioProps {
  holdings: Holding[]
  stocks: Stock[]
  onStockClick: (stockId: string) => void
}

export function PortfolioSidebar({ holdings, stocks, onStockClick }: PortfolioProps) {
  if (holdings.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-dark mb-2">Your Holdings</h3>
        <p className="text-xs text-text-muted">No stocks yet. Buy some!</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-dark mb-3">Your Holdings</h3>
      <div className="space-y-2">
        {holdings.map(h => {
          const stock = stocks.find(s => s.id === h.stock_id)
          if (!stock) return null
          const value = stock.current_price * h.quantity
          const pnl = (stock.current_price - h.avg_buy_price) * h.quantity
          const up = pnl >= 0
          return (
            <div
              key={h.id}
              onClick={() => onStockClick(stock.id)}
              className="flex items-center justify-between cursor-pointer hover:bg-bg rounded-lg px-2 py-1.5 -mx-2 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{stock.emoji}</span>
                <div>
                  <div className="text-xs font-semibold text-dark">{h.quantity}x {stock.ticker}</div>
                  <div className="text-[10px] text-text-muted">avg {Number(h.avg_buy_price).toFixed(2)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-dark">{value.toFixed(2)}</div>
                <div className={`text-[10px] font-medium ${up ? 'text-yes' : 'text-no'}`}>
                  {up ? '+' : ''}{pnl.toFixed(2)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
