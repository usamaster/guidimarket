import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, type IChartApi, type UTCTimestamp, ColorType, LineStyle, LineSeries } from 'lightweight-charts'
import type { Stock, PricePoint, Trade, Portfolio, ShortPosition } from '../lib/database.types'
import { supabase } from '../lib/supabase'
import { MAX_TRADE_QUANTITY, TRADE_COOLDOWN_MS, SHORT_COLLATERAL_RATIO } from '../lib/constants'

function formatTradeError(message: string, shortRelated: boolean): string {
  if (shortRelated && message.toLowerCase().includes('invalid trade type')) {
    return 'Short selling is not enabled on the database yet. In Supabase: SQL Editor → paste and run the file supabase/short_selling.sql → then reload this app.'
  }
  return message
}

interface StockDetailProps {
  stock: Stock
  history: PricePoint[]
  trades: Trade[]
  portfolio: Portfolio
  userHolding: number
  userShort: ShortPosition | null
  onClose: () => void
  onTraded: () => void
}

export function StockDetail({ stock, history, trades, portfolio, userHolding, userShort, onClose, onTraded }: StockDetailProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartApiRef = useRef<IChartApi | null>(null)
  const [tab, setTab] = useState<'buy' | 'sell' | 'short'>('buy')
  const [qty, setQty] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [cooldownEnd, setCooldownEnd] = useState(0)
  const [cooldownLeft, setCooldownLeft] = useState(0)

  const quantity = Math.min(MAX_TRADE_QUANTITY, Math.max(1, Math.floor(Number(qty) || 0)))
  const priceImpact = 0.5 * Math.sqrt(quantity)
  const execPriceBuy = stock.current_price * (1 + priceImpact / 100)
  const execPriceSell = stock.current_price * (1 - priceImpact / 100)
  const execPriceShort = execPriceSell
  const totalBuy = execPriceBuy * quantity
  const totalSell = execPriceSell * quantity
  const collateralShort = execPriceShort * quantity * SHORT_COLLATERAL_RATIO
  const onCooldown = cooldownLeft > 0

  const coverQty = userShort?.quantity ?? 0
  const coverImpact = 0.5 * Math.sqrt(coverQty)
  const coverExecPrice = stock.current_price * (1 + coverImpact / 100)
  const estCoverPayout = userShort
    ? Math.max(0, Number(userShort.collateral) + (Number(userShort.entry_price) - coverExecPrice) * coverQty)
    : 0
  const unrealizedShort = userShort
    ? (Number(userShort.entry_price) - Number(stock.current_price)) * userShort.quantity
    : 0

  useEffect(() => {
    if (cooldownEnd <= Date.now()) return
    const tick = () => {
      const left = Math.max(0, cooldownEnd - Date.now())
      setCooldownLeft(left)
      if (left <= 0) return
      requestAnimationFrame(tick)
    }
    tick()
  }, [cooldownEnd])

  const startCooldown = useCallback(() => {
    const end = Date.now() + TRADE_COOLDOWN_MS
    setCooldownEnd(end)
    setCooldownLeft(TRADE_COOLDOWN_MS)
  }, [])

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
    if (onCooldown) return
    setError('')
    setSubmitting(true)
    const { error: rpcError } = await supabase.rpc('execute_trade', {
      p_stock_id: stock.id,
      p_user_id: portfolio.user_id,
      p_type: tab,
      p_quantity: quantity,
    })
    if (rpcError) {
      setError(formatTradeError(rpcError.message, tab === 'short'))
      setSubmitting(false)
      return
    }
    startCooldown()
    setSubmitting(false)
    onTraded()
  }

  const handleCover = async () => {
    if (!userShort || onCooldown) return
    setError('')
    setSubmitting(true)
    const { error: rpcError } = await supabase.rpc('execute_trade', {
      p_stock_id: stock.id,
      p_user_id: portfolio.user_id,
      p_type: 'cover',
      p_quantity: userShort.quantity,
    })
    if (rpcError) {
      setError(formatTradeError(rpcError.message, true))
      setSubmitting(false)
      return
    }
    startCooldown()
    setSubmitting(false)
    onTraded()
  }

  const change = stock.current_price - stock.previous_close
  const changePct = stock.previous_close > 0 ? (change / stock.previous_close) * 100 : 0
  const up = change >= 0

  const stockTrades = trades
    .filter(t => t.stock_id === stock.id)
    .slice(0, 20)

  const canBuy = portfolio.credits >= totalBuy
  const canSell = userHolding >= quantity
  const canShort = !userShort && portfolio.credits >= collateralShort

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
                <button onClick={() => setTab('sell')} className={`flex-1 py-2 text-sm font-semibold cursor-pointer transition-colors ${tab === 'sell' ? 'bg-no text-white' : 'bg-bg text-text-muted'}`}>Sell</button>
                <button onClick={() => setTab('short')} className={`flex-1 py-2 text-sm font-semibold rounded-r-lg cursor-pointer transition-colors ${tab === 'short' ? 'bg-purple-600 text-white' : 'bg-bg text-text-muted'}`}>Short</button>
              </div>

              {error && <div className="bg-no-light text-no text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}

              {userShort && tab === 'short' && (
                <div className="space-y-3 mb-3 p-3 rounded-lg bg-bg border border-border">
                  <div className="text-xs font-semibold text-dark">Open short</div>
                  <div className="text-[11px] text-text-muted space-y-1">
                    <div className="flex justify-between"><span>Shares short</span><span>{userShort.quantity}</span></div>
                    <div className="flex justify-between"><span>Entry</span><span>{Number(userShort.entry_price).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Collateral</span><span>{Number(userShort.collateral).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Unrealized P/L</span><span className={unrealizedShort >= 0 ? 'text-yes' : 'text-no'}>{unrealizedShort >= 0 ? '+' : ''}{unrealizedShort.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Est. cover payout</span><span className="font-semibold text-dark">{estCoverPayout.toFixed(2)}</span></div>
                    <div className="text-[10px] text-text-muted pt-1">Liquidation if price rises 50%+ from entry</div>
                  </div>
                  <button
                    onClick={handleCover}
                    disabled={submitting || onCooldown}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white cursor-pointer disabled:opacity-40"
                  >
                    {submitting ? 'Processing...' : onCooldown ? `Wait ${Math.ceil(cooldownLeft / 1000)}s` : `Close short (${userShort.quantity} shares)`}
                  </button>
                </div>
              )}

              {(!userShort || tab !== 'short') && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-text-secondary">Shares</label>
                    <span className="text-[10px] text-text-muted">max {MAX_TRADE_QUANTITY}</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={MAX_TRADE_QUANTITY}
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Market price</span>
                  <span className="text-dark font-medium">{Number(stock.current_price).toFixed(2)}</span>
                </div>
                {tab === 'buy' && (
                  <>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Exec. price <span className="text-[10px]">(+{priceImpact.toFixed(2)}%)</span></span>
                      <span className="font-medium text-no">{execPriceBuy.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Total</span>
                      <span className="text-dark font-bold">{totalBuy.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Available</span>
                      <span>{Number(portfolio.credits).toFixed(2)}</span>
                    </div>
                  </>
                )}
                {tab === 'sell' && (
                  <>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Exec. price <span className="text-[10px]">(-{priceImpact.toFixed(2)}%)</span></span>
                      <span className="font-medium text-yes">{execPriceSell.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Total</span>
                      <span className="text-dark font-bold">{totalSell.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>You own</span>
                      <span>{userHolding} shares</span>
                    </div>
                  </>
                )}
                {tab === 'short' && (
                  <>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Exec. price <span className="text-[10px]">(-{priceImpact.toFixed(2)}%)</span></span>
                      <span className="font-medium text-yes">{execPriceShort.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Notional</span>
                      <span className="text-dark font-bold">{(execPriceShort * quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Collateral ({SHORT_COLLATERAL_RATIO}x)</span>
                      <span className="text-dark font-bold">{collateralShort.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Available</span>
                      <span>{Number(portfolio.credits).toFixed(2)}</span>
                    </div>
                  </>
                )}
                <button
                  onClick={handleTrade}
                  disabled={submitting || onCooldown || (tab === 'buy' ? !canBuy : tab === 'sell' ? !canSell : !canShort)}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${
                    tab === 'buy'
                      ? 'bg-yes hover:bg-yes-hover text-white'
                      : tab === 'sell'
                        ? 'bg-no hover:bg-no-hover text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {submitting ? 'Processing...' : onCooldown ? `Wait ${Math.ceil(cooldownLeft / 1000)}s` : tab === 'buy' ? `Buy ${quantity} shares` : tab === 'sell' ? `Sell ${quantity} shares` : `Short ${quantity} shares`}
                </button>
              </div>
              )}
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
                      <span className={`font-semibold ${
                        t.type === 'buy' || t.type === 'cover' ? 'text-yes' : t.type === 'short' ? 'text-primary' : 'text-no'
                      }`}>
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
