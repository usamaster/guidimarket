import type { Loan } from '../lib/database.types'

interface LoanToastProps {
  loan: Loan
  userId: string
  onDismiss: () => void
  onNavigate: () => void
}

export function LoanToast({ loan, userId, onDismiss, onNavigate }: LoanToastProps) {
  const isBorrower = loan.borrower_id === userId

  let message = ''
  let icon = '🦈'
  if (loan.status === 'open' && !isBorrower) {
    message = `${loan.borrower_name} requests ${loan.amount} credits`
  } else if (loan.status === 'funded' && isBorrower) {
    icon = '💰'
    message = `${loan.lender_name} funded your ${loan.amount} credit loan!`
  } else if (loan.status === 'funded' && !isBorrower && loan.lender_id === userId) {
    icon = '🤝'
    message = `You funded ${loan.borrower_name}'s loan`
  } else if (loan.status === 'repaid' && !isBorrower && loan.lender_id === userId) {
    icon = '✅'
    message = `${loan.borrower_name} repaid ${loan.total_repay.toFixed(2)} credits!`
  } else if (loan.status === 'cancelled' && !isBorrower) {
    return null
  } else {
    return null
  }

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] bg-surface border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 cursor-pointer animate-[slideDown_0.3s_ease-out]"
      onClick={() => { onNavigate(); onDismiss() }}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-dark">{message}</span>
      <button onClick={e => { e.stopPropagation(); onDismiss() }} className="text-text-muted hover:text-dark text-lg ml-2 cursor-pointer">×</button>
    </div>
  )
}
