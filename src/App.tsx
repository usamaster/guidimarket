import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import type { Bet } from './lib/database.types'
import { Header } from './components/Header'
import { BetCard } from './components/BetCard'
import { CreateBetModal } from './components/CreateBetModal'
import { EmptyState } from './components/EmptyState'
import { UserPicker } from './components/UserPicker'

const USERS = ['Us', 'Victor', 'Fons', 'Yit', 'Aris'] as const
const TABS = ['All', 'Open', 'Active', 'Resolved'] as const

function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('guidimarket_user'))
  const [bets, setBets] = useState<Bet[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('All')

  const handleSelectUser = (user: string) => {
    localStorage.setItem('guidimarket_user', user)
    setCurrentUser(user)
  }

  const handleLogout = () => {
    localStorage.removeItem('guidimarket_user')
    setCurrentUser(null)
  }

  const fetchBets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setBets(data as Bet[])
    setLoading(false)
  }

  useEffect(() => {
    fetchBets()
  }, [])

  const handleBetCreated = () => {
    setShowCreateModal(false)
    fetchBets()
  }

  const handleTakeBet = async (betId: string, position: 'yes' | 'no') => {
    await supabase
      .from('bets')
      .update({
        taker: currentUser,
        taker_position: position,
        status: 'taken',
      })
      .eq('id', betId)
    fetchBets()
  }

  const filteredBets = bets.filter(b => {
    if (activeTab === 'All') return true
    if (activeTab === 'Open') return b.status === 'open'
    if (activeTab === 'Active') return b.status === 'taken'
    if (activeTab === 'Resolved') return b.status === 'resolved'
    return true
  })

  const openCount = bets.filter(b => b.status === 'open').length
  const activeCount = bets.filter(b => b.status === 'taken').length

  if (!currentUser) {
    return <UserPicker onSelect={handleSelectUser} />
  }

  return (
    <div className="min-h-screen bg-bg">
      <Header
        currentUser={currentUser}
        onCreateBet={() => setShowCreateModal(true)}
        onLogout={handleLogout}
      />

      <main className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="flex items-center gap-6 border-b border-border mb-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors cursor-pointer relative ${
                activeTab === tab
                  ? 'text-dark'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab}
              {tab === 'Open' && openCount > 0 && (
                <span className="ml-1.5 text-[11px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">{openCount}</span>
              )}
              {tab === 'Active' && activeCount > 0 && (
                <span className="ml-1.5 text-[11px] bg-yes/10 text-yes font-semibold px-1.5 py-0.5 rounded-full">{activeCount}</span>
              )}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : bets.length === 0 ? (
          <EmptyState onCreateBet={() => setShowCreateModal(true)} />
        ) : filteredBets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted text-sm">No {activeTab.toLowerCase()} bets</p>
          </div>
        ) : (
          <div className="flex gap-6">
            <div className="flex-1 min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBets.map(bet => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    currentUser={currentUser}
                    onTakeBet={handleTakeBet}
                  />
                ))}
              </div>
            </div>

            <aside className="w-72 shrink-0 hidden lg:block space-y-4">
              <div className="bg-surface rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-dark mb-3">Leaderboard</h3>
                <div className="space-y-2.5">
                  {(USERS as unknown as string[]).map((user, i) => {
                    const userBets = bets.filter(b => b.creator === user || b.taker === user)
                    return (
                      <div key={user} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted w-4">{i + 1}</span>
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                            {user[0]}
                          </div>
                          <span className="text-sm font-medium text-dark">{user}</span>
                        </div>
                        <span className="text-xs text-text-muted">{userBets.length} bets</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-dark mb-2">How it works</h3>
                <ol className="space-y-2 text-xs text-text-secondary">
                  <li className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                    Create a bet with a question
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                    Choose Yes or No and set a stake
                  </li>
                  <li className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                    Someone takes the other side
                  </li>
                </ol>
              </div>
            </aside>
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateBetModal
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleBetCreated}
        />
      )}
    </div>
  )
}

export default App
