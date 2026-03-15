export interface Stock {
  id: string
  ticker: string
  name: string
  emoji: string
  current_price: number
  previous_close: number
  created_at: string
}

export interface PricePoint {
  id: string
  stock_id: string
  price: number
  created_at: string
}

export interface Portfolio {
  id: string
  user_id: string
  credits: number
  display_name: string | null
  created_at: string
}

export interface Holding {
  id: string
  user_id: string
  stock_id: string
  quantity: number
  avg_buy_price: number
}

export interface Trade {
  id: string
  stock_id: string
  user_id: string | null
  username: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  total: number
  is_fake: boolean
  created_at: string
}
