import { useMemo } from 'react'
import { t, fmtKickoff } from '../lib/i18n'
import type { Match, MatchPrediction, Team } from '../lib/database.types'
import type { GroupLetter } from '../lib/constants'
import { boostStageOf, boostStageLabel, BOOSTS_PER_STAGE } from '../lib/scoring'
import { Flag } from './Flag'

export interface MatchScoreDraft {
  team1_score: number | null
  team2_score: number | null
}

interface GroupMatchesSectionProps {
  letter: GroupLetter
  teams: Team[]
  matches: Match[]
  drafts: Record<string, MatchScoreDraft>
  matchPredictions: MatchPrediction[]
  boostsUsedInGroupStage: number
  onChange: (matchId: string, next: MatchScoreDraft) => void
  onToggleBoost: (matchId: string, applied: boolean) => void
  boostBusyId: string | null
  boostError: string | null
  now: number
  locked: boolean
}

interface Standing {
  team: Team
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

function computeStandings(teams: Team[], matches: Match[], drafts: Record<string, MatchScoreDraft>): Standing[] {
  const byId = new Map<string, Standing>()
  for (const team of teams) {
    byId.set(team.id, {
      team, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    })
  }

  for (const match of matches) {
    if (!match.team1_id || !match.team2_id) continue
    const draft = drafts[match.id]
    if (!draft) continue
    const a = draft.team1_score
    const b = draft.team2_score
    if (a === null || b === null || Number.isNaN(a) || Number.isNaN(b)) continue
    const s1 = byId.get(match.team1_id)
    const s2 = byId.get(match.team2_id)
    if (!s1 || !s2) continue
    s1.played += 1
    s2.played += 1
    s1.goalsFor += a
    s1.goalsAgainst += b
    s2.goalsFor += b
    s2.goalsAgainst += a
    if (a > b) { s1.won += 1; s1.points += 3; s2.lost += 1 }
    else if (a < b) { s2.won += 1; s2.points += 3; s1.lost += 1 }
    else { s1.drawn += 1; s2.drawn += 1; s1.points += 1; s2.points += 1 }
  }

  for (const s of byId.values()) s.goalDifference = s.goalsFor - s.goalsAgainst

  return [...byId.values()].sort((a, b) =>
    b.points - a.points
    || b.goalDifference - a.goalDifference
    || b.goalsFor - a.goalsFor
    || a.team.name.localeCompare(b.team.name)
  )
}

interface MatchRowProps {
  match: Match
  teams: Team[]
  draft: MatchScoreDraft
  prediction: MatchPrediction | undefined
  boostsUsed: number
  boostsLimit: number
  busy: boolean
  now: number
  locked: boolean
  onChange: (next: MatchScoreDraft) => void
  onToggleBoost: (applied: boolean) => void
}

function teamFor(match: Match, slot: 'team1' | 'team2', teams: Team[]) {
  const id = slot === 'team1' ? match.team1_id : match.team2_id
  if (!id) return null
  return teams.find(t2 => t2.id === id) || null
}

function MatchRow({ match, teams, draft, prediction, boostsUsed, boostsLimit, busy, now, locked, onChange, onToggleBoost }: MatchRowProps) {
  const team1 = teamFor(match, 'team1', teams)
  const team2 = teamFor(match, 'team2', teams)
  const kickedOff = new Date(match.kickoff_at).getTime() <= now
  const boostApplied = prediction?.boost_applied ?? false
  const stageFull = !boostApplied && boostsUsed >= boostsLimit
  const boostDisabled = busy || kickedOff || stageFull || locked
  const inputsDisabled = kickedOff || locked

  const handle = (slot: 'team1_score' | 'team2_score', raw: string) => {
    const n = raw === '' ? null : Math.max(0, Math.min(99, Number(raw)))
    onChange({ ...draft, [slot]: n })
  }

  const finished = match.status === 'finished'
  const earnedPts = prediction?.points_awarded ?? null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-text-muted">{fmtKickoff(match.kickoff_at)}</p>
        {finished && earnedPts !== null && (
          <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded ${
            earnedPts > 0 ? 'bg-yes-light text-yes' : 'bg-bg text-text-muted'
          }`}>
            {earnedPts} {t.nav.points} {t.predictions.earned}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
        <div className="flex items-center gap-1.5 justify-end min-w-0">
          <span className="text-sm font-medium text-dark truncate text-right">{team1?.name || '—'}</span>
          <Flag emoji={team1?.flag_emoji} className="inline-block w-4 h-4 shrink-0 align-[-0.15em]" />
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={draft.team1_score ?? ''}
            onChange={e => handle('team1_score', e.target.value)}
            disabled={inputsDisabled}
            className="w-11 bg-bg border border-border rounded-md px-2 py-1.5 text-sm text-dark text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          />
          <span className="text-text-muted text-xs">-</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={draft.team2_score ?? ''}
            onChange={e => handle('team2_score', e.target.value)}
            disabled={inputsDisabled}
            className="w-11 bg-bg border border-border rounded-md px-2 py-1.5 text-sm text-dark text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <Flag emoji={team2?.flag_emoji} className="inline-block w-4 h-4 shrink-0 align-[-0.15em]" />
          <span className="text-sm font-medium text-dark truncate">{team2?.name || '—'}</span>
        </div>
        <button
          type="button"
          onClick={() => onToggleBoost(!boostApplied)}
          disabled={boostDisabled}
          title={
            kickedOff
              ? t.predictions.boostKickedOff
              : stageFull
                ? t.predictions.boostMaxReached
                : t.predictions.boostHint
          }
          className={`shrink-0 w-8 h-8 rounded-full text-base flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
            boostApplied
              ? 'bg-primary text-white shadow-sm'
              : 'bg-bg text-text-muted hover:text-primary hover:bg-primary/10'
          }`}
        >
          ⚡
        </button>
      </div>
      {finished && match.team1_score !== null && match.team2_score !== null && (
        <p className="text-[11px] text-text-muted">
          {team1?.name} {match.team1_score} - {match.team2_score} {team2?.name}
        </p>
      )}
    </div>
  )
}

export function GroupMatchesSection({
  letter, teams, matches, drafts, matchPredictions, boostsUsedInGroupStage,
  onChange, onToggleBoost, boostBusyId, boostError, now, locked,
}: GroupMatchesSectionProps) {
  const standings = useMemo(() => computeStandings(teams, matches, drafts), [teams, matches, drafts])
  const predById = useMemo(() => {
    const m = new Map<string, MatchPrediction>()
    for (const p of matchPredictions) m.set(p.match_id, p)
    return m
  }, [matchPredictions])
  const stage = matches.length > 0 ? boostStageOf(matches[0]) : 'group'

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-base font-bold text-dark">Groep {letter}</h3>
        <span className="text-[11px] text-text-muted">
          ⚡ {boostsUsedInGroupStage} / {BOOSTS_PER_STAGE} {t.predictions.boostUsed} — {boostStageLabel(stage)}
        </span>
      </div>

      {boostError && (
        <p className="text-[11px] text-no bg-no-light border border-no/20 rounded px-2 py-1">{boostError}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)] gap-4 lg:gap-5">
        <div className="flex flex-col divide-y divide-border">
          {matches.map(match => {
            const draft = drafts[match.id] || { team1_score: null, team2_score: null }
            return (
              <div key={match.id} className="py-3 first:pt-0 last:pb-0">
                <MatchRow
                  match={match}
                  teams={teams}
                  draft={draft}
                  prediction={predById.get(match.id)}
                  boostsUsed={boostsUsedInGroupStage}
                  boostsLimit={BOOSTS_PER_STAGE}
                  busy={boostBusyId === match.id}
                  now={now}
                  locked={locked}
                  onChange={next => onChange(match.id, next)}
                  onToggleBoost={applied => onToggleBoost(match.id, applied)}
                />
              </div>
            )
          })}
        </div>

        <div className="lg:border-l lg:border-border lg:pl-5">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h4 className="text-sm font-semibold text-dark">{t.predictions.standings}</h4>
            <span className="text-[10px] text-text-muted uppercase tracking-wide">{t.predictions.standingsLive}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted">
                <th className="text-left font-medium pb-1.5 pr-1">#</th>
                <th className="text-left font-medium pb-1.5">{t.predictions.colTeam}</th>
                <th className="text-right font-medium pb-1.5 px-1">{t.predictions.colPlayed}</th>
                <th className="text-right font-medium pb-1.5 px-1">{t.predictions.colGoalDiff}</th>
                <th className="text-right font-medium pb-1.5 pl-1">{t.predictions.colPoints}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr
                  key={s.team.id}
                  className={`border-t border-border ${i < 2 ? 'text-dark' : 'text-text-secondary'}`}
                >
                  <td className="py-1.5 pr-1">
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold ${
                      i === 0 ? 'bg-yes text-white' : i === 1 ? 'bg-yes/30 text-yes' : 'text-text-muted'
                    }`}>{i + 1}</span>
                  </td>
                  <td className="py-1.5 truncate max-w-[120px]">
                    <Flag emoji={s.team.flag_emoji} className="inline-block w-3.5 h-3.5 mr-1 align-[-0.15em]" />
                    {s.team.name}
                  </td>
                  <td className="py-1.5 px-1 text-right tabular-nums">{s.played}</td>
                  <td className="py-1.5 px-1 text-right tabular-nums">
                    {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                  </td>
                  <td className="py-1.5 pl-1 text-right tabular-nums font-semibold">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
