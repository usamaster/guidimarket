import { useSyncExternalStore, useEffect } from 'react'
import type { Trade, Stock } from '../lib/database.types'

interface TradeTickerProps {
  trades: Trade[]
  stocks: Stock[]
}

interface Toast {
  id: string
  text: string
  type: Trade['type']
  ts: number
}

const seen = new Set<string>()
let toasts: Toast[] = []
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb) } }
function getSnapshot(): Toast[] { return toasts }

function ingestTrades(trades: Trade[], stocks: Stock[]) {
  const now = Date.now()
  const fresh: Toast[] = []
  for (const t of trades) {
    if (seen.has(t.id)) continue
    const age = now - new Date(t.created_at).getTime()
    if (age > 30_000) { seen.add(t.id); continue }
    seen.add(t.id)
    const stock = stocks.find(s => s.id === t.stock_id)
    const verb = t.type === 'buy' ? 'bought' : t.type === 'sell' ? 'sold' : t.type === 'short' ? 'shorted' : 'covered'
    fresh.push({
      id: t.id,
      text: `${t.username} ${verb} ${t.quantity}x ${stock?.emoji || ''} ${stock?.ticker || '???'} @ ${Number(t.price).toFixed(2)}`,
      type: t.type,
      ts: now,
    })
    if (fresh.length >= 3) break
  }
  if (fresh.length > 0) {
    toasts = [...fresh, ...toasts].slice(0, 5)
    emit()
  }
}

function prune() {
  const before = toasts.length
  toasts = toasts.filter(t => Date.now() - t.ts < 8000)
  if (toasts.length !== before) emit()
}

export function TradeTicker({ trades, stocks }: TradeTickerProps) {
  const current = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    ingestTrades(trades, stocks)
  }, [trades, stocks])

  useEffect(() => {
    const interval = setInterval(prune, 1000)
    return () => clearInterval(interval)
  }, [])

  if (current.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
      {current.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-[slideIn_0.3s_ease-out] ${
            toast.type === 'buy' || toast.type === 'cover'
              ? 'bg-yes text-white'
              : toast.type === 'short'
                ? 'bg-primary text-white'
                : 'bg-no text-white'
          }`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  )
}
