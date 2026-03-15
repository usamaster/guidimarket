import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { ADMIN_USER_ID } from './lib/constants'
import type { Stock, PricePoint, Portfolio, Holding, Trade } from './lib/database.types'
import type { Session } from '@supabase/supabase-js'
import { Header } from './components/Header'
import { computePortfolioValue } from './lib/portfolio'
import { LoginScreen } from './components/LoginScreen'
import { StockCard } from './components/StockCard'
import { StockDetail } from './components/StockDetail'
import { PortfolioSidebar } from './components/Portfolio'
import { Leaderboard } from './components/Leaderboard'
import { AdminPanel } from './components/AdminPanel'
import { TradeTicker } from './components/TradeTicker'
import { MarqueeTicker } from './components/MarqueeTicker'
import { DisplayNameForm } from './components/DisplayNameForm'

type Tab = 'all' | 'gainers' | 'losers'

async function loadAllData(userId: string): Promise<{
  stocks: Stock[]
  trades: Trade[]
  portfolio: Portfolio | null
  holdings: Holding[]
  priceHistory: Record<string, PricePoint[]>
  leaderboard: { username: string; totalValue: number }[]
}> {
  const [stocksRes, tradesRes, portfolioRes, holdingsRes] = await Promise.all([
    supabase.from('stocks').select('*').order('ticker'),
    supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.rpc('init_portfolio', { p_user_id: userId }),
    supabase.from('holdings').select('*').eq('user_id', userId),
  ])

  const stocks = (stocksRes.data || []) as Stock[]
  const trades = (tradesRes.data || []) as Trade[]
  const portfolio = portfolioRes.data ? (portfolioRes.data as unknown as Portfolio) : null
  const holdings = (holdingsRes.data || []) as Holding[]

  const histMap: Record<string, PricePoint[]> = {}
  const histRes = await supabase.from('price_history').select('*').order('created_at', { ascending: true })
  for (const p of (histRes.data || []) as PricePoint[]) {
    if (!histMap[p.stock_id]) histMap[p.stock_id] = []
    histMap[p.stock_id].push(p)
  }

  const allPortfolios = await supabase.from('portfolios').select('*')
  const allHoldings = await supabase.from('holdings').select('*')
  const leaderboard: { username: string; totalValue: number }[] = []
  for (const p of (allPortfolios.data || []) as Portfolio[]) {
    const userHoldings = ((allHoldings.data || []) as Holding[]).filter(h => h.user_id === p.user_id)
    const holdingsValue = computePortfolioValue(userHoldings, stocks)
    leaderboard.push({ username: p.display_name || p.user_id.slice(0, 8), totalValue: Number(p.credits) + holdingsValue })
  }

  return { stocks, trades, portfolio, holdings, priceHistory: histMap, leaderboard }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [stocks, setStocks] = useState<Stock[]>([])
  const [priceHistory, setPriceHistory] = useState<Record<string, PricePoint[]>>({})
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [leaderboard, setLeaderboard] = useState<{ username: string; totalValue: number }[]>([])

  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [showAdmin, setShowAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    loadAllData(session.user.id).then(result => {
      if (cancelled) return
      setStocks(result.stocks)
      setTrades(result.trades)
      setPortfolio(result.portfolio)
      setHoldings(result.holdings)
      setPriceHistory(result.priceHistory)
      setLeaderboard(result.leaderboard)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [session, refreshKey])

  useEffect(() => {
    if (!session) return

    const stockChannel = supabase
      .channel('stocks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stocks' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Stock
          setStocks(prev => prev.map(s => s.id === updated.id ? updated : s))
        }
      })
      .subscribe()

    const tradeChannel = supabase
      .channel('trades-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades' }, (payload) => {
        const newTrade = payload.new as Trade
        setTrades(prev => [newTrade, ...prev].slice(0, 200))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(stockChannel)
      supabase.removeChannel(tradeChannel)
    }
  }, [session])

  const handleTraded = () => setRefreshKey(k => k + 1)

  const handleLogout = () => {
    supabase.auth.signOut()
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onLoggedIn={() => {}} />
  }

  if (!loading && portfolio && !portfolio.display_name) {
    return <DisplayNameForm userId={session.user.id} onSaved={handleTraded} />
  }

  const username = portfolio?.display_name || session.user.email?.split('@')[0] || 'User'
  const isAdmin = session.user.id === ADMIN_USER_ID
  const credits = portfolio ? Number(portfolio.credits) : 1000
  const portfolioValue = computePortfolioValue(holdings, stocks)

  const filteredStocks = stocks.filter(s => {
    if (tab === 'gainers') return s.current_price > s.previous_close
    if (tab === 'losers') return s.current_price < s.previous_close
    return true
  })

  const selected = stocks.find(s => s.id === selectedStock) || null
  const selectedHolding = holdings.find(h => h.stock_id === selectedStock)?.quantity || 0

  return (
    <div className="min-h-screen bg-bg">
      <MarqueeTicker stocks={stocks} />
      <Header
        credits={credits}
        portfolioValue={portfolioValue}
        username={username}
        isAdmin={isAdmin}
        showAdmin={showAdmin}
        onToggleAdmin={() => setShowAdmin(!showAdmin)}
        onLogout={handleLogout}
      />

      {showAdmin && isAdmin ? (
        <AdminPanel stocks={stocks} onUpdate={handleTraded} />
      ) : (
        <main className="max-w-[1200px] mx-auto px-4 py-6">
          <div className="flex items-center gap-6 border-b border-border mb-6">
            {([['all', 'All'], ['gainers', 'Top Gainers'], ['losers', 'Top Losers']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`pb-3 text-sm font-medium transition-colors cursor-pointer relative ${tab === key ? 'text-dark' : 'text-text-muted hover:text-text-secondary'}`}
              >
                {label}
                {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-7 h-7 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex gap-6">
              <div className="flex-1 min-w-0">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredStocks.map(stock => (
                    <StockCard
                      key={stock.id}
                      stock={stock}
                      history={priceHistory[stock.id] || []}
                      onClick={() => setSelectedStock(stock.id)}
                    />
                  ))}
                </div>
              </div>

              <aside className="w-64 shrink-0 hidden lg:block space-y-4">
                <Leaderboard entries={leaderboard} />
                <PortfolioSidebar
                  holdings={holdings}
                  stocks={stocks}
                  onStockClick={setSelectedStock}
                />
              </aside>
            </div>
          )}
        </main>
      )}

      {selected && portfolio && (
        <StockDetail
          stock={selected}
          history={priceHistory[selected.id] || []}
          trades={trades}
          portfolio={portfolio}
          userHolding={selectedHolding}
          onClose={() => setSelectedStock(null)}
          onTraded={handleTraded}
        />
      )}

      <TradeTicker trades={trades} stocks={stocks} />
    </div>
  )
}

export default App
