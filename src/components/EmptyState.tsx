interface EmptyStateProps {
  onCreateBet: () => void
}

export function EmptyState({ onCreateBet }: EmptyStateProps) {
  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8503A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-dark mb-1">No markets yet</h2>
      <p className="text-text-secondary text-sm mb-6 max-w-xs mx-auto">
        Create the first bet and challenge your team.
      </p>
      <button
        onClick={onCreateBet}
        className="bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-2.5 rounded-full transition-colors cursor-pointer text-sm"
      >
        Create a Bet
      </button>
    </div>
  )
}
