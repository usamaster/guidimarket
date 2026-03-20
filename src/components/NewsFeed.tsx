import type { NewsItem, Stock } from '../lib/database.types'

interface NewsFeedProps {
  news: NewsItem[]
  stocks: Stock[]
}

function formatNewsTime(dateStr: string): string {
  const t = new Date(dateStr).getTime()
  const now = Date.now()
  const ahead = t - now
  if (ahead > 0) {
    const mins = Math.floor(ahead / 60000)
    if (mins < 1) return 'binnenkort'
    if (mins < 60) return `over ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `over ${hrs} u`
    return `over ${Math.floor(hrs / 24)} d`
  }
  const behind = now - t
  const mins = Math.floor(behind / 60000)
  if (mins < 1) return 'zojuist'
  if (mins < 60) return `${mins}m geleden`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}u geleden`
  return `${Math.floor(hrs / 24)}d geleden`
}

export function NewsFeed({ news, stocks }: NewsFeedProps) {
  const stockMap: Record<string, Stock> = {}
  for (const s of stocks) stockMap[s.id] = s

  const published = news
    .filter(n => n.published && n.published_at)
    .sort((a, b) => {
      const ta = new Date(a.published_at!).getTime()
      const tb = new Date(b.published_at!).getTime()
      const n = Date.now()
      const af = ta > n
      const bf = tb > n
      if (af && bf) return ta - tb
      if (af && !bf) return -1
      if (!af && bf) return 1
      return tb - ta
    })

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6">
      <h2 className="text-lg font-bold text-dark mb-5">📰 Nieuws</h2>

      {published.length === 0 ? (
        <div className="text-center py-20 text-text-muted text-sm">Nog geen nieuws gepubliceerd...</div>
      ) : (
        <div className="space-y-4">
          {published.map((item, idx) => (
            <article
              key={item.id}
              className={`bg-surface rounded-xl border border-border overflow-hidden transition-all ${idx === 0 ? 'ring-2 ring-primary/20' : ''}`}
            >
              {item.image_url && (
                <div className="h-40 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-dark leading-snug flex-1">{item.headline}</h3>
                  {item.published_at && (
                    <span className="text-[10px] text-text-muted whitespace-nowrap mt-0.5">{formatNewsTime(item.published_at)}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {item.impacts.map((impact, i) => {
                    const stock = stockMap[impact.stock_id]
                    const up = impact.pct > 0
                    const size = Math.abs(impact.pct)
                    const intensity = size >= 15 ? 'font-bold' : 'font-semibold'
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] ${intensity} ${
                          up
                            ? 'bg-yes-light text-yes'
                            : 'bg-no-light text-no'
                        }`}
                      >
                        {stock?.emoji} {impact.ticker}
                        <span>{up ? '▲' : '▼'} {size}%</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
