interface HeaderProps {
  currentUser: string
  onCreateBet: () => void
  onLogout: () => void
}

export function Header({ currentUser, onCreateBet, onLogout }: HeaderProps) {
  return (
    <header className="bg-surface border-b border-border sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <span className="text-[22px] font-medium tracking-tight text-dark">
            guidi<span className="text-primary font-bold">market</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCreateBet}
            className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer"
          >
            Create a Bet
          </button>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
              {currentUser[0]}
            </div>
            <span className="text-sm font-medium text-dark">{currentUser}</span>
            <button
              onClick={onLogout}
              className="text-text-muted hover:text-dark text-xs ml-1 cursor-pointer transition-colors"
            >
              (switch)
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
