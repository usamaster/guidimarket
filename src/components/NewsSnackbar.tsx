import { useEffect, useRef } from 'react'
import type { NewsItem } from '../lib/database.types'

interface NewsSnackbarProps {
  item: NewsItem | null
  onDismiss: () => void
  onNavigate: () => void
}

export function NewsSnackbar({ item, onDismiss, onNavigate }: NewsSnackbarProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!item) return
    timerRef.current = setTimeout(onDismiss, 8000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [item, onDismiss])

  if (!item) return null

  return (
    <div
      onClick={() => { onDismiss(); onNavigate() }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-md w-full px-4 cursor-pointer animate-[slideDown_0.3s_ease-out]"
    >
      <div className="bg-dark text-white rounded-xl shadow-2xl px-4 py-3 flex items-start gap-3">
        <span className="text-lg">📰</span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-primary font-bold uppercase tracking-wide mb-0.5">Breaking News</div>
          <p className="text-sm font-medium leading-snug line-clamp-2">{item.headline}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.impacts.slice(0, 4).map((impact, i) => {
              const up = impact.pct > 0
              return (
                <span key={i} className={`text-[10px] font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
                  {impact.ticker} {up ? '▲' : '▼'}{Math.abs(impact.pct)}%
                </span>
              )
            })}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDismiss() }}
          className="text-white/50 hover:text-white text-xs mt-0.5 cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
