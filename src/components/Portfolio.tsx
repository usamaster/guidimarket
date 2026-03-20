import type { Holding, ShortPosition, Stock } from '../lib/database.types'

interface PortfolioProps {
  holdings: Holding[]
  shortPositions: ShortPosition[]
  stocks: Stock[]
  onStockClick: (stockId: string) => void
}

export function PortfolioSidebar({ holdings, shortPositions, stocks, onStockClick }: PortfolioProps) {
  const hasHoldings = holdings.length > 0
  const hasShorts = shortPositions.length > 0

  return (
    <div className="space-y-3">
      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-dark mb-2">Your Holdings</h3>
        {!hasHoldings ? (
          <p className="text-xs text-text-muted">No stocks yet. Buy some!</p>
        ) : (
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
        )}
      </div>

      <div className="bg-surface rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-dark mb-2">Short positions</h3>
        {!hasShorts ? (
          <p className="text-xs text-text-muted">No open shorts. Open one from a stock.</p>
        ) : (
          <div className="space-y-2">
            {shortPositions.map(sp => {
              const stock = stocks.find(s => s.id === sp.stock_id)
              if (!stock) return null
              const unrealized = (Number(sp.entry_price) - Number(stock.current_price)) * sp.quantity
              const up = unrealized >= 0
              return (
                <div
                  key={sp.id}
                  onClick={() => onStockClick(stock.id)}
                  className="flex items-center justify-between cursor-pointer hover:bg-bg rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{stock.emoji}</span>
                    <div>
                      <div className="text-xs font-semibold text-dark">-{sp.quantity}x {stock.ticker}</div>
                      <div className="text-[10px] text-text-muted">entry {Number(sp.entry_price).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-dark">{Number(sp.collateral).toFixed(2)} col.</div>
                    <div className={`text-[10px] font-medium ${up ? 'text-yes' : 'text-no'}`}>
                      {up ? '+' : ''}{unrealized.toFixed(2)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
