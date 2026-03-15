import type { Holding, Stock } from './database.types'

export function computePortfolioValue(holdings: Holding[], stocks: Stock[]): number {
  return holdings.reduce((sum, h) => {
    const stock = stocks.find(s => s.id === h.stock_id)
    return sum + (stock ? stock.current_price * h.quantity : 0)
  }, 0)
}
