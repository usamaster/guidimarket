import { useState } from 'react'
import type { Holding, ShortPosition, Stock } from '../lib/database.types'

interface LeaderEntry {
  username: string
  totalValue: number
  credits: number
  holdings: Holding[]
  shortPositions: ShortPosition[]
}

interface LeaderboardProps {
  entries: LeaderEntry[]
  stocks: Stock[]
  onStockClick: (stockId: string) => void
}

export function Leaderboard({ entries, stocks, onStockClick }: LeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.totalValue - a.totalValue)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-dark mb-3">Leaderboard</h3>
      <div className="space-y-1">
        {sorted.map((e, i) => {
          const isOpen = expanded === e.username
          return (
            <div key={e.username}>
              <div
                onClick={() => setExpanded(isOpen ? null : e.username)}
                className="flex items-center justify-between cursor-pointer hover:bg-bg rounded-lg px-2 py-1.5 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs w-4 text-center font-bold ${i === 0 ? 'text-primary' : 'text-text-muted'}`}>{i + 1}</span>
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                    {e.username[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-dark">{e.username}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-dark">{e.totalValue.toFixed(0)}</span>
                  <svg className={`w-3 h-3 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {isOpen && (
                <div className="ml-8 mr-1 mt-1 mb-2 bg-bg rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                    <span>Cash: {e.credits.toFixed(0)}</span>
                    <span>Positions: {(e.totalValue - e.credits).toFixed(0)}</span>
                  </div>
                  {e.holdings.length === 0 && e.shortPositions.length === 0 ? (
                    <p className="text-[10px] text-text-muted">No positions yet</p>
                  ) : (
                    <>
                      {e.holdings.map(h => {
                        const stock = stocks.find(s => s.id === h.stock_id)
                        if (!stock) return null
                        const value = stock.current_price * h.quantity
                        const pnl = (stock.current_price - h.avg_buy_price) * h.quantity
                        const up = pnl >= 0
                        return (
                          <div
                            key={h.id}
                            onClick={(ev) => { ev.stopPropagation(); onStockClick(stock.id) }}
                            className="flex items-center justify-between cursor-pointer hover:bg-surface rounded px-1.5 py-1 -mx-1.5 transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">{stock.emoji}</span>
                              <span className="text-[11px] font-semibold text-dark">{h.quantity}x {stock.ticker}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] font-semibold text-dark">{value.toFixed(0)}</span>
                              <span className={`text-[10px] ml-1 ${up ? 'text-yes' : 'text-no'}`}>
                                {up ? '+' : ''}{pnl.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      {e.shortPositions.map(sp => {
                        const stock = stocks.find(s => s.id === sp.stock_id)
                        if (!stock) return null
                        const unrealized = (Number(sp.entry_price) - Number(stock.current_price)) * sp.quantity
                        const up = unrealized >= 0
                        return (
                          <div
                            key={sp.id}
                            onClick={(ev) => { ev.stopPropagation(); onStockClick(stock.id) }}
                            className="flex items-center justify-between cursor-pointer hover:bg-surface rounded px-1.5 py-1 -mx-1.5 transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">{stock.emoji}</span>
                              <span className="text-[11px] font-semibold text-dark">-{sp.quantity}x {stock.ticker} short</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] font-semibold text-dark">{Number(sp.collateral).toFixed(0)}</span>
                              <span className={`text-[10px] ml-1 ${up ? 'text-yes' : 'text-no'}`}>
                                {up ? '+' : ''}{unrealized.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
