import { supabase } from '../lib/supabase'
import type { Loan } from '../lib/database.types'

interface LoanPopupProps {
  loans: Loan[]
  userId: string
  displayName: string
  credits: number
  onDismiss: () => void
  onNavigate: () => void
  onRefresh: () => void
}

export function LoanPopup({ loans, userId, displayName, credits, onDismiss, onNavigate, onRefresh }: LoanPopupProps) {
  const openForMe = loans.filter(l =>
    l.status === 'open' &&
    l.borrower_id !== userId &&
    !l.denied_by.some(d => d.user_id === userId)
  )

  const pendingActions = loans.filter(l =>
    l.status === 'funded' && l.borrower_id === userId
  )

  if (openForMe.length === 0 && pendingActions.length === 0) return null

  const handleFund = async (loan: Loan) => {
    await supabase.rpc('fund_loan', {
      p_loan_id: loan.id,
      p_lender_id: userId,
      p_lender_name: displayName,
    })
    onRefresh()
  }

  const handlePass = async (loan: Loan) => {
    const newDenied = [...loan.denied_by, { user_id: userId, display_name: displayName }]
    await supabase.from('loans').update({ denied_by: newDenied } as Record<string, unknown>).eq('id', loan.id)
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onDismiss}>
      <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-dark">🦈 Loan Requests</h2>
          <button onClick={onDismiss} className="text-text-muted hover:text-dark text-lg cursor-pointer">×</button>
        </div>

        <div className="p-4 space-y-3">
          {openForMe.length > 0 && (
            <>
              <p className="text-xs text-text-muted font-medium">Players need credits:</p>
              {openForMe.slice(0, 5).map(loan => (
                <div key={loan.id} className="bg-bg rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                      {loan.borrower_name[0]?.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-dark">{loan.borrower_name}</span>
                  </div>
                  <div className="ml-8">
                    <span className="text-base font-bold text-dark">{loan.amount}</span>
                    <span className="text-xs text-text-muted ml-1">credits @ {loan.interest_pct}%</span>
                    {loan.message && <p className="text-xs text-text-muted mt-0.5">"{loan.message}"</p>}
                  </div>
                  <div className="flex gap-2 mt-2 ml-8">
                    <button
                      onClick={() => handleFund(loan)}
                      disabled={credits < loan.amount}
                      className="bg-yes hover:bg-yes/80 disabled:opacity-40 text-white font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Fund
                    </button>
                    <button
                      onClick={() => handlePass(loan)}
                      className="bg-surface border border-border hover:bg-no-light text-text-muted hover:text-no font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Pass
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {pendingActions.length > 0 && (
            <>
              <p className="text-xs text-text-muted font-medium mt-2">Your active loans:</p>
              {pendingActions.map(loan => (
                <div key={loan.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs">
                  You owe <span className="font-bold text-dark">{loan.total_repay.toFixed(2)}</span> to <span className="font-bold text-dark">{loan.lender_name}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={onNavigate}
            className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-xl text-sm cursor-pointer transition-colors"
          >
            Go to Loanshark
          </button>
          <button
            onClick={onDismiss}
            className="px-4 bg-bg border border-border text-text-muted font-medium py-2.5 rounded-xl text-sm cursor-pointer transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
