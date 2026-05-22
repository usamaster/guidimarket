import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'

interface DisplayNameFormProps {
  userId: string
  onSaved: () => void
}

export function DisplayNameForm({ userId, onSaved }: DisplayNameFormProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError(t.auth.nameTooShort)
      return
    }
    if (trimmed.length > 20) {
      setError(t.auth.nameTooLong)
      return
    }
    setSaving(true)
    setError('')

    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: trimmed } as Record<string, unknown>)
      .eq('user_id', userId)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <h1 className="text-xl font-bold text-dark text-center mb-1">{t.auth.chooseDisplayName}</h1>
        <p className="text-text-muted text-sm text-center mb-6">{t.auth.displayNameHint}</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t.auth.displayNamePlaceholder}
          maxLength={20}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary mb-3"
          autoFocus
        />
        {error && <p className="text-no text-xs mb-3">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? t.auth.saving : t.auth.continue}
        </button>
      </form>
    </div>
  )
}
