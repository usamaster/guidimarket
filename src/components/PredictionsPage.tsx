import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'
import { GROUP_LETTERS, type GroupLetter } from '../lib/constants'
import type {
  AppState,
  Match,
  MatchPrediction,
  PredictionType,
  Profile,
  Team,
  TournamentPrediction,
} from '../lib/database.types'
import { GroupMatchesSection, type MatchScoreDraft } from './GroupMatchesSection'
import { PrizePotBanner } from './PrizePotBanner'
import { StickySaveBar } from './StickySaveBar'
import { ScoringLegend } from './ScoringLegend'
import { countBoostsByStage } from '../lib/scoring'

interface PredictionsPageProps {
  userId: string
  profiles: Profile[]
  appState: AppState | null
  teams: Team[]
  matches: Match[]
  tournamentPredictions: TournamentPrediction[]
  matchPredictions: MatchPrediction[]
  onSaved: () => void
  onSwitchToOthers?: () => void
}

interface TournamentDraft {
  team_id: string | null
  string_value: string | null
  number_value: number | null
  bool_value: boolean | null
}

type Draft = {
  matches: Record<string, MatchScoreDraft>
  tournament: Record<string, TournamentDraft>
}

const EMPTY_MATCH: MatchScoreDraft = { team1_score: null, team2_score: null }
const EMPTY_TOURNAMENT: TournamentDraft = { team_id: null, string_value: null, number_value: null, bool_value: null }

const TEAM_FIELDS: ReadonlyArray<{ type: PredictionType; label: string }> = [
  { type: 'winner', label: t.predictions.winner },
  { type: 'runner_up', label: t.predictions.runnerUp },
  { type: 'third', label: t.predictions.third },
  { type: 'fourth', label: t.predictions.fourth },
] as const

const PLAYER_FIELDS: ReadonlyArray<{ type: PredictionType; label: string }> = [
  { type: 'top_scorer', label: t.predictions.topScorer },
  { type: 'golden_ball', label: t.predictions.goldenBall },
  { type: 'young_player', label: t.predictions.youngPlayer },
  { type: 'golden_glove', label: t.predictions.goldenGlove },
] as const

const NUMBER_FIELDS: ReadonlyArray<{ type: PredictionType; label: string }> = [
  { type: 'total_goals', label: t.predictions.totalGoals },
  { type: 'total_red_cards', label: t.predictions.totalRedCards },
  { type: 'total_yellow_cards', label: t.predictions.totalYellowCards },
  { type: 'total_penalties', label: t.predictions.totalPenalties },
  { type: 'highest_match_goals', label: t.predictions.highestMatchGoals },
] as const

const BOOL_FIELDS: ReadonlyArray<{ type: PredictionType; label: string }> = [
  { type: 'host_reaches_qf', label: t.predictions.hostReachesQf },
  { type: 'undefeated_team_exists', label: t.predictions.undefeatedTeam },
  { type: 'any_zero_zero', label: t.predictions.anyZeroZero },
  { type: 'final_goes_to_et', label: t.predictions.finalGoesToEt },
  { type: 'hat_trick_scored', label: t.predictions.hatTrickScored },
] as const

function buildOriginal(matchPreds: MatchPrediction[], tournament: TournamentPrediction[]): Draft {
  const ms: Record<string, MatchScoreDraft> = {}
  for (const p of matchPreds) {
    ms[p.match_id] = {
      team1_score: p.team1_score === null ? null : Number(p.team1_score),
      team2_score: p.team2_score === null ? null : Number(p.team2_score),
    }
  }

  const tp: Record<string, TournamentDraft> = {}
  for (const p of tournament) {
    tp[p.prediction_type] = {
      team_id: p.team_id,
      string_value: p.string_value,
      number_value: p.number_value === null ? null : Number(p.number_value),
      bool_value: p.bool_value,
    }
  }
  return { matches: ms, tournament: tp }
}

function getMatch(draft: Draft, id: string): MatchScoreDraft {
  return draft.matches[id] || EMPTY_MATCH
}

function getTournament(draft: Draft, type: PredictionType): TournamentDraft {
  return draft.tournament[type] || EMPTY_TOURNAMENT
}

function isMatchEqual(a: MatchScoreDraft, b: MatchScoreDraft) {
  return (a.team1_score === null ? null : Number(a.team1_score)) === (b.team1_score === null ? null : Number(b.team1_score))
    && (a.team2_score === null ? null : Number(a.team2_score)) === (b.team2_score === null ? null : Number(b.team2_score))
}

function isTournamentEqual(a: TournamentDraft, b: TournamentDraft) {
  return a.team_id === b.team_id
    && (a.string_value || '') === (b.string_value || '')
    && (a.number_value === null ? null : Number(a.number_value)) === (b.number_value === null ? null : Number(b.number_value))
    && a.bool_value === b.bool_value
}

export function PredictionsPage({
  userId, profiles, appState, teams, matches, tournamentPredictions, matchPredictions, onSaved, onSwitchToOthers,
}: PredictionsPageProps) {
  const locked = appState?.predictions_locked ?? false
  const myMatchPreds = useMemo(() => matchPredictions.filter(p => p.user_id === userId), [matchPredictions, userId])
  const myTournamentPreds = useMemo(() => tournamentPredictions.filter(p => p.user_id === userId), [tournamentPredictions, userId])
  const [original, setOriginal] = useState<Draft>(() => buildOriginal(myMatchPreds, myTournamentPreds))
  const [draft, setDraft] = useState<Draft>(original)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [boostBusyId, setBoostBusyId] = useState<string | null>(null)
  const [boostError, setBoostError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const next = buildOriginal(myMatchPreds, myTournamentPreds)
    setOriginal(next)
    setDraft(next)
  }, [myMatchPreds, myTournamentPreds])

  const matchesByGroup = useMemo(() => {
    const map = {} as Record<GroupLetter, Match[]>
    for (const letter of GROUP_LETTERS) map[letter] = []
    for (const m of matches) {
      if (m.stage !== 'group' || !m.group_letter) continue
      if (GROUP_LETTERS.includes(m.group_letter as GroupLetter)) {
        map[m.group_letter as GroupLetter].push(m)
      }
    }
    for (const letter of GROUP_LETTERS) {
      map[letter].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
    }
    return map
  }, [matches])

  const teamsByGroup = useMemo(() => {
    const map = {} as Record<GroupLetter, Team[]>
    for (const letter of GROUP_LETTERS) map[letter] = []
    for (const team of teams) {
      if (team.group_letter && GROUP_LETTERS.includes(team.group_letter as GroupLetter)) {
        map[team.group_letter as GroupLetter].push(team)
      }
    }
    for (const letter of GROUP_LETTERS) map[letter].sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [teams])

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams])
  const boostsByStage = useMemo(() => countBoostsByStage(myMatchPreds, matches), [myMatchPreds, matches])

  const dirtyMatchIds = useMemo(() => {
    const ids = new Set<string>()
    for (const id of Object.keys(draft.matches)) {
      if (!isMatchEqual(draft.matches[id], original.matches[id] || EMPTY_MATCH)) ids.add(id)
    }
    for (const id of Object.keys(original.matches)) {
      if (!(id in draft.matches) && !isMatchEqual(EMPTY_MATCH, original.matches[id])) ids.add(id)
    }
    return [...ids]
  }, [draft, original])

  const dirtyTournamentKeys = useMemo(() => {
    const allTypes = [...TEAM_FIELDS, ...PLAYER_FIELDS, ...NUMBER_FIELDS, ...BOOL_FIELDS].map(f => f.type)
    return allTypes.filter(type => !isTournamentEqual(getTournament(draft, type), getTournament(original, type)))
  }, [draft, original])

  const dirtyCount = dirtyMatchIds.length + dirtyTournamentKeys.length

  const tournamentPointsByType = useMemo(() => {
    const map = new Map<string, { points: number | null; resolved: boolean }>()
    for (const p of myTournamentPreds) {
      map.set(p.prediction_type, { points: p.points_awarded, resolved: p.resolved })
    }
    return map
  }, [myTournamentPreds])

  const setMatchScore = (matchId: string, next: MatchScoreDraft) => {
    setDraft(d => ({ ...d, matches: { ...d.matches, [matchId]: next } }))
    setJustSaved(false)
    setError(null)
  }

  const setTournament = (type: PredictionType, patch: Partial<TournamentDraft>) => {
    setDraft(d => ({
      ...d,
      tournament: { ...d.tournament, [type]: { ...getTournament(d, type), ...patch } },
    }))
    setJustSaved(false)
    setError(null)
  }

  const handleToggleBoost = async (matchId: string, applied: boolean) => {
    if (boostBusyId || locked) return
    setBoostBusyId(matchId)
    setBoostError(null)
    const { error: rpcErr } = await supabase.rpc('apply_boost', { p_match_id: matchId, p_applied: applied })
    if (rpcErr) setBoostError(rpcErr.message)
    onSaved()
    setBoostBusyId(null)
  }

  const handleSave = async () => {
    if (saving || dirtyCount === 0 || locked) return
    setSaving(true)
    setError(null)
    try {
      if (dirtyMatchIds.length > 0) {
        const rows = dirtyMatchIds.map(id => {
          const v = getMatch(draft, id)
          return {
            user_id: userId,
            match_id: id,
            team1_score: v.team1_score,
            team2_score: v.team2_score,
            updated_at: new Date().toISOString(),
          }
        })
        const { error: mErr } = await supabase
          .from('match_predictions')
          .upsert(rows as Record<string, unknown>[], { onConflict: 'user_id,match_id' })
        if (mErr) throw mErr
      }

      if (dirtyTournamentKeys.length > 0) {
        const rows = dirtyTournamentKeys.map(type => {
          const v = getTournament(draft, type)
          return {
            user_id: userId,
            prediction_type: type,
            round_locked: 'pre_tournament',
            team_id: v.team_id,
            string_value: v.string_value,
            number_value: v.number_value,
            bool_value: v.bool_value,
            updated_at: new Date().toISOString(),
          }
        })
        const { error: tErr } = await supabase
          .from('tournament_predictions')
          .upsert(rows as Record<string, unknown>[], { onConflict: 'user_id,prediction_type,round_locked' })
        if (tErr) throw tErr
      }

      setOriginal(draft)
      setJustSaved(true)
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.predictions.saveError
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const renderEarnedBadge = (type: PredictionType) => {
    const entry = tournamentPointsByType.get(type)
    if (!entry || !entry.resolved || entry.points === null) return null
    return (
      <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded shrink-0 ${
        entry.points > 0 ? 'bg-yes-light text-yes' : 'bg-bg text-text-muted'
      }`}>
        {entry.points} {t.nav.points} {t.predictions.earned}
      </span>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-32 flex flex-col gap-8">
      <PrizePotBanner profiles={profiles} appState={appState} currentUserId={userId} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-dark">{t.predictions.pageTitle}</h1>
        <p className="text-sm text-text-secondary mt-1">{t.predictions.pageSubtitle}</p>
        {justSaved && dirtyCount === 0 && !locked && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-yes bg-yes-light border border-yes/20 px-2.5 py-1 rounded-full">
            ✓ {t.predictions.saved}
          </p>
        )}
      </div>

      {locked && (
        <div className="bg-no-light/40 border border-no/30 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="text-3xl shrink-0">🔒</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-dark">{t.predictions.locked}</h2>
            <p className="text-xs text-text-secondary mt-0.5">{t.predictions.lockedHint}</p>
            <p className="text-xs text-text-muted mt-0.5">{t.predictions.lockedReadOnly}</p>
          </div>
          {onSwitchToOthers && (
            <button
              type="button"
              onClick={onSwitchToOthers}
              className="bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full cursor-pointer shrink-0"
            >
              {t.predictions.lockedSeeOthers} →
            </button>
          )}
        </div>
      )}

      <ScoringLegend />

      <fieldset disabled={locked} className="contents">
      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-dark">{t.predictions.groupStage}</h2>
          <p className="text-xs text-text-muted">{t.predictions.groupStageHint}</p>
        </header>
        <div className="flex flex-col gap-4">
          {GROUP_LETTERS.map(letter => (
            <GroupMatchesSection
              key={letter}
              letter={letter}
              teams={teamsByGroup[letter]}
              matches={matchesByGroup[letter]}
              drafts={draft.matches}
              matchPredictions={myMatchPreds}
              boostsUsedInGroupStage={boostsByStage.group}
              onChange={setMatchScore}
              onToggleBoost={handleToggleBoost}
              boostBusyId={boostBusyId}
              boostError={boostError}
              now={now}
              locked={locked}
            />
          ))}
        </div>
      </section>

      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-dark">{t.predictions.awards}</h2>
          <p className="text-xs text-text-muted">{t.predictions.awardsHint}</p>
        </header>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {TEAM_FIELDS.map(({ type, label }) => {
            const v = getTournament(draft, type)
            return (
              <label key={type} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary flex items-center justify-between gap-2">
                  {label}
                  {renderEarnedBadge(type)}
                </span>
                <select
                  value={v.team_id || ''}
                  onChange={e => setTournament(type, { team_id: e.target.value || null })}
                  className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary cursor-pointer"
                >
                  <option value="">{t.predictions.chooseTeam}</option>
                  {sortedTeams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.flag_emoji ? `${team.flag_emoji} ` : ''}{team.name}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
          {PLAYER_FIELDS.map(({ type, label }) => {
            const v = getTournament(draft, type)
            return (
              <label key={type} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary flex items-center justify-between gap-2">
                  {label}
                  {renderEarnedBadge(type)}
                </span>
                <input
                  type="text"
                  value={v.string_value || ''}
                  onChange={e => setTournament(type, { string_value: e.target.value || null })}
                  placeholder={t.predictions.playerNamePlaceholder}
                  className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </label>
            )
          })}
        </div>
      </section>

      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-dark">{t.predictions.totals}</h2>
          <p className="text-xs text-text-muted">{t.predictions.totalsHint}</p>
        </header>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {NUMBER_FIELDS.map(({ type, label }) => {
            const v = getTournament(draft, type)
            return (
              <label key={type} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary flex items-center justify-between gap-2">
                  {label}
                  {renderEarnedBadge(type)}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={v.number_value ?? ''}
                  onChange={e => {
                    const raw = e.target.value
                    setTournament(type, { number_value: raw === '' ? null : Number(raw) })
                  }}
                  className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </label>
            )
          })}
        </div>
      </section>

      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-dark">{t.predictions.drama}</h2>
          <p className="text-xs text-text-muted">{t.predictions.dramaHint}</p>
        </header>
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {BOOL_FIELDS.map(({ type, label }) => {
            const v = getTournament(draft, type)
            return (
              <div key={type} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-dark flex items-center gap-2">
                  {label}
                  {renderEarnedBadge(type)}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {([['yes', true], ['no', false]] as const).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTournament(type, { bool_value: v.bool_value === val ? null : val })}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                        v.bool_value === val
                          ? val
                            ? 'bg-yes text-white'
                            : 'bg-no text-white'
                          : 'bg-bg text-text-muted hover:text-dark'
                      }`}
                    >
                      {val ? t.predictions.yes : t.predictions.no}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      </fieldset>

      {!locked && (
        <StickySaveBar dirtyCount={dirtyCount} saving={saving} error={error} onSave={handleSave} />
      )}
    </div>
  )
}
