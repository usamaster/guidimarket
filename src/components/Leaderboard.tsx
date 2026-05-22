import type { Profile } from '../lib/database.types'
import { t, fmtTokens } from '../lib/i18n'

interface LeaderboardProps {
  profiles: Profile[]
  currentUserId: string
}

interface ColumnProps {
  title: string
  hint: string
  rows: Profile[]
  metric: 'points' | 'tokens'
  metricLabel: string
  currentUserId: string
  showPaidBadge?: boolean
}

function Column({ title, hint, rows, metric, metricLabel, currentUserId, showPaidBadge }: ColumnProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex-1">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-bold text-dark">{title}</h2>
        <p className="text-[11px] text-text-muted mt-0.5">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-xs text-text-muted text-center">—</p>
      ) : (
        <ol>
          {rows.map((p, i) => {
            const value = metric === 'points' ? p.prediction_points : Number(p.tokens)
            const isMe = p.user_id === currentUserId
            return (
              <li
                key={p.user_id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 ${isMe ? 'bg-primary/5' : ''}`}
              >
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  i === 0 ? 'bg-primary text-white' : i < 3 ? 'bg-primary/15 text-primary' : 'bg-bg text-text-secondary'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark truncate">
                    {p.display_name || '—'}
                    {isMe && <span className="ml-1.5 text-[10px] uppercase font-bold text-primary">{t.leaderboard.youTag}</span>}
                  </p>
                  {showPaidBadge && (
                    <p className={`text-[10px] mt-0.5 font-semibold ${p.paid_in ? 'text-yes' : 'text-no'}`}>
                      {p.paid_in ? t.leaderboard.paid : t.leaderboard.notPaid}
                    </p>
                  )}
                </div>
                <span className="text-sm font-semibold text-dark shrink-0">
                  {metric === 'tokens' ? fmtTokens(value) : value} <span className="text-[10px] text-text-muted font-normal">{metricLabel}</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

export function Leaderboard({ profiles, currentUserId }: LeaderboardProps) {
  const byPoints = [...profiles].sort((a, b) => b.prediction_points - a.prediction_points || (b.paid_in ? 1 : 0) - (a.paid_in ? 1 : 0))
  const byTokens = [...profiles].sort((a, b) => Number(b.tokens) - Number(a.tokens))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-dark">{t.leaderboard.pageTitle}</h1>
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        <Column
          title={t.leaderboard.mainPool}
          hint={t.leaderboard.mainPoolHint}
          rows={byPoints}
          metric="points"
          metricLabel={t.nav.points}
          currentUserId={currentUserId}
          showPaidBadge
        />
        <Column
          title={t.leaderboard.tokensCol}
          hint={t.leaderboard.tokensColHint}
          rows={byTokens}
          metric="tokens"
          metricLabel={t.nav.tokens}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  )
}
