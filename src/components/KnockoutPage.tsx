import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { t, fmtKickoff } from '../lib/i18n'
import type { AppState, Match, MatchPrediction, Profile, Team } from '../lib/database.types'
import { BOOSTS_PER_STAGE, KNOCKOUT_ROUND_ORDER, countBoostsByStage, knockoutAdvancer } from '../lib/scoring'
import { PrizePotBanner } from './PrizePotBanner'
import { StickySaveBar } from './StickySaveBar'
import { Flag } from './Flag'

interface KnockoutPageProps {
  userId: string
  profiles: Profile[]
  appState: AppState | null
  teams: Team[]
  matches: Match[]
  matchPredictions: MatchPrediction[]
  onSaved: () => void
}

interface KoDraft {
  team1_score: number | null
  team2_score: number | null
  advance_team_id: string | null
}

const EMPTY: KoDraft = { team1_score: null, team2_score: null, advance_team_id: null }

function buildOriginal(preds: MatchPrediction[]): Record<string, KoDraft> {
  const map: Record<string, KoDraft> = {}
  for (const p of preds) {
    map[p.match_id] = {
      team1_score: p.team1_score === null ? null : Number(p.team1_score),
      team2_score: p.team2_score === null ? null : Number(p.team2_score),
      advance_team_id: p.advance_team_id,
    }
  }
  return map
}

function isEqual(a: KoDraft, b: KoDraft) {
  return (a.team1_score === null ? null : Number(a.team1_score)) === (b.team1_score === null ? null : Number(b.team1_score))
    && (a.team2_score === null ? null : Number(a.team2_score)) === (b.team2_score === null ? null : Number(b.team2_score))
    && (a.advance_team_id || null) === (b.advance_team_id || null)
}

function mergeServer(server: Record<string, KoDraft>, current: Record<string, KoDraft>, prev: Record<string, KoDraft>): Record<string, KoDraft> {
  const next: Record<string, KoDraft> = { ...server }
  const ids = new Set([...Object.keys(current), ...Object.keys(prev)])
  for (const id of ids) {
    const cur = current[id] || EMPTY
    const before = prev[id] || EMPTY
    if (!isEqual(cur, before)) next[id] = cur
  }
  return next
}

interface MatchCardProps {
  match: Match
  teamsById: Map<string, Team>
  draft: KoDraft
  prediction: MatchPrediction | undefined
  boostsUsed: number
  busy: boolean
  now: number
  onChange: (next: KoDraft) => void
  onToggleBoost: (applied: boolean) => void
}

function MatchCard({ match, teamsById, draft, prediction, boostsUsed, busy, now, onChange, onToggleBoost }: MatchCardProps) {
  const team1 = match.team1_id ? teamsById.get(match.team1_id) || null : null
  const team2 = match.team2_id ? teamsById.get(match.team2_id) || null : null
  const teamsKnown = !!team1 && !!team2
  const kickedOff = new Date(match.kickoff_at).getTime() <= now
  const editable = teamsKnown && !kickedOff
  const finished = match.status === 'finished' && match.team1_score !== null && match.team2_score !== null

  const boostApplied = prediction?.boost_applied ?? false
  const poolFull = !boostApplied && boostsUsed >= BOOSTS_PER_STAGE
  const boostDisabled = busy || kickedOff || poolFull || !teamsKnown

  const earnedPts = prediction?.points_awarded ?? null
  const actualAdvancer = finished ? knockoutAdvancer(match) : null

  const handleScore = (slot: 'team1_score' | 'team2_score', raw: string) => {
    const n = raw === '' ? null : Math.max(0, Math.min(99, Number(raw)))
    onChange({ ...draft, [slot]: n })
  }

  const pickAdvance = (teamId: string) => {
    onChange({ ...draft, advance_team_id: draft.advance_team_id === teamId ? null : teamId })
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <p className="text-[10px] uppercase tracking-wide text-text-muted shrink-0">{fmtKickoff(match.kickoff_at)}</p>
          {match.ground && <span className="text-[11px] text-text-secondary truncate">{match.ground}</span>}
        </div>
        {finished && earnedPts !== null && (
          <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded shrink-0 ${
            earnedPts > 0 ? 'bg-yes-light text-yes' : 'bg-bg text-text-muted'
          }`}>
            {earnedPts} {t.nav.points} {t.predictions.earned}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
        <div className="flex items-center gap-1.5 justify-end min-w-0">
          <span className="text-sm font-medium text-dark truncate text-right">
            {team1?.name || match.team1_placeholder || '—'}
          </span>
          <Flag emoji={team1?.flag_emoji} className="inline-block w-4 h-4 shrink-0 align-[-0.15em]" />
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number" inputMode="numeric" min={0} max={20}
            value={draft.team1_score ?? ''}
            onChange={e => handleScore('team1_score', e.target.value)}
            disabled={!editable}
            className="w-11 bg-bg border border-border rounded-md px-2 py-1.5 text-sm text-dark text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          />
          <span className="text-text-muted text-xs">-</span>
          <input
            type="number" inputMode="numeric" min={0} max={20}
            value={draft.team2_score ?? ''}
            onChange={e => handleScore('team2_score', e.target.value)}
            disabled={!editable}
            className="w-11 bg-bg border border-border rounded-md px-2 py-1.5 text-sm text-dark text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag emoji={team2?.flag_emoji} className="inline-block w-4 h-4 shrink-0 align-[-0.15em]" />
          <span className="text-sm font-medium text-dark truncate">
            {team2?.name || match.team2_placeholder || '—'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleBoost(!boostApplied)}
          disabled={boostDisabled}
          title={kickedOff ? t.predictions.boostKickedOff : poolFull ? t.predictions.boostMaxReached : t.predictions.boostHint}
          className={`shrink-0 w-8 h-8 rounded-full text-base flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
            boostApplied ? 'bg-primary text-white shadow-sm' : 'bg-bg text-text-muted hover:text-primary hover:bg-primary/10'
          }`}
        >
          ⚡
        </button>
      </div>

      {!teamsKnown ? (
        <p className="text-[11px] text-text-muted">{t.knockout.teamsUnknownHint}</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wide text-text-muted shrink-0">{t.knockout.advance}</span>
          {[team1, team2].map(team => team && (
            <button
              key={team.id}
              type="button"
              onClick={() => pickAdvance(team.id)}
              disabled={!editable}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed ${
                draft.advance_team_id === team.id
                  ? 'bg-primary text-white'
                  : 'bg-bg text-text-muted hover:text-dark disabled:opacity-50'
              }`}
            >
              <Flag emoji={team.flag_emoji} className="inline-block w-3.5 h-3.5 align-[-0.15em]" />
              {team.name}
              {actualAdvancer === team.id && (
                <span className="text-[9px] uppercase tracking-wide opacity-80">{t.knockout.advancedTag}</span>
              )}
            </button>
          ))}
          {finished && actualAdvancer && draft.advance_team_id === actualAdvancer && (
            <span className="text-[10px] font-bold text-yes bg-yes-light px-2 py-0.5 rounded-full">{t.knockout.advanceCorrect}</span>
          )}
        </div>
      )}

      {finished && (
        <p className="text-[11px] text-text-muted">
          {t.knockout.finalScore}: {team1?.name} {match.team1_score} - {match.team2_score} {team2?.name}
        </p>
      )}
      {teamsKnown && kickedOff && !finished && (
        <p className="text-[11px] text-text-muted">{t.knockout.kickedOff}</p>
      )}
    </div>
  )
}

export function KnockoutPage({ userId, profiles, appState, teams, matches, matchPredictions, onSaved }: KnockoutPageProps) {
  const myPreds = useMemo(() => matchPredictions.filter(p => p.user_id === userId), [matchPredictions, userId])
  const [original, setOriginal] = useState<Record<string, KoDraft>>(() => buildOriginal(myPreds))
  const [draft, setDraft] = useState<Record<string, KoDraft>>(original)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [boostBusyId, setBoostBusyId] = useState<string | null>(null)
  const [boostError, setBoostError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const originalRef = useRef(original)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const server = buildOriginal(myPreds)
    const prev = originalRef.current
    originalRef.current = server
    setOriginal(server)
    setDraft(cur => mergeServer(server, cur, prev))
  }, [myPreds])

  const teamsById = useMemo(() => {
    const m = new Map<string, Team>()
    for (const team of teams) m.set(team.id, team)
    return m
  }, [teams])

  const knockoutMatches = useMemo(
    () => matches.filter(m => m.stage === 'knockout'),
    [matches],
  )

  const matchesByRound = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const round of KNOCKOUT_ROUND_ORDER) map.set(round, [])
    for (const m of knockoutMatches) {
      if (!map.has(m.round)) map.set(m.round, [])
      map.get(m.round)!.push(m)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    }
    return map
  }, [knockoutMatches])

  const predById = useMemo(() => {
    const m = new Map<string, MatchPrediction>()
    for (const p of myPreds) m.set(p.match_id, p)
    return m
  }, [myPreds])

  const boostsUsed = useMemo(() => countBoostsByStage(myPreds, matches).knockout, [myPreds, matches])

  const dirtyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const id of Object.keys(draft)) {
      if (!isEqual(draft[id], original[id] || EMPTY)) ids.add(id)
    }
    for (const id of Object.keys(original)) {
      if (!(id in draft) && !isEqual(EMPTY, original[id])) ids.add(id)
    }
    return [...ids]
  }, [draft, original])

  const setMatch = (matchId: string, next: KoDraft) => {
    setDraft(d => ({ ...d, [matchId]: next }))
    setError(null)
  }

  const handleDiscard = () => {
    setDraft(original)
    setError(null)
  }

  const handleToggleBoost = async (matchId: string, applied: boolean) => {
    if (boostBusyId) return
    setBoostBusyId(matchId)
    setBoostError(null)
    const { error: rpcErr } = await supabase.rpc('apply_boost', { p_match_id: matchId, p_applied: applied })
    if (rpcErr) setBoostError(rpcErr.message)
    onSaved()
    setBoostBusyId(null)
  }

  const handleSave = async () => {
    if (saving || dirtyIds.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const rows = dirtyIds.map(id => {
        const v = draft[id] || EMPTY
        return {
          user_id: userId,
          match_id: id,
          team1_score: v.team1_score,
          team2_score: v.team2_score,
          advance_team_id: v.advance_team_id,
          updated_at: new Date().toISOString(),
        }
      })
      const { error: mErr } = await supabase
        .from('match_predictions')
        .upsert(rows as Record<string, unknown>[], { onConflict: 'user_id,match_id' })
      if (mErr) throw mErr
      originalRef.current = draft
      setOriginal(draft)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.predictions.saveError)
    } finally {
      setSaving(false)
    }
  }

  const visibleRounds = KNOCKOUT_ROUND_ORDER.filter(round => (matchesByRound.get(round) || []).length > 0)
  const anyTeamsKnown = knockoutMatches.some(m => m.team1_id && m.team2_id)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-32 flex flex-col gap-6">
      <PrizePotBanner profiles={profiles} appState={appState} currentUserId={userId} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-dark">{t.knockout.pageTitle}</h1>
        <p className="text-sm text-text-secondary mt-1">{t.knockout.pageSubtitle}</p>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl shrink-0">🏆</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-secondary">{t.knockout.intro}</p>
          <p className="text-xs text-text-muted mt-1">{t.knockout.advanceHint}</p>
        </div>
        <span className="text-[11px] text-text-muted shrink-0 whitespace-nowrap">
          ⚡ {boostsUsed} / {BOOSTS_PER_STAGE}
        </span>
      </div>

      {boostError && (
        <p className="text-[11px] text-no bg-no-light border border-no/20 rounded px-2 py-1">{boostError}</p>
      )}

      {!anyTeamsKnown && (
        <p className="text-sm text-text-muted bg-card border border-border rounded-xl p-6 text-center">
          {t.knockout.notStartedYet}
        </p>
      )}

      {visibleRounds.map(round => {
        const list = matchesByRound.get(round) || []
        const allUnknown = list.every(m => !m.team1_id || !m.team2_id)
        return (
          <section key={round} className="bg-card border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 className="text-base font-bold text-dark">{round}</h2>
              {allUnknown && <span className="text-[11px] text-text-muted">{t.knockout.teamsUnknown}</span>}
            </div>
            <div className="flex flex-col divide-y divide-border">
              {list.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  teamsById={teamsById}
                  draft={draft[match.id] || EMPTY}
                  prediction={predById.get(match.id)}
                  boostsUsed={boostsUsed}
                  busy={boostBusyId === match.id}
                  now={now}
                  onChange={next => setMatch(match.id, next)}
                  onToggleBoost={applied => handleToggleBoost(match.id, applied)}
                />
              ))}
            </div>
          </section>
        )
      })}

      <StickySaveBar dirtyCount={dirtyIds.length} saving={saving} error={error} onSave={handleSave} onDiscard={handleDiscard} />
    </div>
  )
}
