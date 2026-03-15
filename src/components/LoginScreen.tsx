import { useState } from 'react'
import { supabase } from '../lib/supabase'

const USERNAME_DOMAIN = 'guidimarket.app'

interface LoginScreenProps {
  onLoggedIn: () => void
}

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) return

    setLoading(true)
    const email = `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid username or password')
      setLoading(false)
      return
    }

    onLoggedIn()
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <h1 className="text-xl font-bold text-dark text-center mb-1">Sign in</h1>
        <p className="text-text-muted text-sm text-center mb-6">Enter your credentials to continue</p>

        {error && (
          <div className="bg-no-light text-no text-sm px-4 py-2.5 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-5">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-surface"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors bg-surface"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-semibold py-2.5 rounded-full transition-colors cursor-pointer text-sm"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
