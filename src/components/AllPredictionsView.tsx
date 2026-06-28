import { useEffect, useMemo, useState } from 'react'
import { t, fmtKickoff } from '../lib/i18n'
import type { Match, MatchPrediction, Profile, Team, TournamentPrediction, TournamentResult } from '../lib/database.types'
import { knockoutAdvancer } from '../lib/scoring'
import { Flag } from './Flag'

interface AllPredictionsViewProps {
  currentUserId: string
  profiles: Profile[]
  teams: Team[]
  matches: Match[]
  matchPredictions: MatchPrediction[]
  tournamentPredictions: TournamentPrediction[]
  tournamentResults: TournamentResult[]
  onSwitchToMine?: () => void
}

function teamMap(teams: Team[]): Map<string, Team> {
  const m = new Map<string, Team>()
  for (const team of teams) m.set(team.id, team)
  return m
}

function profileMap(profiles: Profile[]): Map<string, Profile> {
  const m = new Map<string, Profile>()
  for (const p of profiles) m.set(p.user_id, p)
  return m
}

function pickFocusIndex(matches: Match[], now: number): number {
  if (matches.length === 0) return 0
  let live = -1
  let next = -1
  for (let i = 0; i < matches.length; i++) {
    const ts = new Date(matches[i].kickoff_at).getTime()
    if (ts <= now && matches[i].status !== 'finished') {
      live = i
      break
    }
    if (ts > now && next === -1) next = i
  }
  if (live >= 0) return live
  if (next >= 0) return next
  return matches.length - 1
}

function statusOf(match: Match, now: number): 'live' | 'over' | 'upcoming' {
  const ts = new Date(match.kickoff_at).getTime()
  if (match.status === 'finished') return 'over'
  if (ts <= now) return 'live'
  return 'upcoming'
}

function statusLabel(s: 'live' | 'over' | 'upcoming') {
  if (s === 'live') return t.others.matchLive
  if (s === 'over') return t.others.matchOver
  return t.others.matchUpcoming
}

function statusClasses(s: 'live' | 'over' | 'upcoming') {
  if (s === 'live') return 'bg-no text-white animate-pulse'
  if (s === 'over') return 'bg-bg text-text-muted'
  return 'bg-primary/10 text-primary'
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface ConsensusEntry {
  key: string
  team1_score: number
  team2_score: number
  count: number
}

function buildConsensus(rows: { team1_score: number | null; team2_score: number | null }[]): ConsensusEntry[] {
  const counts = new Map<string, ConsensusEntry>()
  for (const r of rows) {
    if (r.team1_score === null || r.team2_score === null) continue
    const key = `${r.team1_score}-${r.team2_score}`
    const existing = counts.get(key)
    if (existing) existing.count += 1
    else counts.set(key, { key, team1_score: r.team1_score, team2_score: r.team2_score, count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3)
}

export function AllPredictionsView({
  currentUserId, profiles, teams, matches, matchPredictions, tournamentPredictions, tournamentResults, onSwitchToMine,
}: AllPredictionsViewProps) {
  const [now, setNow] = useState(() => Date.now())
  const orderedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches],
  )
  const [focusIdx, setFocusIdx] = useState<number>(() => pickFocusIndex(orderedMatches, Date.now()))

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const focusMatch = orderedMatches[focusIdx] || null
  const teamsById = useMemo(() => teamMap(teams), [teams])
  const profilesById = useMemo(() => profileMap(profiles), [profiles])
  const sortedProfiles = useMemo(
    () => [...profiles].sort((a, b) => (a.display_name || '').localeCompare(b.display_name || '')),
    [profiles],
  )

  const predictionsForMatch = useMemo(() => {
    if (!focusMatch) return [] as MatchPrediction[]
    return matchPredictions.filter(p => p.match_id === focusMatch.id)
  }, [matchPredictions, focusMatch])

  const consensus = useMemo(() => buildConsensus(predictionsForMatch), [predictionsForMatch])

  if (orderedMatches.length === 0) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 text-center text-text-muted">—</div>
  }

  if (!focusMatch) return null

  const team1 = focusMatch.team1_id ? teamsById.get(focusMatch.team1_id) || null : null
  const team2 = focusMatch.team2_id ? teamsById.get(focusMatch.team2_id) || null : null
  const isKnockout = focusMatch.stage === 'knockout'
  const actualAdvancerId = isKnockout ? knockoutAdvancer(focusMatch) : null
  const status = statusOf(focusMatch, now)
  const finished = focusMatch.status === 'finished' && focusMatch.team1_score !== null && focusMatch.team2_score !== null
  const totalPlayers = profiles.length
  const playersWithPrediction = predictionsForMatch.filter(p => p.team1_score !== null && p.team2_score !== null).length

  const goPrev = () => setFocusIdx(i => Math.max(0, i - 1))
  const goNext = () => setFocusIdx(i => Math.min(orderedMatches.length - 1, i + 1))
  const goCurrent = () => setFocusIdx(pickFocusIndex(orderedMatches, now))

  const rows = sortedProfiles.map(profile => {
    const pred = predictionsForMatch.find(p => p.user_id === profile.user_id) || null
    return { profile, pred }
  })
  rows.sort((a, b) => {
    if (finished) {
      const aPts = a.pred?.points_awarded ?? -1
      const bPts = b.pred?.points_awarded ?? -1
      if (aPts !== bPts) return bPts - aPts
    }
    const aHas = a.pred && a.pred.team1_score !== null && a.pred.team2_score !== null ? 0 : 1
    const bHas = b.pred && b.pred.team1_score !== null && b.pred.team2_score !== null ? 0 : 1
    if (aHas !== bHas) return aHas - bHas
    return (a.profile.display_name || '').localeCompare(b.profile.display_name || '')
  })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 pb-12">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-dark">{t.others.pageTitle}</h1>
          <p className="text-sm text-text-secondary mt-1">{t.others.pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {onSwitchToMine && (
            <button
              type="button"
              onClick={onSwitchToMine}
              className="text-xs font-medium text-text-muted hover:text-dark cursor-pointer"
            >
              ← Mijn voorspellingen
            </button>
          )}
          <button
            type="button"
            onClick={goCurrent}
            className="text-xs font-medium text-primary hover:text-primary-hover cursor-pointer"
          >
            {t.others.jumpToCurrent} →
          </button>
        </div>
      </header>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-bg/60 border-b border-border">
          <button
            type="button"
            onClick={goPrev}
            disabled={focusIdx === 0}
            className="text-xs font-medium text-text-secondary hover:text-dark disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
          >
            ← {t.others.prevMatch}
          </button>
          <div className="text-[11px] uppercase tracking-wide text-text-muted">
            {focusMatch.round}{focusMatch.group_letter ? ` · ${t.others.showFor} ${focusMatch.group_letter}` : ''}
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={focusIdx === orderedMatches.length - 1}
            className="text-xs font-medium text-text-secondary hover:text-dark disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
          >
            {t.others.nextMatch} →
          </button>
        </div>

        <div className="px-4 sm:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-[11px] uppercase tracking-wide text-text-muted">
              {t.others.kickoff} · {fmtKickoff(focusMatch.kickoff_at)}
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${statusClasses(status)}`}>
              {statusLabel(status)}
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            <div className="flex flex-col items-center text-center gap-2">
              {team1?.flag_emoji
                ? <Flag emoji={team1.flag_emoji} className="w-14 h-14 sm:w-20 sm:h-20" />
                : <span className="text-5xl sm:text-6xl leading-none">🏳️</span>}
              <span className="text-sm sm:text-base font-bold text-dark">
                {team1?.name || focusMatch.team1_placeholder || '—'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              {finished ? (
                <span className="text-3xl sm:text-5xl font-bold tabular-nums text-dark">
                  {focusMatch.team1_score} <span className="text-text-muted">-</span> {focusMatch.team2_score}
                </span>
              ) : (
                <span className="text-2xl sm:text-3xl font-medium text-text-muted">vs</span>
              )}
              {focusMatch.ground && (
                <span className="text-[10px] text-text-muted text-center max-w-[120px] truncate">
                  {focusMatch.ground}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              {team2?.flag_emoji
                ? <Flag emoji={team2.flag_emoji} className="w-14 h-14 sm:w-20 sm:h-20" />
                : <span className="text-5xl sm:text-6xl leading-none">🏳️</span>}
              <span className="text-sm sm:text-base font-bold text-dark">
                {team2?.name || focusMatch.team2_placeholder || '—'}
              </span>
            </div>
          </div>
        </div>

        {consensus.length > 0 && (
          <div className="px-4 sm:px-8 py-3 border-t border-border flex items-center gap-3 sm:gap-4 flex-wrap bg-bg/40">
            <span className="text-[10px] uppercase tracking-wide text-text-muted font-semibold">
              {t.others.consensusTitle}
            </span>
            {consensus.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1.5 text-xs text-dark bg-card border border-border rounded-full px-2.5 py-1">
                <span className="font-semibold tabular-nums">{c.team1_score}-{c.team2_score}</span>
                <span className="text-text-muted">·</span>
                <span className="text-text-secondary">{c.count} {c.count === 1 ? t.others.consensusOne : t.others.consensusMany}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <section>
        <header className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-dark">
            {playersWithPrediction} / {totalPlayers} <span className="font-normal text-text-muted text-sm">{t.others.summary}</span>
          </h2>
        </header>

        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {rows.map(({ profile, pred }) => {
            const has = !!pred && pred.team1_score !== null && pred.team2_score !== null
            const boosted = pred?.boost_applied
            const earned = finished && pred?.points_awarded !== null && pred?.points_awarded !== undefined ? pred.points_awarded : null
            const isMe = profile.user_id === currentUserId
            const advanceTeam = isKnockout && pred?.advance_team_id ? teamsById.get(pred.advance_team_id) || null : null
            const advanceCorrect = advanceTeam && actualAdvancerId ? pred!.advance_team_id === actualAdvancerId : null

            return (
              <div
                key={profile.user_id}
                className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-primary/5' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isMe ? 'bg-primary text-white' : 'bg-bg text-text-secondary'
                }`}>
                  {initials(profile.display_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-dark truncate">
                      {profile.display_name || '—'}
                    </span>
                    {isMe && (
                      <span className="text-[10px] uppercase tracking-wide text-primary font-bold">
                        {t.others.youTag}
                      </span>
                    )}
                  </div>
                  {!has && (
                    <p className="text-[11px] text-text-muted">{t.others.noPrediction}</p>
                  )}
                  {advanceTeam && (
                    <p className="text-[11px] text-text-secondary flex items-center gap-1 mt-0.5 min-w-0">
                      <span className="text-text-muted shrink-0">{t.knockout.advanceShort}:</span>
                      <Flag emoji={advanceTeam.flag_emoji} className="inline-block w-3.5 h-3.5 shrink-0 align-[-0.15em]" />
                      <span className="truncate font-medium text-dark">{advanceTeam.name}</span>
                      {advanceCorrect === true && <span className="text-yes font-bold shrink-0">✓</span>}
                      {advanceCorrect === false && <span className="text-no font-bold shrink-0">✗</span>}
                    </p>
                  )}
                </div>
                {has && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-base sm:text-lg font-bold tabular-nums">
                      {team1?.flag_emoji
                        ? <Flag emoji={team1.flag_emoji} className="inline-block w-4 h-4 sm:w-5 sm:h-5" />
                        : <span>🏳️</span>}
                      <span className="text-dark">{pred!.team1_score}</span>
                      <span className="text-text-muted text-sm">-</span>
                      <span className="text-dark">{pred!.team2_score}</span>
                      {team2?.flag_emoji
                        ? <Flag emoji={team2.flag_emoji} className="inline-block w-4 h-4 sm:w-5 sm:h-5" />
                        : <span>🏳️</span>}
                    </div>
                    {boosted && (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-primary text-white px-1.5 py-0.5 rounded-full">
                        ⚡
                      </span>
                    )}
                    {earned !== null && (
                      <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full ${
                        earned > 0 ? 'bg-yes-light text-yes' : 'bg-bg text-text-muted'
                      }`}>
                        {earned} {t.nav.points}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <TournamentPredictionsSection
        profiles={sortedProfiles}
        teamsById={teamsById}
        profilesById={profilesById}
        currentUserId={currentUserId}
        tournamentPredictions={tournamentPredictions}
        tournamentResults={tournamentResults}
      />
    </div>
  )
}

interface TournamentSectionProps {
  profiles: Profile[]
  profilesById: Map<string, Profile>
  teamsById: Map<string, Team>
  currentUserId: string
  tournamentPredictions: TournamentPrediction[]
  tournamentResults: TournamentResult[]
}

const TYPE_LABELS: Record<string, string> = {
  winner: t.predictions.winner,
  runner_up: t.predictions.runnerUp,
  third: t.predictions.third,
  fourth: t.predictions.fourth,
  most_goals_against: t.predictions.mostGoalsAgainst,
  top_scorer: t.predictions.topScorer,
  golden_ball: t.predictions.goldenBall,
  young_player: t.predictions.youngPlayer,
  golden_glove: t.predictions.goldenGlove,
  dutch_zero_minutes: t.predictions.dutchZeroMinutes,
  total_goals: t.predictions.totalGoals,
  total_red_cards: t.predictions.totalRedCards,
  total_yellow_cards: t.predictions.totalYellowCards,
  total_penalties: t.predictions.totalPenalties,
  highest_match_goals: t.predictions.highestMatchGoals,
  host_reaches_qf: t.predictions.hostReachesQf,
  undefeated_team_exists: t.predictions.undefeatedTeam,
  any_zero_zero: t.predictions.anyZeroZero,
  final_goes_to_et: t.predictions.finalGoesToEt,
  hat_trick_scored: t.predictions.hatTrickScored,
}

const TYPE_ORDER = [
  'winner', 'runner_up', 'third', 'fourth', 'most_goals_against',
  'top_scorer', 'golden_ball', 'young_player', 'golden_glove', 'dutch_zero_minutes',
  'total_goals', 'total_red_cards', 'total_yellow_cards', 'total_penalties', 'highest_match_goals',
  'host_reaches_qf', 'undefeated_team_exists', 'any_zero_zero', 'final_goes_to_et', 'hat_trick_scored',
]

function TournamentPredictionsSection({
  profiles, profilesById, teamsById, currentUserId, tournamentPredictions, tournamentResults,
}: TournamentSectionProps) {
  const resultsByType = useMemo(() => {
    const m = new Map<string, TournamentResult>()
    for (const r of tournamentResults) m.set(r.prediction_type, r)
    return m
  }, [tournamentResults])

  const groupedByType = useMemo(() => {
    const m = new Map<string, TournamentPrediction[]>()
    for (const p of tournamentPredictions) {
      const arr = m.get(p.prediction_type) || []
      arr.push(p)
      m.set(p.prediction_type, arr)
    }
    return m
  }, [tournamentPredictions])

  const formatPredictionValue = (p: TournamentPrediction): string => {
    if (p.team_id) {
      const team = teamsById.get(p.team_id)
      if (team) return `${team.flag_emoji ? team.flag_emoji + ' ' : ''}${team.name}`
    }
    if (p.string_value) return p.string_value
    if (p.number_value !== null) return String(p.number_value)
    if (p.bool_value !== null) return p.bool_value ? t.predictions.yes : t.predictions.no
    return '—'
  }

  const formatResultValue = (r: TournamentResult): string => {
    if (r.team_id) {
      const team = teamsById.get(r.team_id)
      if (team) return `${team.flag_emoji ? team.flag_emoji + ' ' : ''}${team.name}`
    }
    if (r.string_value) return r.string_value
    if (r.number_value !== null) return String(r.number_value)
    if (r.bool_value !== null) return r.bool_value ? t.predictions.yes : t.predictions.no
    return '—'
  }

  const presentTypes = TYPE_ORDER.filter(type => (groupedByType.get(type) || []).length > 0)
  if (presentTypes.length === 0 && profiles.length === 0) return null

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-lg font-semibold text-dark">{t.others.awardsTitle}</h2>
        <p className="text-xs text-text-muted">{t.others.awardsHint}</p>
      </header>

      <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
        {presentTypes.map(type => {
          const result = resultsByType.get(type)
          const preds = groupedByType.get(type) || []
          return (
            <div key={type} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                <span className="text-sm font-semibold text-dark">{TYPE_LABELS[type] || type}</span>
                {result && (
                  <span className="text-[11px] text-yes bg-yes-light border border-yes/20 rounded-full px-2 py-0.5">
                    ✓ {formatResultValue(result)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preds.map(p => {
                  const profile = profilesById.get(p.user_id)
                  if (!profile) return null
                  const isMe = p.user_id === currentUserId
                  const earnedPts = p.resolved && p.points_awarded !== null ? p.points_awarded : null
                  return (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border ${
                        isMe
                          ? 'bg-primary/5 border-primary/30 text-dark'
                          : 'bg-bg border-border text-text-secondary'
                      }`}
                      title={profile.display_name || ''}
                    >
                      <span className="font-semibold">{profile.display_name || '—'}</span>
                      <span className="text-text-muted">·</span>
                      <span className="text-dark">{formatPredictionValue(p)}</span>
                      {earnedPts !== null && earnedPts > 0 && (
                        <span className="text-[10px] font-bold text-yes ml-1">+{earnedPts}</span>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
