import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Bankruptcy } from '../lib/database.types'

interface VotePopupProps {
  bankruptcy: Bankruptcy
  userId: string
  displayName: string
  onVoted: () => void
  onDismiss: () => void
}

export function VotePopup({ bankruptcy, userId, displayName, onVoted, onDismiss }: VotePopupProps) {
  const [loading, setLoading] = useState(false)

  const alreadyVoted = bankruptcy.votes.some(v => v.user_id === userId)
  const yesVotes = bankruptcy.votes.filter(v => v.vote === 'yes').length
  const noVotes = bankruptcy.votes.filter(v => v.vote === 'no').length

  const handleVote = async (vote: 'yes' | 'no') => {
    setLoading(true)
    const newVotes = [...bankruptcy.votes, { user_id: userId, display_name: displayName, vote }]
    await supabase.from('bankruptcies').update({ votes: newVotes } as Record<string, unknown>).eq('id', bankruptcy.id)

    if (vote === 'yes') {
      await supabase.rpc('approve_bankruptcy', { p_bankruptcy_id: bankruptcy.id, p_user_id: userId })
    }

    onVoted()
    setLoading(false)
  }

  if (bankruptcy.user_id === userId) {
    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4">
        <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="text-3xl mb-3">⏳</div>
          <h3 className="text-base font-bold text-dark mb-2">Awaiting Judgment</h3>
          <p className="text-sm text-text-muted mb-3">Your apology has been sent. The other players are voting.</p>
          <div className="bg-bg rounded-xl p-3 mb-3">
            <p className="text-xs text-text-muted italic">"{bankruptcy.apology}"</p>
          </div>
          <div className="flex justify-center gap-4 text-sm">
            <span className="text-yes font-bold">👍 {yesVotes}</span>
            <span className="text-no font-bold">👎 {noVotes}</span>
          </div>
          {bankruptcy.status === 'approved' && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm font-bold text-green-700">
              🎉 You've been forgiven! Refresh to continue.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4" onClick={onDismiss}>
      <div className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-red-50 border-b border-red-200 px-5 py-3 text-center">
          <div className="text-2xl mb-1">💀</div>
          <h3 className="text-sm font-bold text-dark">
            <span className="text-red-600">{bankruptcy.display_name}</span> went bankrupt!
          </h3>
        </div>

        <div className="p-5">
          <p className="text-xs text-text-muted mb-2">Their apology:</p>
          <div className="bg-bg rounded-xl p-3 mb-4">
            <p className="text-sm text-dark italic">"{bankruptcy.apology}"</p>
          </div>

          <div className="flex justify-center gap-4 text-sm mb-4">
            <span className="text-yes font-bold">👍 {yesVotes}</span>
            <span className="text-no font-bold">👎 {noVotes}</span>
          </div>

          {alreadyVoted ? (
            <div className="text-center text-xs text-text-muted py-2">You already voted</div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => handleVote('yes')}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors text-sm"
              >
                🙏 Forgive
              </button>
              <button
                onClick={() => handleVote('no')}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors text-sm"
              >
                💀 Deny
              </button>
            </div>
          )}

          <p className="text-[10px] text-text-muted text-center mt-3">
            If approved, they get 1000 credits and all loans cleared
          </p>
        </div>
      </div>
    </div>
  )
}
