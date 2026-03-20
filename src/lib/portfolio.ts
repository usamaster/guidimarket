import type { Holding, ShortPosition, Stock } from './database.types'

export function computePortfolioValue(holdings: Holding[], stocks: Stock[], shortPositions?: ShortPosition[]): number {
  const longs = holdings.reduce((sum, h) => {
    const stock = stocks.find(s => s.id === h.stock_id)
    return sum + (stock ? stock.current_price * h.quantity : 0)
  }, 0)
  const shorts = shortPositions?.length
    ? shortPositions.reduce((sum, sp) => {
        const stock = stocks.find(s => s.id === sp.stock_id)
        if (!stock) return sum
        const nav = Number(sp.collateral) + (Number(sp.entry_price) - Number(stock.current_price)) * sp.quantity
        return sum + nav
      }, 0)
    : 0
  return longs + shorts
}
