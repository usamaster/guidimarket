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

export interface Message {
  id: string
  user_id: string
  display_name: string
  content: string
  created_at: string
}

export interface MarketEvent {
  id: string
  title: string
  description: string
  scheduled_at: string
  impacts: { stock_id: string; ticker: string; pct: number }[]
  news_headline: string
  executed: boolean
  executed_at: string | null
  created_at: string
}

export interface NewsItem {
  id: string
  headline: string
  image_url: string | null
  impacts: { stock_id: string; ticker: string; pct: number }[]
  published: boolean
  published_at: string | null
  created_at: string
}

export interface Loan {
  id: string
  borrower_id: string
  borrower_name: string
  lender_id: string | null
  lender_name: string | null
  amount: number
  interest_pct: number
  total_repay: number
  message: string | null
  status: 'open' | 'funded' | 'repaid' | 'cancelled'
  denied_by: { user_id: string; display_name: string }[]
  funded_at: string | null
  repaid_at: string | null
  due_at: string | null
  created_at: string
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
