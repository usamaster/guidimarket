import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface BankruptcyPopupProps {
  userId: string
  displayName: string
  onSubmitted: () => void
}

export function BankruptcyPopup({ userId, displayName, onSubmitted }: BankruptcyPopupProps) {
  const [apology, setApology] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = apology.trim()
    if (trimmed.length < 20) { setError('Your apology must be at least 20 characters. Mean it.'); return }
    setLoading(true)
    setError('')

    const { error: err } = await supabase.from('bankruptcies').insert({
      user_id: userId,
      display_name: displayName,
      apology: trimmed,
      status: 'pending',
      votes: [],
    } as Record<string, unknown>)

    if (err) { setError(err.message); setLoading(false); return }
    onSubmitted()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-surface rounded-2xl border-2 border-red-500 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-red-600 px-6 py-4 text-center">
          <div className="text-4xl mb-2">💀</div>
          <h2 className="text-xl font-black text-white">YOU ARE BANKRUPT</h2>
          <p className="text-red-100 text-sm mt-1">Your credits have reached zero</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-sm text-dark mb-4">
            To get a second chance, you must write a <span className="font-bold">sincere apology</span> to the other players.
            They will vote on whether you deserve a fresh start.
          </p>

          <p className="text-xs text-text-muted mb-3">
            If approved, you'll receive 1000 credits and all your loans will be cleared.
            If denied... well, write a better apology.
          </p>

          {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}

          <textarea
            value={apology}
            onChange={e => setApology(e.target.value)}
            placeholder="Dear fellow traders, I am truly sorry for..."
            className="w-full border-2 border-red-300 rounded-xl px-4 py-3 text-sm text-dark bg-bg placeholder:text-text-muted resize-none focus:outline-none focus:border-red-500"
            rows={5}
            maxLength={500}
            autoFocus
          />
          <div className="flex justify-between items-center mt-1 mb-4">
            <span className="text-[10px] text-text-muted">{apology.length}/500</span>
            <span className="text-[10px] text-text-muted">Min 20 characters</span>
          </div>

          <button
            type="submit"
            disabled={loading || apology.trim().length < 20}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors"
          >
            {loading ? 'Submitting...' : '🙏 Submit Apology & Beg for Mercy'}
          </button>
        </form>
      </div>
    </div>
  )
}
