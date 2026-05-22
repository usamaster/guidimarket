import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { t, fmtTokens } from '../lib/i18n'
import type { AppState, Profile, SideBet, Team, TournamentResult } from '../lib/database.types'

interface AdminPanelProps {
  profiles: Profile[]
  appState: AppState | null
  sideBets: SideBet[]
  teams: Team[]
  tournamentResults: TournamentResult[]
  onChanged: () => void
}

type ResultValueKind = 'team' | 'player' | 'number' | 'bool'

interface ResultDef {
  type: string
  label: string
  kind: ResultValueKind
}

const RESULT_DEFS: ResultDef[] = [
  { type: 'winner', label: t.predictions.winner, kind: 'team' },
  { type: 'runner_up', label: t.predictions.runnerUp, kind: 'team' },
  { type: 'third', label: t.predictions.third, kind: 'team' },
  { type: 'fourth', label: t.predictions.fourth, kind: 'team' },
  { type: 'top_scorer', label: t.predictions.topScorer, kind: 'player' },
  { type: 'golden_ball', label: t.predictions.goldenBall, kind: 'player' },
  { type: 'young_player', label: t.predictions.youngPlayer, kind: 'player' },
  { type: 'golden_glove', label: t.predictions.goldenGlove, kind: 'player' },
  { type: 'total_goals', label: t.predictions.totalGoals, kind: 'number' },
  { type: 'total_red_cards', label: t.predictions.totalRedCards, kind: 'number' },
  { type: 'total_yellow_cards', label: t.predictions.totalYellowCards, kind: 'number' },
  { type: 'total_penalties', label: t.predictions.totalPenalties, kind: 'number' },
  { type: 'highest_match_goals', label: t.predictions.highestMatchGoals, kind: 'number' },
  { type: 'host_reaches_qf', label: t.predictions.hostReachesQf, kind: 'bool' },
  { type: 'undefeated_team_exists', label: t.predictions.undefeatedTeam, kind: 'bool' },
  { type: 'any_zero_zero', label: t.predictions.anyZeroZero, kind: 'bool' },
  { type: 'final_goes_to_et', label: t.predictions.finalGoesToEt, kind: 'bool' },
  { type: 'hat_trick_scored', label: t.predictions.hatTrickScored, kind: 'bool' },
]

export function AdminPanel({ profiles, appState, sideBets, teams, tournamentResults, onChanged }: AdminPanelProps) {
  const [topupUser, setTopupUser] = useState('')
  const [topupAmount, setTopupAmount] = useState<number>(100)
  const [paidUser, setPaidUser] = useState('')
  const [paidValue, setPaidValue] = useState<'true' | 'false'>('true')
  const [winnerUser, setWinnerUser] = useState(appState?.main_winner_user_id || '')
  const [pointsUser, setPointsUser] = useState('')
  const [pointsValue, setPointsValue] = useState<number>(0)
  const [resolveBetId, setResolveBetId] = useState('')
  const [resolveOutcome, setResolveOutcome] = useState<'proposer' | 'opponent' | 'push'>('proposer')
  const [resultType, setResultType] = useState<string>('winner')
  const [resultTeamId, setResultTeamId] = useState<string>('')
  const [resultPlayerName, setResultPlayerName] = useState<string>('')
  const [resultNumber, setResultNumber] = useState<string>('')
  const [resultBool, setResultBool] = useState<'true' | 'false'>('true')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const acceptedBets = sideBets.filter(b => b.status === 'accepted')

  const resultsByType = useMemo(() => {
    const m = new Map<string, TournamentResult>()
    for (const r of tournamentResults) m.set(r.prediction_type, r)
    return m
  }, [tournamentResults])

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams])
  const currentDef = RESULT_DEFS.find(d => d.type === resultType) || RESULT_DEFS[0]

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true); setError(null); setSuccess(null)
    const { error: e } = await fn()
    if (e) setError(e.message)
    else { setSuccess('OK'); onChanged() }
    setBusy(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-dark">{t.admin.title}</h1>

      {error && <div className="bg-no-light border border-no/20 text-no rounded-lg px-3 py-2 text-sm">{error}</div>}
      {success && <div className="bg-yes-light border border-yes/20 text-yes rounded-lg px-3 py-2 text-sm">{success}</div>}

      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-bold text-dark mb-3">{t.admin.topupTokens}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={topupUser} onChange={e => setTopupUser(e.target.value)} className="bg-bg border border-border rounded-md px-2 py-2 text-sm">
            <option value="">{t.admin.selectPlayer}</option>
            {profiles.map(p => (
              <option key={p.user_id} value={p.user_id}>{p.display_name || '—'} ({fmtTokens(p.tokens)})</option>
            ))}
          </select>
          <input
            type="number"
            value={topupAmount}
            onChange={e => setTopupAmount(Number(e.target.value))}
            placeholder={t.admin.amount}
            className="bg-bg border border-border rounded-md px-2 py-2 text-sm"
          />
          <button
            disabled={busy || !topupUser}
            onClick={() => run(() => supabase.rpc('admin_topup_tokens', { p_user_id: topupUser, p_amount: topupAmount }))}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer"
          >
            {t.admin.add}
          </button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-bold text-dark mb-3">{t.admin.setPaidIn}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={paidUser} onChange={e => setPaidUser(e.target.value)} className="bg-bg border border-border rounded-md px-2 py-2 text-sm">
            <option value="">{t.admin.selectPlayer}</option>
            {profiles.map(p => (
              <option key={p.user_id} value={p.user_id}>{p.display_name || '—'} ({p.paid_in ? t.admin.paid : t.admin.notPaid})</option>
            ))}
          </select>
          <select value={paidValue} onChange={e => setPaidValue(e.target.value as 'true' | 'false')} className="bg-bg border border-border rounded-md px-2 py-2 text-sm">
            <option value="true">{t.admin.paid}</option>
            <option value="false">{t.admin.notPaid}</option>
          </select>
          <button
            disabled={busy || !paidUser}
            onClick={() => run(() => supabase.rpc('admin_set_paid_in', { p_user_id: paidUser, p_paid: paidValue === 'true' }))}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer"
          >
            {t.admin.apply}
          </button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-bold text-dark mb-3">{t.admin.setPredictionPoints}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={pointsUser} onChange={e => setPointsUser(e.target.value)} className="bg-bg border border-border rounded-md px-2 py-2 text-sm">
            <option value="">{t.admin.selectPlayer}</option>
            {profiles.map(p => (
              <option key={p.user_id} value={p.user_id}>{p.display_name || '—'} ({p.prediction_points} {t.nav.points})</option>
            ))}
          </select>
          <input
            type="number"
            value={pointsValue}
            onChange={e => setPointsValue(Number(e.target.value))}
            placeholder={t.admin.amount}
            className="bg-bg border border-border rounded-md px-2 py-2 text-sm"
          />
          <button
            disabled={busy || !pointsUser}
            onClick={() => run(() => supabase.rpc('admin_set_prediction_points', { p_user_id: pointsUser, p_points: pointsValue }))}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer"
          >
            {t.admin.save}
          </button>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-bold text-dark mb-3">{t.admin.setMainWinner}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={winnerUser} onChange={e => setWinnerUser(e.target.value)} className="bg-bg border border-border rounded-md px-2 py-2 text-sm sm:col-span-2">
            <option value="">{t.admin.clearWinner}</option>
            {profiles.map(p => (
              <option key={p.user_id} value={p.user_id}>{p.display_name || '—'}</option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={() => run(() => supabase.rpc('admin_set_main_winner', { p_user_id: winnerUser || null }))}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer"
          >
            {t.admin.apply}
          </button>
        </div>
      </section>

      <section className={`border rounded-xl p-4 ${appState?.predictions_locked ? 'bg-no-light/40 border-no/30' : 'bg-card border-border'}`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-bold text-dark">{t.admin.lockTitle}</h2>
          <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full ${
            appState?.predictions_locked
              ? 'bg-no text-white'
              : 'bg-yes-light text-yes border border-yes/20'
          }`}>
            {appState?.predictions_locked ? t.admin.locked : t.admin.unlocked}
          </span>
        </div>
        <p className="text-xs text-text-muted mb-3">{t.admin.lockHint}</p>
        <button
          disabled={busy}
          onClick={() => {
            const nextLock = !appState?.predictions_locked
            const confirmMsg = nextLock ? t.admin.lockConfirmClose : t.admin.lockConfirmOpen
            if (!window.confirm(confirmMsg)) return
            run(() => supabase.rpc('admin_lock_predictions', { p_locked: nextLock }))
          }}
          className={`text-sm font-semibold px-4 py-2 rounded-full cursor-pointer text-white disabled:opacity-50 ${
            appState?.predictions_locked
              ? 'bg-yes hover:bg-yes/90'
              : 'bg-no hover:bg-no/90'
          }`}
        >
          {appState?.predictions_locked ? t.admin.lockOpen : t.admin.lockClose}
        </button>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-bold text-dark mb-1">{t.admin.recomputeScores}</h2>
        <p className="text-xs text-text-muted mb-3">{t.admin.recomputeHint}</p>
        <button
          disabled={busy}
          onClick={() => run(() => supabase.rpc('score_predictions'))}
          className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer"
        >
          {busy ? t.admin.recomputing : t.admin.recomputeScores}
        </button>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-bold text-dark mb-3">{t.admin.setTournamentResult}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={resultType}
            onChange={e => {
              setResultType(e.target.value)
              const existing = resultsByType.get(e.target.value)
              setResultTeamId(existing?.team_id || '')
              setResultPlayerName(existing?.string_value || '')
              setResultNumber(existing?.number_value === null || existing?.number_value === undefined ? '' : String(existing.number_value))
              setResultBool(existing?.bool_value === false ? 'false' : 'true')
            }}
            className="bg-bg border border-border rounded-md px-2 py-2 text-sm"
          >
            {RESULT_DEFS.map(d => {
              const set = resultsByType.has(d.type) ? ' ✓' : ''
              return <option key={d.type} value={d.type}>{d.label}{set}</option>
            })}
          </select>

          {currentDef.kind === 'team' && (
            <select value={resultTeamId} onChange={e => setResultTeamId(e.target.value)} className="bg-bg border border-border rounded-md px-2 py-2 text-sm">
              <option value="">—</option>
              {sortedTeams.map(team => (
                <option key={team.id} value={team.id}>{team.flag_emoji ? `${team.flag_emoji} ` : ''}{team.name}</option>
              ))}
            </select>
          )}
          {currentDef.kind === 'player' && (
            <input
              type="text"
              value={resultPlayerName}
              onChange={e => setResultPlayerName(e.target.value)}
              placeholder={t.admin.valueTypePlayer}
              className="bg-bg border border-border rounded-md px-2 py-2 text-sm"
            />
          )}
          {currentDef.kind === 'number' && (
            <input
              type="number"
              inputMode="numeric"
              value={resultNumber}
              onChange={e => setResultNumber(e.target.value)}
              placeholder={t.admin.valueTypeNumber}
              className="bg-bg border border-border rounded-md px-2 py-2 text-sm"
            />
          )}
          {currentDef.kind === 'bool' && (
            <select value={resultBool} onChange={e => setResultBool(e.target.value as 'true' | 'false')} className="bg-bg border border-border rounded-md px-2 py-2 text-sm">
              <option value="true">{t.predictions.yes}</option>
              <option value="false">{t.predictions.no}</option>
            </select>
          )}

          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => run(() => supabase.rpc('admin_set_tournament_result', {
                p_type: resultType,
                p_team_id: currentDef.kind === 'team' ? (resultTeamId || null) : null,
                p_string: currentDef.kind === 'player' ? (resultPlayerName.trim() || null) : null,
                p_number: currentDef.kind === 'number' ? (resultNumber === '' ? null : Number(resultNumber)) : null,
                p_bool: currentDef.kind === 'bool' ? resultBool === 'true' : null,
              }))}
              className="flex-1 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer"
            >
              {t.admin.save}
            </button>
            <button
              disabled={busy || !resultsByType.has(resultType)}
              onClick={() => run(() => supabase.rpc('admin_clear_tournament_result', { p_type: resultType }))}
              className="bg-bg border border-border hover:border-no/40 disabled:opacity-30 text-text-secondary text-xs font-semibold px-3 py-2 rounded-full cursor-pointer"
            >
              {t.admin.clearResult}
            </button>
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-bold text-dark mb-3">{t.admin.resolveBet}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={resolveBetId} onChange={e => setResolveBetId(e.target.value)} className="bg-bg border border-border rounded-md px-2 py-2 text-sm">
            <option value="">{t.admin.selectBet}</option>
            {acceptedBets.map(b => (
              <option key={b.id} value={b.id}>
                {b.proposer_name} ({b.proposer_side}) vs {b.opponent_name || '—'} ({b.opponent_side})
              </option>
            ))}
          </select>
          <select value={resolveOutcome} onChange={e => setResolveOutcome(e.target.value as 'proposer' | 'opponent' | 'push')} className="bg-bg border border-border rounded-md px-2 py-2 text-sm">
            <option value="proposer">{t.admin.proposerWins}</option>
            <option value="opponent">{t.admin.opponentWins}</option>
            <option value="push">{t.admin.push}</option>
          </select>
          <button
            disabled={busy || !resolveBetId}
            onClick={() => run(() => supabase.rpc('resolve_side_bet', { p_bet_id: resolveBetId, p_outcome: resolveOutcome }))}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-full cursor-pointer"
          >
            {t.admin.apply}
          </button>
        </div>
      </section>
    </div>
  )
}
