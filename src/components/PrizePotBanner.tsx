import type { Profile, AppState } from '../lib/database.types'
import { t, fmtEur } from '../lib/i18n'
import { BUYIN_EUR } from '../lib/constants'

interface PrizePotBannerProps {
  profiles: Profile[]
  appState: AppState | null
  currentUserId: string
}

export function PrizePotBanner({ profiles, appState, currentUserId }: PrizePotBannerProps) {
  const buyin = appState?.buyin_eur ?? BUYIN_EUR
  const paidCount = profiles.filter(p => p.paid_in).length
  const potEur = paidCount * Number(buyin)

  const ranked = [...profiles].sort((a, b) => b.prediction_points - a.prediction_points)
  const top3 = ranked.slice(0, 3)
  const winner = appState?.main_winner_user_id ? profiles.find(p => p.user_id === appState.main_winner_user_id) : null
  const leader = !winner && ranked.length > 0 && ranked[0].prediction_points > 0 ? ranked[0] : null

  return (
    <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">{t.prizepot.title}</p>
          <p className="mt-1 text-3xl sm:text-4xl font-bold text-dark tracking-tight">{fmtEur(potEur)}</p>
          <p className="mt-1 text-xs text-text-muted">
            {paidCount} × {fmtEur(buyin)} {t.prizepot.paidIn}
          </p>
        </div>
        <div className="text-right">
          {winner ? (
            <div className="bg-yes-light border border-yes/30 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase font-bold tracking-wide text-yes">{t.prizepot.winner}</p>
              <p className="text-sm font-semibold text-yes mt-0.5">{winner.display_name || '—'}</p>
            </div>
          ) : leader ? (
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase font-bold tracking-wide text-primary">{t.prizepot.leader}</p>
              <p className="text-sm font-semibold text-primary mt-0.5">{leader.display_name || '—'}</p>
              <p className="text-[11px] text-primary/80">{leader.prediction_points} {t.nav.points}</p>
            </div>
          ) : (
            <div className="bg-bg border border-border rounded-lg px-3 py-2">
              <p className="text-[11px] text-text-muted">{t.prizepot.nobodyPredicting}</p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-text-secondary">{t.prizepot.subtitle}</p>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-[11px] uppercase font-bold tracking-wide text-text-muted mb-2">{t.prizepot.top3}</p>
        {top3.length === 0 ? (
          <p className="text-xs text-text-muted">{t.prizepot.nobodyPredicting}</p>
        ) : (
          <ol className="space-y-1.5">
            {top3.map((p, i) => {
              const isWinner = winner && winner.user_id === p.user_id
              const isLeader = !winner && i === 0 && p.prediction_points > 0
              return (
                <li
                  key={p.user_id}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg ${
                    isWinner ? 'bg-yes-light' : isLeader ? 'bg-primary/5' : 'bg-bg'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      i === 0 ? 'bg-primary text-white' : 'bg-border text-text-secondary'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-dark truncate">
                      {p.display_name || '—'}
                      {p.user_id === currentUserId && (
                        <span className="ml-1.5 text-[10px] uppercase font-bold text-primary">{t.leaderboard.youTag}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-text-secondary">{p.prediction_points} {t.nav.points}</span>
                    {i === 0 && <span className="text-xs font-semibold text-dark">{fmtEur(potEur)}</span>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
