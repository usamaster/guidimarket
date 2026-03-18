import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Loan } from '../lib/database.types'

interface LoanSharkPageProps {
  loans: Loan[]
  userId: string
  displayName: string
  credits: number
  onRefresh: () => void
}

const AMOUNT_OPTIONS = [25, 50, 100, 200, 500, 1000]
const INTEREST_OPTIONS = [0, 5, 10, 15, 25, 50]

export function LoanSharkPage({ loans, userId, displayName, credits, onRefresh }: LoanSharkPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState(100)
  const [interestPct, setInterestPct] = useState(10)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'open' | 'active' | 'history'>('open')

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const myOpenRequests = loans.filter(l => l.borrower_id === userId && l.status === 'open')
  const openLoans = loans.filter(l => l.status === 'open' && l.borrower_id !== userId && !l.denied_by.some(d => d.user_id === userId))
  const activeLoans = loans.filter(l => l.status === 'funded' && (l.borrower_id === userId || l.lender_id === userId))
  const historyLoans = loans.filter(l => (l.status === 'repaid' || l.status === 'cancelled') && (l.borrower_id === userId || l.lender_id === userId))

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (amount <= 0) return
    setLoading(true)
    const totalRepay = Math.round(amount * (1 + interestPct / 100) * 100) / 100
    const { error: err } = await supabase.from('loans').insert({
      borrower_id: userId,
      borrower_name: displayName,
      amount,
      interest_pct: interestPct,
      total_repay: totalRepay,
      message: message.trim() || null,
      status: 'open',
      denied_by: [],
    } as Record<string, unknown>)
    if (err) setError(err.message)
    else { setShowForm(false); setMessage(''); onRefresh() }
    setLoading(false)
  }

  const handleCancel = async (loanId: string) => {
    await supabase.from('loans').update({ status: 'cancelled' } as Record<string, unknown>).eq('id', loanId)
    onRefresh()
  }

  const handleFund = async (loan: Loan) => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.rpc('fund_loan', {
      p_loan_id: loan.id,
      p_lender_id: userId,
      p_lender_name: displayName,
    })
    if (err) setError(err.message)
    else if (data !== 'ok') setError(data as string)
    onRefresh()
    setLoading(false)
  }

  const handleDeny = async (loan: Loan) => {
    const newDenied = [...loan.denied_by, { user_id: userId, display_name: displayName }]
    await supabase.from('loans').update({ denied_by: newDenied } as Record<string, unknown>).eq('id', loan.id)
    onRefresh()
  }

  const handleRepay = async (loan: Loan) => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.rpc('repay_loan', {
      p_loan_id: loan.id,
      p_borrower_id: userId,
    })
    if (err) setError(err.message)
    else if (data !== 'ok') setError(data as string)
    onRefresh()
    setLoading(false)
  }

  const timeAgo = (dateStr: string) => {
    const diff = now - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-dark">🦈 Loanshark</h1>
          <p className="text-sm text-text-muted">Borrow credits from other players — with interest</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary hover:bg-primary-hover text-white font-semibold px-4 py-2 rounded-xl text-sm cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ Request loan'}
        </button>
      </div>

      {error && <div className="bg-no-light text-no text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>}

      {showForm && (
        <form onSubmit={handleRequest} className="bg-surface border border-border rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Amount</label>
            <div className="flex gap-1.5 flex-wrap">
              {AMOUNT_OPTIONS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    amount === a ? 'bg-primary text-white' : 'bg-bg text-text-muted border border-border hover:text-dark'
                  }`}
                >
                  {a}
                </button>
              ))}
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                className="w-20 border border-border rounded-lg px-2 py-1 text-xs text-dark bg-bg"
                min={1}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Interest %</label>
            <div className="flex gap-1.5 flex-wrap">
              {INTEREST_OPTIONS.map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInterestPct(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    interestPct === i ? 'bg-primary text-white' : 'bg-bg text-text-muted border border-border hover:text-dark'
                  }`}
                >
                  {i}%
                </button>
              ))}
            </div>
          </div>

          <div className="bg-bg rounded-lg p-2 text-xs text-text-muted">
            You borrow <span className="font-bold text-dark">{amount}</span>, you repay <span className="font-bold text-dark">{(amount * (1 + interestPct / 100)).toFixed(2)}</span> credits
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Message (optional)</label>
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Why do you need credits?"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-dark bg-bg placeholder:text-text-muted"
              maxLength={200}
            />
          </div>

          <button
            type="submit"
            disabled={loading || amount <= 0}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm cursor-pointer transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit request'}
          </button>
        </form>
      )}

      {myOpenRequests.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-text-muted mb-2">Your open requests</h3>
          {myOpenRequests.map(loan => (
            <div key={loan.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-dark">{loan.amount} credits</span>
                <span className="text-xs text-text-muted ml-2">@ {loan.interest_pct}% interest</span>
                {loan.message && <p className="text-xs text-text-muted mt-0.5">"{loan.message}"</p>}
                {loan.denied_by.length > 0 && (
                  <p className="text-[10px] text-no mt-0.5">Passed by: {loan.denied_by.map(d => d.display_name).join(', ')}</p>
                )}
              </div>
              <button
                onClick={() => handleCancel(loan.id)}
                className="text-xs text-no hover:text-no/80 font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 mb-3 border-b border-border">
        {([['open', 'Open requests', openLoans.length], ['active', 'Active loans', activeLoans.length], ['history', 'History', historyLoans.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2.5 pt-2 px-3 text-xs font-medium transition-colors cursor-pointer relative ${
              tab === key ? 'text-dark' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {label} {count > 0 && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{count}</span>}
            {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {tab === 'open' && (
        <div className="space-y-2">
          {openLoans.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">No open loan requests right now</p>
          ) : openLoans.map(loan => (
            <div key={loan.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {loan.borrower_name[0]?.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-dark">{loan.borrower_name}</span>
                    <span className="text-[10px] text-text-muted">{timeAgo(loan.created_at)}</span>
                  </div>
                  <div className="mt-2 ml-9">
                    <span className="text-lg font-bold text-dark">{loan.amount}</span>
                    <span className="text-sm text-text-muted ml-1">credits</span>
                    <span className="text-xs text-text-muted ml-2">@ {loan.interest_pct}% → repays {loan.total_repay.toFixed(2)}</span>
                  </div>
                  {loan.message && <p className="text-xs text-text-muted mt-1 ml-9">"{loan.message}"</p>}
                  {loan.denied_by.length > 0 && (
                    <p className="text-[10px] text-text-muted mt-1 ml-9">Passed by {loan.denied_by.length} player{loan.denied_by.length > 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleFund(loan)}
                    disabled={loading || credits < loan.amount}
                    className="bg-yes hover:bg-yes/80 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    Fund
                  </button>
                  <button
                    onClick={() => handleDeny(loan)}
                    className="bg-bg border border-border hover:bg-no-light text-text-muted hover:text-no font-medium px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    Pass
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'active' && (
        <div className="space-y-2">
          {activeLoans.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">No active loans</p>
          ) : activeLoans.map(loan => {
            const isBorrower = loan.borrower_id === userId
            return (
              <div key={loan.id} className={`rounded-xl p-4 border ${isBorrower ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-text-muted mb-1">
                      {isBorrower
                        ? <>You borrowed from <span className="font-bold text-dark">{loan.lender_name}</span></>
                        : <>You funded <span className="font-bold text-dark">{loan.borrower_name}</span></>
                      }
                    </div>
                    <span className="text-lg font-bold text-dark">{loan.amount}</span>
                    <span className="text-sm text-text-muted ml-1">credits</span>
                    <span className="text-xs text-text-muted ml-2">→ repay {loan.total_repay.toFixed(2)}</span>
                    {loan.funded_at && <span className="text-[10px] text-text-muted ml-2">funded {timeAgo(loan.funded_at)}</span>}
                  </div>
                  {isBorrower && (
                    <button
                      onClick={() => handleRepay(loan)}
                      disabled={loading || credits < loan.total_repay}
                      className="bg-primary hover:bg-primary-hover disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Repay {loan.total_repay.toFixed(2)}
                    </button>
                  )}
                  {!isBorrower && (
                    <span className="text-xs font-medium text-text-muted bg-bg px-3 py-2 rounded-lg">Waiting for repayment</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {historyLoans.length === 0 ? (
            <p className="text-sm text-text-muted py-6 text-center">No loan history yet</p>
          ) : historyLoans.map(loan => {
            const isBorrower = loan.borrower_id === userId
            return (
              <div key={loan.id} className="bg-surface border border-border rounded-xl p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    {loan.status === 'repaid' ? '✅' : '❌'}
                    <span className="ml-1.5">
                      {isBorrower
                        ? <>Borrowed {loan.amount} from {loan.lender_name || '—'}</>
                        : <>Funded {loan.amount} to {loan.borrower_name}</>
                      }
                    </span>
                    <span className="text-text-muted ml-1">@ {loan.interest_pct}%</span>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    loan.status === 'repaid' ? 'bg-yes-light text-yes' : 'bg-bg text-text-muted'
                  }`}>
                    {loan.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 text-center text-sm text-text-muted">
        Your balance: <span className="font-bold text-dark">{credits.toFixed(2)}</span> credits
      </div>
    </div>
  )
}
