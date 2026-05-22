import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'

interface LoginScreenProps {
  onLoggedIn: () => void
}

export function LoginScreen({ onLoggedIn: _ }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = email.trim()
    if (!trimmed) return

    setLoading(true)
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    })

    if (magicError) {
      setError(magicError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  void _

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <h1 className="text-xl font-bold text-dark text-center mb-1">{t.auth.signIn}</h1>
        <p className="text-text-muted text-sm text-center mb-6">{t.auth.magicLinkHint}</p>

        {error && (
          <div className="bg-no-light text-no text-sm px-4 py-2.5 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {sent ? (
          <div className="bg-yes-light text-yes text-sm px-4 py-3 rounded-lg text-center">
            {t.auth.checkInbox} <span className="font-semibold">{email}</span>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t.auth.yourEmail}
              autoComplete="email"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-surface mb-5"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition-colors cursor-pointer text-sm"
            >
              {loading ? t.auth.sending : t.auth.sendMagicLink}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
