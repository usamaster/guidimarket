export interface Profile {
  user_id: string
  display_name: string | null
  tokens: number
  prediction_points: number
  paid_in: boolean
  created_at: string
}

export interface AppState {
  id: number
  buyin_eur: number
  main_winner_user_id: string | null
  predictions_locked: boolean
  updated_at: string
}

export interface Team {
  id: string
  name: string
  fifa_code: string | null
  flag_emoji: string | null
  group_letter: string | null
  created_at: string
}

export type MatchStage = 'group' | 'knockout'
export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'cancelled'

export interface Match {
  id: string
  external_id: string | null
  round: string
  stage: MatchStage
  group_letter: string | null
  team1_id: string | null
  team2_id: string | null
  team1_placeholder: string | null
  team2_placeholder: string | null
  kickoff_at: string
  ground: string | null
  status: MatchStatus
  team1_score: number | null
  team2_score: number | null
  team1_ht: number | null
  team2_ht: number | null
  team1_et: number | null
  team2_et: number | null
  team1_pen: number | null
  team2_pen: number | null
  yellow_cards: number | null
  red_cards: number | null
  finished_at: string | null
  created_at: string
}

export type PredictionType =
  | 'winner'
  | 'runner_up'
  | 'third'
  | 'fourth'
  | 'top_scorer'
  | 'golden_ball'
  | 'young_player'
  | 'golden_glove'
  | 'total_goals'
  | 'total_red_cards'
  | 'total_yellow_cards'
  | 'total_penalties'
  | 'highest_match_goals'
  | 'host_reaches_qf'
  | 'undefeated_team_exists'
  | 'any_zero_zero'
  | 'final_goes_to_et'
  | 'hat_trick_scored'

export interface TournamentPrediction {
  id: string
  user_id: string
  prediction_type: PredictionType
  round_locked: string
  team_id: string | null
  string_value: string | null
  number_value: number | null
  bool_value: boolean | null
  points_awarded: number | null
  resolved: boolean
  resolved_at: string | null
  updated_at: string
}

export interface GroupPrediction {
  id: string
  user_id: string
  group_letter: string
  round_locked: string
  first_team_id: string | null
  second_team_id: string | null
  third_team_id: string | null
  fourth_team_id: string | null
  points_awarded: number | null
  resolved: boolean
  resolved_at: string | null
  updated_at: string
}

export interface MatchPrediction {
  id: string
  user_id: string
  match_id: string
  team1_score: number | null
  team2_score: number | null
  yellow_cards: number | null
  red_cards: number | null
  first_scorer_name: string | null
  boost_applied: boolean
  points_awarded: number | null
  resolved: boolean
  resolved_at: string | null
  updated_at: string
}

export interface TournamentResult {
  prediction_type: string
  team_id: string | null
  string_value: string | null
  number_value: number | null
  bool_value: boolean | null
  updated_at: string
}

export interface Message {
  id: string
  user_id: string
  display_name: string
  content: string
  created_at: string
}

export interface SideBetTemplate {
  id: string
  key: string
  label: string
  description: string | null
  category: 'goals' | 'cards' | 'drama' | 'result'
  applies_to_stage: 'any' | 'group' | 'knockout'
  side_a_label: string
  side_b_label: string
  created_at: string
}

export type SideBetStatus = 'open' | 'accepted' | 'cancelled' | 'resolved'
export type SideBetOutcome = 'proposer' | 'opponent' | 'push' | null

export interface SideBet {
  id: string
  match_id: string
  template_id: string | null
  custom_label: string | null
  description: string | null
  proposer_id: string
  proposer_name: string
  proposer_side: string
  proposer_stake: number
  opponent_id: string | null
  opponent_name: string | null
  opponent_side: string
  opponent_stake: number
  invited_user_id: string | null
  status: SideBetStatus
  outcome: SideBetOutcome
  accepted_at: string | null
  resolved_at: string | null
  created_at: string
}
