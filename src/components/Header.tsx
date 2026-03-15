interface HeaderProps {
  credits: number
  portfolioValue: number
  username: string
  isAdmin: boolean
  showAdmin: boolean
  page: string
  onPageChange: (page: string) => void
  onToggleAdmin: () => void
  onLogout: () => void
}

export function Header({ credits, portfolioValue, username, isAdmin, showAdmin, page, onPageChange, onToggleAdmin, onLogout }: HeaderProps) {
  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <span className="text-[22px] font-medium tracking-tight text-dark cursor-pointer" onClick={() => onPageChange('market')}>
            Landalf<span className="text-primary font-bold">Stock Market</span>
          </span>
          <nav className="hidden sm:flex items-center gap-1">
            {([['market', 'Market'], ['tradelog', 'Trade Log']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => onPageChange(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
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
              <span className="text-text-muted">Credits</span>{' '}
              <span className="font-semibold text-dark">{credits.toFixed(2)}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div>
              <span className="text-text-muted">Portfolio</span>{' '}
              <span className="font-semibold text-dark">{portfolioValue.toFixed(2)}</span>
            </div>
          </div>

          <div className="h-5 w-px bg-border" />

          {isAdmin && (
            <button
              onClick={onToggleAdmin}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                showAdmin
                  ? 'bg-primary text-white'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              Admin
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
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
