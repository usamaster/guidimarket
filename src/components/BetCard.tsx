import type { Bet } from '../lib/database.types'

interface BetCardProps {
  bet: Bet
  currentUser: string
  onTakeBet: (betId: string, position: 'yes' | 'no') => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function BetCard({ bet, currentUser, onTakeBet }: BetCardProps) {
  const isCreator = bet.creator === currentUser
  const canTake = bet.status === 'open' && !isCreator

  const yesPercent = bet.creator_position === 'yes' ? 65 : 35
  const noPercent = 100 - yesPercent

  return (
    <div className="bg-surface rounded-xl border border-border hover:border-border-hover transition-all group cursor-default">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
            {bet.title[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-dark text-[15px] leading-snug line-clamp-2">{bet.title}</h3>
            <p className="text-text-muted text-xs mt-0.5 line-clamp-1">{bet.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-text-secondary">{formatCurrency(bet.amount)}</span>
          <span className="text-text-muted">·</span>
          <span className="text-xs text-text-muted">{bet.creator} bet {bet.creator_position.toUpperCase()}</span>
          <span className="text-text-muted">·</span>
          <span className="text-xs text-text-muted">{timeAgo(bet.created_at)}</span>
        </div>

        {bet.status === 'open' && (
          <div className="flex gap-2">
            <button
              onClick={() => canTake && onTakeBet(bet.id, 'yes')}
              disabled={!canTake}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                canTake
                  ? 'bg-yes-light text-yes hover:bg-yes hover:text-white cursor-pointer'
                  : 'bg-yes-light/50 text-yes/40 cursor-default'
              }`}
            >
              Yes {yesPercent}%
            </button>
            <button
              onClick={() => canTake && onTakeBet(bet.id, 'no')}
              disabled={!canTake}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                canTake
                  ? 'bg-no-light text-no hover:bg-no hover:text-white cursor-pointer'
                  : 'bg-no-light/50 text-no/40 cursor-default'
              }`}
            >
              No {noPercent}%
            </button>
          </div>
        )}

        {bet.status === 'taken' && bet.taker && (
          <div className="flex items-center justify-between bg-bg rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-yes/20 text-yes text-[10px] font-bold flex items-center justify-center">
                {(bet.creator_position === 'yes' ? bet.creator : bet.taker)[0]}
              </div>
              <span className="text-xs font-medium text-dark">
                {bet.creator_position === 'yes' ? bet.creator : bet.taker}
              </span>
              <span className="text-[10px] font-semibold text-yes bg-yes-light px-1.5 py-0.5 rounded">YES</span>
            </div>
            <span className="text-xs text-text-muted font-medium">vs</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-no bg-no-light px-1.5 py-0.5 rounded">NO</span>
              <span className="text-xs font-medium text-dark">
                {bet.creator_position === 'no' ? bet.creator : bet.taker}
              </span>
              <div className="w-5 h-5 rounded-full bg-no/20 text-no text-[10px] font-bold flex items-center justify-center">
                {(bet.creator_position === 'no' ? bet.creator : bet.taker)[0]}
              </div>
            </div>
          </div>
        )}

        {bet.status === 'resolved' && bet.winner && (
          <div className="bg-yes-light rounded-lg px-3 py-2 text-center">
            <span className="text-xs font-semibold text-yes">{bet.winner} won {formatCurrency(bet.amount * 2)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
