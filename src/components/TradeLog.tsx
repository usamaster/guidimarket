import { useState, useMemo } from 'react'
import type { Trade, Stock } from '../lib/database.types'

interface TradeLogProps {
  trades: Trade[]
  stocks: Stock[]
}

type SortKey = 'time' | 'user' | 'stock' | 'type' | 'qty' | 'price' | 'total'
type SortDir = 'asc' | 'desc'

export function TradeLog({ trades, stocks }: TradeLogProps) {
  const [userFilter, setUserFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'buy' | 'sell' | 'short' | 'cover'>('')
  const [hideFake, setHideFake] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('time')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const stockMap = useMemo(() => {
    const m: Record<string, Stock> = {}
    for (const s of stocks) m[s.id] = s
    return m
  }, [stocks])

  const usernames = useMemo(() => {
    const set = new Set<string>()
    for (const t of trades) set.add(t.username)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [trades])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'time' ? 'desc' : 'asc')
    }
  }

  const sorted = useMemo(() => {
    const filtered = trades.filter(t => {
      if (userFilter && t.username !== userFilter) return false
      if (stockFilter && t.stock_id !== stockFilter) return false
      if (typeFilter && t.type !== typeFilter) return false
      if (hideFake && t.is_fake) return false
      return true
    })

    const mul = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'time': return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        case 'user': return mul * a.username.localeCompare(b.username)
        case 'stock': return mul * ((stockMap[a.stock_id]?.ticker || '').localeCompare(stockMap[b.stock_id]?.ticker || ''))
        case 'type': return mul * a.type.localeCompare(b.type)
        case 'qty': return mul * (a.quantity - b.quantity)
        case 'price': return mul * (Number(a.price) - Number(b.price))
        case 'total': return mul * (Number(a.total) - Number(b.total))
        default: return 0
      }
    })
  }, [trades, userFilter, stockFilter, typeFilter, hideFake, sortKey, sortDir, stockMap])

  const arrow = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-border ml-0.5">↕</span>
    return <span className="text-primary ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const thClass = 'px-4 py-2.5 font-medium cursor-pointer select-none hover:text-dark transition-colors'

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <h2 className="text-lg font-bold text-dark mb-4">Trade Log</h2>

      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All users</option>
          {usernames.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select
          value={stockFilter}
          onChange={e => setStockFilter(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All stocks</option>
          {stocks.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.ticker}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as '' | 'buy' | 'sell' | 'short' | 'cover')}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-surface text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All types</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
          <option value="short">Short</option>
          <option value="cover">Cover</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-dark cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideFake}
            onChange={e => setHideFake(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary accent-primary cursor-pointer"
          />
          Hide bot trades
        </label>

        {(userFilter || stockFilter || typeFilter || hideFake) && (
          <button
            onClick={() => { setUserFilter(''); setStockFilter(''); setTypeFilter(''); setHideFake(false) }}
            className="text-xs text-primary hover:text-primary-hover font-medium cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="text-xs text-text-muted mb-3">{sorted.length} trade{sorted.length !== 1 ? 's' : ''}</div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted text-xs">
              <th className={thClass} onClick={() => toggleSort('time')}>Time{arrow('time')}</th>
              <th className={thClass} onClick={() => toggleSort('user')}>User{arrow('user')}</th>
              <th className={thClass} onClick={() => toggleSort('stock')}>Stock{arrow('stock')}</th>
              <th className={thClass} onClick={() => toggleSort('type')}>Type{arrow('type')}</th>
              <th className={`${thClass} text-right`} onClick={() => toggleSort('qty')}>Qty{arrow('qty')}</th>
              <th className={`${thClass} text-right`} onClick={() => toggleSort('price')}>Price{arrow('price')}</th>
              <th className={`${thClass} text-right`} onClick={() => toggleSort('total')}>Total{arrow('total')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 200).map(t => {
              const stock = stockMap[t.stock_id]
              return (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-bg/50 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-text-muted whitespace-nowrap">
                    {new Date(t.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-dark">{t.username}</span>
                      {t.is_fake && <span className="text-[9px] bg-border text-text-muted px-1 py-0.5 rounded">bot</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-medium text-dark">{stock?.emoji} {stock?.ticker || '???'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      t.type === 'buy' || t.type === 'cover' ? 'bg-yes-light text-yes' : t.type === 'short' ? 'bg-primary/15 text-primary' : 'bg-no-light text-no'
                    }`}>
                      {t.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-dark text-right font-medium">{t.quantity}</td>
                  <td className="px-4 py-2.5 text-xs text-dark text-right">{Number(t.price).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs text-dark text-right font-semibold">{Number(t.total).toFixed(2)}</td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted text-sm">No trades match your filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
