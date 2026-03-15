export interface Bet {
  id: string
  title: string
  description: string
  amount: number
  creator: string
  creator_position: 'yes' | 'no'
  status: 'open' | 'taken' | 'resolved'
  taker: string | null
  taker_position: 'yes' | 'no' | null
  winner: string | null
  created_at: string
  resolved_at: string | null
}

export type BetInsert = {
  title: string
  description: string
  amount: number
  creator: string
  creator_position: 'yes' | 'no'
}

export type BetUpdate = {
  taker?: string | null
  taker_position?: 'yes' | 'no' | null
  status?: 'open' | 'taken' | 'resolved'
  winner?: string | null
  resolved_at?: string | null
}
