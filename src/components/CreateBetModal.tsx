import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface CreateBetModalProps {
  currentUser: string
  onClose: () => void
  onCreated: () => void
}

export function CreateBetModal({ currentUser, onClose, onCreated }: CreateBetModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [position, setPosition] = useState<'yes' | 'no'>('yes')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) return setError('Give your bet a title')
    if (!description.trim()) return setError('Add a description')
    if (!amount || parseFloat(amount) <= 0) return setError('Enter a valid amount')

    setSubmitting(true)
    const { error: insertError } = await supabase.from('bets').insert({
      title: title.trim(),
      description: description.trim(),
      amount: parseFloat(amount),
      creator: currentUser,
      creator_position: position,
    } as Record<string, unknown>)

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-5 pt-5 pb-0 flex items-center justify-between">
          <h2 className="text-lg font-bold text-dark">Create a new market</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg transition-colors text-text-muted hover:text-dark text-xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-no-light text-no text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark mb-1.5">Question</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Will it rain tomorrow in Amsterdam?"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the resolution criteria..."
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1.5">Stake</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="10.00"
                className="w-full border border-border rounded-lg pl-7 pr-3 py-2.5 text-sm text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1.5">Your position</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPosition('yes')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                  position === 'yes'
                    ? 'bg-yes text-white border-yes'
                    : 'bg-yes-light text-yes border-transparent hover:border-yes/30'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setPosition('no')}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                  position === 'no'
                    ? 'bg-no text-white border-no'
                    : 'bg-no-light text-no border-transparent hover:border-no/30'
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition-colors cursor-pointer"
          >
            {submitting ? 'Creating...' : 'Place Bet'}
          </button>
        </div>
      </form>
    </div>
  )
}
