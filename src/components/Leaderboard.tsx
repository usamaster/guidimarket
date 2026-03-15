interface LeaderEntry {
  username: string
  totalValue: number
}

interface LeaderboardProps {
  entries: LeaderEntry[]
}

export function Leaderboard({ entries }: LeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.totalValue - a.totalValue)

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-dark mb-3">Leaderboard</h3>
      <div className="space-y-2">
        {sorted.map((e, i) => (
          <div key={e.username} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs w-4 text-center font-bold ${i === 0 ? 'text-primary' : 'text-text-muted'}`}>{i + 1}</span>
              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                {e.username[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-medium text-dark">{e.username}</span>
            </div>
            <span className="text-xs font-semibold text-dark">{e.totalValue.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
