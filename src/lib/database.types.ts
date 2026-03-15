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

export interface Database {
  public: {
    Tables: {
      bets: {
        Row: Bet
        Insert: Omit<Bet, 'id' | 'created_at' | 'resolved_at' | 'taker' | 'taker_position' | 'winner' | 'status'> & {
          status?: string
        }
        Update: Partial<Bet>
      }
    }
  }
}
