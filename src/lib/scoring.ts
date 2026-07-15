import type { Match, MatchPrediction } from './database.types'
import { t } from './i18n'

export type BoostStage = 'group' | 'knockout'

export function boostStageOf(match: Match): BoostStage {
  return match.stage === 'group' ? 'group' : 'knockout'
}

export function boostStageLabel(stage: BoostStage) {
  return stage === 'group' ? t.predictions.boostStageGroup : t.predictions.boostStageKnockout
}

export function roundMultiplier(round: string): number {
  if (round.startsWith('Matchday ')) return 1
  switch (round) {
    case 'Round of 32':
    case 'Round of 16':
    case 'Quarter-final':
    case 'Semi-final':
    case 'Match for third place':
    case 'Final':
      return 2
    default:
      return 1
  }
}

export const BOOSTS_PER_STAGE = 3

export function roundHasAdvancer(round: string): boolean {
  return round !== 'Final' && round !== 'Match for third place'
}

export function countBoostsByStage(matchPredictions: MatchPrediction[], matches: Match[]): Record<BoostStage, number> {
  const matchById = new Map<string, Match>()
  for (const m of matches) matchById.set(m.id, m)
  const counts: Record<BoostStage, number> = {
    group: 0, knockout: 0,
  }
  for (const mp of matchPredictions) {
    if (!mp.boost_applied) continue
    const m = matchById.get(mp.match_id)
    if (!m) continue
    counts[boostStageOf(m)] += 1
  }
  return counts
}

export const KNOCKOUT_ROUND_ORDER = [
  'Round of 32',
  'Round of 16',
  'Quarter-final',
  'Semi-final',
  'Match for third place',
  'Final',
] as const

export function knockoutAdvancer(match: Match): string | null {
  const { team1_id, team2_id, team1_score, team2_score, team1_et, team2_et, team1_pen, team2_pen } = match
  if (!team1_id || !team2_id) return null
  if (team1_score === null || team2_score === null) return null
  if (team1_score > team2_score) return team1_id
  if (team2_score > team1_score) return team2_id
  if (team1_et !== null && team2_et !== null && team1_et > team2_et) return team1_id
  if (team1_et !== null && team2_et !== null && team2_et > team1_et) return team2_id
  if (team1_pen !== null && team2_pen !== null && team1_pen > team2_pen) return team1_id
  if (team1_pen !== null && team2_pen !== null && team2_pen > team1_pen) return team2_id
  return null
}
