import type { Match, MatchPrediction } from './database.types'
import { t } from './i18n'

export type BoostStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final_phase'

export function boostStageOf(match: Match): BoostStage {
  if (match.stage === 'group') return 'group'
  switch (match.round) {
    case 'Round of 32':           return 'r32'
    case 'Round of 16':           return 'r16'
    case 'Quarter-final':         return 'qf'
    case 'Semi-final':            return 'sf'
    case 'Match for third place':
    case 'Final':
      return 'final_phase'
    default:
      return 'group'
  }
}

export function boostStageLabel(stage: BoostStage) {
  switch (stage) {
    case 'group':       return t.predictions.boostStageGroup
    case 'r32':         return t.predictions.boostStageR32
    case 'r16':         return t.predictions.boostStageR16
    case 'qf':          return t.predictions.boostStageQF
    case 'sf':          return t.predictions.boostStageSF
    case 'final_phase': return t.predictions.boostStageFinal
  }
}

export function roundMultiplier(round: string): number {
  if (round.startsWith('Matchday ')) return 1
  switch (round) {
    case 'Round of 32':           return 1.25
    case 'Round of 16':           return 1.5
    case 'Quarter-final':         return 2
    case 'Semi-final':            return 2.5
    case 'Match for third place': return 2
    case 'Final':                 return 3
    default:                      return 1
  }
}

export const BOOSTS_PER_STAGE = 3

export function countBoostsByStage(matchPredictions: MatchPrediction[], matches: Match[]): Record<BoostStage, number> {
  const matchById = new Map<string, Match>()
  for (const m of matches) matchById.set(m.id, m)
  const counts: Record<BoostStage, number> = {
    group: 0, r32: 0, r16: 0, qf: 0, sf: 0, final_phase: 0,
  }
  for (const mp of matchPredictions) {
    if (!mp.boost_applied) continue
    const m = matchById.get(mp.match_id)
    if (!m) continue
    counts[boostStageOf(m)] += 1
  }
  return counts
}
