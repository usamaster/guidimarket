import { useState } from 'react'
import { toggleTheme } from '../lib/theme'
import { t, fmtTokens } from '../lib/i18n'
import { APP_NAME } from '../lib/constants'

export type Page = 'predictions' | 'knockout' | 'sidebets' | 'leaderboard'

interface HeaderProps {
  tokens: number
  predictionPoints: number
  username: string
  isAdmin: boolean
  showAdmin: boolean
  page: Page
  onPageChange: (page: Page) => void
  onToggleAdmin: () => void
  onLogout: () => void
  onRefresh: () => Promise<void> | void
}

export function Header({ tokens, predictionPoints, username, isAdmin, showAdmin, page, onPageChange, onToggleAdmin, onLogout, onRefresh }: HeaderProps) {
  const [refreshing, setRefreshing] = useState(false)
  const handleRefreshClick = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }
  const navItems: ReadonlyArray<readonly [Page, string, string]> = [
    ['predictions', '🎯', t.nav.predictions],
    ['knockout', '🏟️', t.nav.knockout],
    ['sidebets', '🎲', t.nav.sidebets],
    ['leaderboard', '🏆', t.nav.leaderboard],
  ] as const

  return (
    <>
      <header className="bg-surface border-b border-border sticky top-0 z-50">
        <div className="w-full px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <span className="text-[18px] font-medium tracking-tight text-dark cursor-pointer" onClick={() => onPageChange('predictions')}>
              {APP_NAME.split(' ')[0]} <span className="text-primary font-bold">{APP_NAME.split(' ').slice(1).join(' ')}</span>
            </span>
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map(([key, , label]) => (
                <button
                  key={key}
                  onClick={() => onPageChange(key)}
                  className={`relative px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    page === key ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-dark hover:bg-bg'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div>
                <span className="text-text-muted">{t.nav.points}</span>{' '}
                <span className="font-semibold text-dark">{predictionPoints}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div>
                <span className="text-text-muted">{t.nav.tokens}</span>{' '}
                <span className={`font-semibold ${tokens === 0 ? 'text-text-muted' : 'text-dark'}`}>{fmtTokens(tokens)}</span>
              </div>
            </div>

            <div className="h-5 w-px bg-border hidden sm:block" />

            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={refreshing}
              title={t.nav.refresh}
              aria-label={t.nav.refresh}
              className="w-9 h-9 rounded-full border border-border bg-surface flex items-center justify-center hover:bg-bg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              <svg
                className={`w-4 h-4 text-text-muted ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.07 19a9 9 0 0014.93-3M18.93 5a9 9 0 00-14.93 3" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => toggleTheme()}
              className="w-9 h-9 rounded-full border border-border bg-surface text-lg flex items-center justify-center hover:bg-bg transition-colors cursor-pointer shrink-0"
              aria-label="Toggle theme"
            >
              <span className="dark:hidden">🌙</span>
              <span className="hidden dark:inline">☀️</span>
            </button>

            {isAdmin && (
              <button
                onClick={onToggleAdmin}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  showAdmin ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {t.nav.admin}
              </button>
            )}

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                {username[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-dark hidden sm:inline">{username}</span>
            </div>

            <button
              onClick={onLogout}
              className="text-text-muted hover:text-dark text-xs cursor-pointer transition-colors"
            >
              {t.nav.logout}
            </button>
          </div>
        </div>
      </header>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border flex items-center justify-around h-12">
        {navItems.map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => onPageChange(key)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 cursor-pointer transition-colors ${
              page === key ? 'text-primary' : 'text-text-muted'
            }`}
          >
            <span className="text-base">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
