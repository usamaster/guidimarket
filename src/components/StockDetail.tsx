import { useState, useEffect, useRef } from 'react'
import { createChart, type IChartApi, type UTCTimestamp, ColorType, LineStyle, LineSeries } from 'lightweight-charts'
import type { Stock, PricePoint, Trade, Portfolio } from '../lib/database.types'
import { supabase } from '../lib/supabase'

interface StockDetailProps {
  stock: Stock
  history: PricePoint[]
  trades: Trade[]
  portfolio: Portfolio
  userHolding: number
  onClose: () => void
  onTraded: () => void
}

export function StockDetail({ stock, history, trades, portfolio, userHolding, onClose, onTraded }: StockDetailProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartApiRef = useRef<IChartApi | null>(null)
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const quantity = Math.max(1, Math.floor(Number(qty) || 0))
  const total = stock.current_price * quantity
  const canBuy = portfolio.credits >= total
  const canSell = userHolding >= quantity

  useEffect(() => {
    if (!chartRef.current) return
    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 220,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#999' },
      grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      crosshair: { horzLine: { style: LineStyle.Dashed }, vertLine: { style: LineStyle.Dashed } },
    })
    const series = chart.addSeries(LineSeries, {
      color: stock.current_price >= stock.previous_close ? '#48C1B5' : '#E8503A',
      lineWidth: 2,
    })

    const data = history.map(p => ({
      time: Math.floor(new Date(p.created_at).getTime() / 1000) as UTCTimestamp,
      value: Number(p.price),
    }))

    const unique = data.filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time)
    if (unique.length > 0) series.setData(unique)
    chart.timeScale().fitContent()

    chartApiRef.current = chart
    const onResize = () => chart.applyOptions({ width: chartRef.current?.clientWidth || 400 })
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.remove() }
  }, [history, stock])

  const handleTrade = async () => {
    setError('')
    setSubmitting(true)
    const { error: rpcError } = await supabase.rpc('execute_trade', {
      p_stock_id: stock.id,
      p_user_id: portfolio.user_id,
      p_type: tab,
      p_quantity: quantity,
    })
    if (rpcError) {
      setError(rpcError.message)
      setSubmitting(false)
      return
    }
    setSubmitting(false)
    onTraded()
  }

  const change = stock.current_price - stock.previous_close
  const changePct = stock.previous_close > 0 ? (change / stock.previous_close) * 100 : 0
  const up = change >= 0

  const stockTrades = trades
    .filter(t => t.stock_id === stock.id)
    .slice(0, 20)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{stock.emoji}</span>
            <div>
              <div className="font-bold text-dark text-lg">{stock.ticker}</div>
              <div className="text-xs text-text-muted">{stock.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xl font-bold text-dark">{Number(stock.current_price).toFixed(2)}</div>
              <div className={`text-xs font-semibold ${up ? 'text-yes' : 'text-no'}`}>
                {up ? '+' : ''}{change.toFixed(2)} ({up ? '+' : ''}{changePct.toFixed(1)}%)
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg text-text-muted hover:text-dark text-xl cursor-pointer">&times;</button>
          </div>
        </div>

        <div className="p-5">
          <div ref={chartRef} className="mb-5 rounded-lg overflow-hidden" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex mb-3">
                <button onClick={() => setTab('buy')} className={`flex-1 py-2 text-sm font-semibold rounded-l-lg cursor-pointer transition-colors ${tab === 'buy' ? 'bg-yes text-white' : 'bg-bg text-text-muted'}`}>Buy</button>
                <button onClick={() => setTab('sell')} className={`flex-1 py-2 text-sm font-semibold rounded-r-lg cursor-pointer transition-colors ${tab === 'sell' ? 'bg-no text-white' : 'bg-bg text-text-muted'}`}>Sell</button>
              </div>

              {error && <div className="bg-no-light text-no text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Shares</label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Price per share</span>
                  <span className="text-dark font-medium">{Number(stock.current_price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Total</span>
                  <span className="text-dark font-bold">{total.toFixed(2)}</span>
                </div>
                {tab === 'buy' && (
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Available</span>
                    <span>{Number(portfolio.credits).toFixed(2)}</span>
                  </div>
                )}
                {tab === 'sell' && (
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>You own</span>
                    <span>{userHolding} shares</span>
                  </div>
                )}
                <button
                  onClick={handleTrade}
                  disabled={submitting || (tab === 'buy' ? !canBuy : !canSell)}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                    tab === 'buy'
                      ? 'bg-yes hover:bg-yes-hover text-white'
                      : 'bg-no hover:bg-no-hover text-white'
                  }`}
                >
                  {submitting ? 'Processing...' : tab === 'buy' ? `Buy ${quantity} shares` : `Sell ${quantity} shares`}
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-dark mb-2">Recent Trades</div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {stockTrades.length === 0 && (
                  <div className="text-xs text-text-muted py-4 text-center">No trades yet</div>
                )}
                {stockTrades.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-[11px] py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold ${t.type === 'buy' ? 'text-yes' : 'text-no'}`}>
                        {t.type.toUpperCase()}
                      </span>
                      <span className="text-text-muted">{t.quantity}x @ {Number(t.price).toFixed(2)}</span>
                    </div>
                    <span className="text-text-muted">{t.username}{t.is_fake ? ' 🤖' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
