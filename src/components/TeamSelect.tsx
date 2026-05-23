import { useState, useRef, useEffect } from 'react'
import type { Team } from '../lib/database.types'
import { Flag } from './Flag'

interface TeamSelectProps {
  teams: Team[]
  value: string | null
  onChange: (teamId: string | null) => void
  placeholder: string
  allowEmpty?: boolean
  emptyLabel?: string
  className?: string
  disabled?: boolean
}

export function TeamSelect({
  teams, value, onChange, placeholder, allowEmpty, emptyLabel, className, disabled,
}: TeamSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = teams.find(team => team.id === value) || null

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="w-full bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark text-left flex items-center gap-2 cursor-pointer hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {selected ? (
          <>
            <Flag emoji={selected.flag_emoji} className="inline-block w-4 h-4 shrink-0 align-[-0.15em]" />
            <span className="truncate flex-1">{selected.name}</span>
          </>
        ) : (
          <span className="truncate flex-1 text-text-muted">{placeholder}</span>
        )}
        <span className="text-text-muted text-xs shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {allowEmpty && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className={`w-full px-2 py-2 text-sm flex items-center gap-2 cursor-pointer text-left hover:bg-bg ${
                value === null ? 'bg-primary/10 text-dark' : 'text-text-muted'
              }`}
            >
              <span className="inline-block w-4 h-4 shrink-0" />
              <span className="truncate">{emptyLabel || '—'}</span>
            </button>
          )}
          {teams.map(team => (
            <button
              key={team.id}
              type="button"
              onClick={() => { onChange(team.id); setOpen(false) }}
              className={`w-full px-2 py-2 text-sm text-dark flex items-center gap-2 cursor-pointer text-left hover:bg-bg ${
                team.id === value ? 'bg-primary/10' : ''
              }`}
            >
              <Flag emoji={team.flag_emoji} className="inline-block w-4 h-4 shrink-0 align-[-0.15em]" />
              <span className="truncate">{team.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
