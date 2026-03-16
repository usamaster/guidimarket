import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { ADMIN_USER_ID } from './lib/constants'
import type { Stock, PricePoint, Portfolio, Holding, Trade, NewsItem, MarketEvent } from './lib/database.types'
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
import { TradeLog } from './components/TradeLog'
import { ChatBox } from './components/ChatBox'
import { NewsFeed } from './components/NewsFeed'
import { NewsSnackbar } from './components/NewsSnackbar'
import { EventCalendar } from './components/EventCalendar'

type Tab = 'all' | 'gainers' | 'losers'
type Page = 'market' | 'tradelog' | 'news'
type StockSort = 'name' | 'price' | 'change' | 'change_desc'

async function loadAllData(userId: string): Promise<{
  stocks: Stock[]
  trades: Trade[]
  portfolio: Portfolio | null
  holdings: Holding[]
  priceHistory: Record<string, PricePoint[]>
  leaderboard: { username: string; totalValue: number; credits: number; holdings: Holding[] }[]
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
  const leaderboard: { username: string; totalValue: number; credits: number; holdings: Holding[] }[] = []
  for (const p of (allPortfolios.data || []) as Portfolio[]) {
    const userHoldings = ((allHoldings.data || []) as Holding[]).filter(h => h.user_id === p.user_id)
    const holdingsValue = computePortfolioValue(userHoldings, stocks)
    leaderboard.push({
      username: p.display_name || p.user_id.slice(0, 8),
      totalValue: Number(p.credits) + holdingsValue,
      credits: Number(p.credits),
      holdings: userHoldings,
    })
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
  const [leaderboard, setLeaderboard] = useState<{ username: string; totalValue: number; credits: number; holdings: Holding[] }[]>([])

  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState<Page>('market')
  const [stockSort, setStockSort] = useState<StockSort>('name')
  const [showAdmin, setShowAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [hasUnreadNews, setHasUnreadNews] = useState(false)
  const [snackbarNews, setSnackbarNews] = useState<NewsItem | null>(null)
  const [marketEvents, setMarketEvents] = useState<MarketEvent[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setAuthLoading(false)
    })
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
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
    supabase.from('news_items').select('*').eq('published', true).order('published_at', { ascending: false }).then(({ data }) => {
      if (!cancelled && data) setNewsItems(data as NewsItem[])
    })
    supabase.from('market_events').select('*').order('scheduled_at', { ascending: true }).then(({ data }) => {
      if (!cancelled && data) setMarketEvents(data as MarketEvent[])
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

    const newsChannel = supabase
      .channel('news-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'news_items' }, (payload) => {
        const item = payload.new as NewsItem
        if (item.published) {
          setNewsItems(prev => [item, ...prev.filter(n => n.id !== item.id)])
          setHasUnreadNews(true)
          setSnackbarNews(item)
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = 880
            osc.type = 'sine'
            gain.gain.value = 0.15
            osc.start()
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
            osc.stop(ctx.currentTime + 0.3)
          } catch (_) { void _ }
          if (Notification.permission === 'granted') {
            new Notification('📰 Breaking News — Landalf Stock Market', { body: item.headline, icon: '/favicon.svg' })
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(perm => {
              if (perm === 'granted') new Notification('📰 Breaking News — Landalf Stock Market', { body: item.headline, icon: '/favicon.svg' })
            })
          }
        }
      })
      .subscribe()

    const eventsChannel = supabase
      .channel('events-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'market_events' }, (payload) => {
        const ev = payload.new as MarketEvent
        setMarketEvents(prev => prev.map(e => e.id === ev.id ? ev : e))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(stockChannel)
      supabase.removeChannel(tradeChannel)
      supabase.removeChannel(newsChannel)
      supabase.removeChannel(eventsChannel)
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

  const pctChange = (s: Stock) => s.previous_close > 0 ? ((s.current_price - s.previous_close) / s.previous_close) * 100 : 0

  const filteredStocks = stocks
    .filter(s => {
      if (tab === 'gainers') return s.current_price > s.previous_close
      if (tab === 'losers') return s.current_price < s.previous_close
      return true
    })
    .sort((a, b) => {
      if (stockSort === 'price') return b.current_price - a.current_price
      if (stockSort === 'change') return pctChange(b) - pctChange(a)
      if (stockSort === 'change_desc') return pctChange(a) - pctChange(b)
      return a.ticker.localeCompare(b.ticker)
    })

  const selected = stocks.find(s => s.id === selectedStock) || null
  const selectedHolding = holdings.find(h => h.stock_id === selectedStock)?.quantity || 0

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <MarqueeTicker stocks={stocks} />
      <Header
        credits={credits}
        portfolioValue={portfolioValue}
        username={username}
        isAdmin={isAdmin}
        showAdmin={showAdmin}
        page={page}
        hasUnreadNews={hasUnreadNews}
        onPageChange={p => { setPage(p as Page); setShowAdmin(false); if (p === 'news') setHasUnreadNews(false) }}
        onToggleAdmin={() => setShowAdmin(!showAdmin)}
        onLogout={handleLogout}
      />

      {showAdmin && isAdmin ? (
        <div className="flex-1 overflow-y-auto">
          <AdminPanel stocks={stocks} onUpdate={handleTraded} />
        </div>
      ) : page === 'news' ? (
        <div className="flex-1 overflow-y-auto">
          <NewsFeed news={newsItems} stocks={stocks} />
        </div>
      ) : page === 'tradelog' ? (
        <div className="flex-1 overflow-y-auto">
          <TradeLog trades={trades} stocks={stocks} />
        </div>
      ) : (
        <main className="flex-1 flex min-h-0">
          <aside className="w-56 shrink-0 hidden xl:flex flex-col p-4 gap-3 overflow-y-auto border-r border-border">
            <PortfolioSidebar
              holdings={holdings}
              stocks={stocks}
              onStockClick={setSelectedStock}
            />
          </aside>

          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="flex items-center justify-between border-b border-border px-4 shrink-0">
              <div className="flex items-center gap-6">
                {([['all', 'All'], ['gainers', 'Top Gainers'], ['losers', 'Top Losers']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`pb-3 pt-3 text-sm font-medium transition-colors cursor-pointer relative ${tab === key ? 'text-dark' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    {label}
                    {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-text-muted mr-1">Sort:</span>
                {([['name', 'Name'], ['price', 'Price'], ['change', '% Gain'], ['change_desc', '% Loss']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setStockSort(key)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      stockSort === key ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-dark hover:bg-bg'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-7 h-7 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
            )}
          </div>

          <aside className="w-72 shrink-0 hidden lg:flex flex-col gap-3 p-4 border-l border-border min-h-0">
            <div className="shrink-0 overflow-y-auto max-h-[30%]">
              <Leaderboard entries={leaderboard} stocks={stocks} onStockClick={setSelectedStock} />
            </div>
            <div className="shrink-0 overflow-y-auto max-h-[30%]">
              <EventCalendar events={marketEvents} />
            </div>
            <div className="flex-1 min-h-0">
              <ChatBox userId={session.user.id} displayName={username} />
            </div>
          </aside>
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
      <NewsSnackbar
        item={snackbarNews}
        onDismiss={() => setSnackbarNews(null)}
        onNavigate={() => { setPage('news'); setHasUnreadNews(false) }}
      />
    </div>
  )
}

export default App
