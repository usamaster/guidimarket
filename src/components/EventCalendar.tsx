import { useMemo, useState, useEffect } from 'react'
import type { MarketEvent } from '../lib/database.types'

interface EventCalendarProps {
  events: MarketEvent[]
}

function timeUntil(dateStr: string, now: number): string {
  const diff = new Date(dateStr).getTime() - now
  if (diff <= 0) return 'nu'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hrs}u ${rem}m` : `${hrs}u`
}

function timeStr(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function EventCalendar({ events }: EventCalendarProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const upcoming = useMemo(() => {
    const fourHours = now + 4 * 60 * 60 * 1000
    return events
      .filter(e => !e.executed && new Date(e.scheduled_at).getTime() > now && new Date(e.scheduled_at).getTime() <= fourHours)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  }, [events, now])

  const recent = useMemo(() => {
    return events
      .filter(e => e.executed)
      .sort((a, b) => new Date(b.executed_at || b.scheduled_at).getTime() - new Date(a.executed_at || a.scheduled_at).getTime())
      .slice(0, 2)
  }, [events])

  return (
    <div className="bg-surface rounded-xl border border-border p-3">
      <h3 className="text-xs font-semibold text-dark mb-2 flex items-center gap-1.5">
        📅 Agenda
        {upcoming.length > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{upcoming.length}</span>
        )}
      </h3>

      {recent.length > 0 && (
        <div className="mb-2">
          {recent.map(ev => (
            <div key={ev.id} className="flex items-start gap-2 py-1 opacity-50">
              <div className="w-1 h-1 rounded-full bg-text-muted mt-1.5 shrink-0" />
              <div className="text-[10px] text-text-muted line-through truncate">{ev.title}</div>
            </div>
          ))}
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="text-[10px] text-text-muted py-2">Geen events komende 4 uur</p>
      ) : (
        <div className="space-y-0.5">
          {upcoming.map((ev, idx) => {
            const isNext = idx === 0
            const diff = new Date(ev.scheduled_at).getTime() - now
            const isSoon = diff < 15 * 60 * 1000
            return (
              <div
                key={ev.id}
                className={`flex items-start gap-2 py-1.5 rounded-lg transition-colors ${isNext ? 'bg-primary/5 px-2 -mx-1' : ''}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${isSoon ? 'bg-primary animate-pulse' : 'bg-border'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-medium text-dark truncate">{ev.title}</span>
                    <span className={`text-[10px] whitespace-nowrap shrink-0 ${isSoon ? 'text-primary font-bold' : 'text-text-muted'}`}>
                      {timeStr(ev.scheduled_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-text-muted">{timeUntil(ev.scheduled_at, now)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
