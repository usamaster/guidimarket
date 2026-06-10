import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { t, fmtKickoff } from '../lib/i18n'
import type { Match, Team } from '../lib/database.types'
import { Flag } from './Flag'

interface AdminMatchStatsProps {
  matches: Match[]
  teams: Team[]
  onBack: () => void
  onChanged: () => void
}

interface MatchForm {
  team1_score: string
  team2_score: string
  status: Match['status']
  team1_ht: string
  team2_ht: string
  team1_et: string
  team2_et: string
  team1_pen: string
  team2_pen: string
  yellow_cards: string
  red_cards: string
}

const EMPTY_FORM: MatchForm = {
  team1_score: '', team2_score: '', status: 'finished',
  team1_ht: '', team2_ht: '', team1_et: '', team2_et: '',
  team1_pen: '', team2_pen: '', yellow_cards: '', red_cards: '',
}

function s(n: number | null): string {
  return n === null || n === undefined ? '' : String(n)
}

function formFromMatch(m: Match): MatchForm {
  return {
    team1_score: s(m.team1_score),
    team2_score: s(m.team2_score),
    status: m.status === 'scheduled' ? 'finished' : m.status,
    team1_ht: s(m.team1_ht),
    team2_ht: s(m.team2_ht),
    team1_et: s(m.team1_et),
    team2_et: s(m.team2_et),
    team1_pen: s(m.team1_pen),
    team2_pen: s(m.team2_pen),
    yellow_cards: s(m.yellow_cards),
    red_cards: s(m.red_cards),
  }
}

function toNum(v: string): number | null {
  return v.trim() === '' ? null : Number(v)
}

export function AdminMatchStats({ matches, teams, onBack, onChanged }: AdminMatchStatsProps) {
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<MatchForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const teamById = useMemo(() => {
    const m = new Map<string, Team>()
    for (const team of teams) m.set(team.id, team)
    return m
  }, [teams])

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
    [matches],
  )

  const selected = selectedId ? matches.find(m => m.id === selectedId) || null : null
  const team1 = selected?.team1_id ? teamById.get(selected.team1_id) || null : null
  const team2 = selected?.team2_id ? teamById.get(selected.team2_id) || null : null

  const team1Name = team1?.name || selected?.team1_placeholder || '—'
  const team2Name = team2?.name || selected?.team2_placeholder || '—'

  const selectMatch = (id: string) => {
    setSelectedId(id)
    setSuccess(null)
    setError(null)
    const m = id ? matches.find(x => x.id === id) || null : null
    setForm(m ? formFromMatch(m) : EMPTY_FORM)
  }

  const setField = (key: keyof MatchForm, value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    setSuccess(null)
  }

  const scoresFilled = form.team1_score.trim() !== '' && form.team2_score.trim() !== ''

  const matchLabel = (m: Match) => {
    const n1 = m.team1_id ? teamById.get(m.team1_id)?.name ?? m.team1_placeholder : m.team1_placeholder
    const n2 = m.team2_id ? teamById.get(m.team2_id)?.name ?? m.team2_placeholder : m.team2_placeholder
    const done = m.status === 'finished' ? ` · ${t.admin.matchStatsFinishedTag}` : ''
    return `${fmtKickoff(m.kickoff_at)} — ${n1 || '?'} vs ${n2 || '?'}${done}`
  }

  const save = async () => {
    if (!selected || busy) return
    if (!scoresFilled) { setError(t.admin.matchStatsNeedScore); return }
    setBusy(true); setError(null); setSuccess(null)
    const { error: e1 } = await supabase.rpc('admin_set_match_result', {
      p_match_id: selected.id,
      p_team1_score: toNum(form.team1_score),
      p_team2_score: toNum(form.team2_score),
      p_status: form.status,
      p_team1_ht: toNum(form.team1_ht),
      p_team2_ht: toNum(form.team2_ht),
      p_team1_et: toNum(form.team1_et),
      p_team2_et: toNum(form.team2_et),
      p_team1_pen: toNum(form.team1_pen),
      p_team2_pen: toNum(form.team2_pen),
      p_yellow_cards: toNum(form.yellow_cards),
      p_red_cards: toNum(form.red_cards),
    })
    if (e1) { setError(e1.message); setBusy(false); return }
    const { error: e2 } = await supabase.rpc('score_predictions')
    if (e2) { setError(e2.message); setBusy(false); return }
    setSuccess(t.admin.matchStatsSaved)
    onChanged()
    setBusy(false)
  }

  const scorePair = (label: string, k1: keyof MatchForm, k2: keyof MatchForm) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number" inputMode="numeric" min={0}
          value={form[k1]}
          onChange={e => setField(k1, e.target.value)}
          className="w-16 bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <span className="text-text-muted text-xs">-</span>
        <input
          type="number" inputMode="numeric" min={0}
          value={form[k2]}
          onChange={e => setField(k2, e.target.value)}
          className="w-16 bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-dark">{t.admin.matchStatsTitle}</h1>
        <button onClick={onBack} className="text-sm text-primary hover:text-primary-hover cursor-pointer shrink-0">
          {t.admin.matchStatsBack}
        </button>
      </div>
      <p className="text-sm text-text-secondary -mt-3">{t.admin.matchStatsHint}</p>

      {error && <div className="bg-no-light border border-no/20 text-no rounded-lg px-3 py-2 text-sm">{error}</div>}
      {success && <div className="bg-yes-light border border-yes/20 text-yes rounded-lg px-3 py-2 text-sm">{success}</div>}

      <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">{t.admin.matchStatsSelect}</span>
          <select
            value={selectedId}
            onChange={e => selectMatch(e.target.value)}
            className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark"
          >
            <option value="">{t.admin.matchStatsSelect}</option>
            {sortedMatches.map(m => (
              <option key={m.id} value={m.id}>{matchLabel(m)}</option>
            ))}
          </select>
        </label>

        {!selected ? (
          <p className="text-sm text-text-muted">{t.admin.matchStatsNoMatch}</p>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3 py-2 text-sm font-semibold text-dark">
              <span className="flex items-center gap-1.5 min-w-0">
                <Flag emoji={team1?.flag_emoji} className="inline-block w-4 h-4 shrink-0 align-[-0.15em]" />
                <span className="truncate">{team1Name}</span>
              </span>
              <span className="text-text-muted">vs</span>
              <span className="flex items-center gap-1.5 min-w-0">
                <Flag emoji={team2?.flag_emoji} className="inline-block w-4 h-4 shrink-0 align-[-0.15em]" />
                <span className="truncate">{team2Name}</span>
              </span>
            </div>

            <div className="bg-bg/50 border border-border rounded-lg p-3 flex flex-col gap-1.5">
              {scorePair(t.admin.matchStatsFinalScore, 'team1_score', 'team2_score')}
              <span className="text-[11px] text-text-muted">{t.admin.matchStatsScoreNote}</span>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">{t.admin.matchStatsStatus}</span>
              <select
                value={form.status}
                onChange={e => setField('status', e.target.value as Match['status'])}
                className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark sm:max-w-xs"
              >
                <option value="finished">{t.admin.matchStatsStatusFinished}</option>
                <option value="live">{t.admin.matchStatsStatusLive}</option>
                <option value="scheduled">{t.admin.matchStatsStatusScheduled}</option>
                <option value="cancelled">{t.admin.matchStatsStatusCancelled}</option>
              </select>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 border-t border-border">
              {scorePair(t.admin.matchStatsHalfTime, 'team1_ht', 'team2_ht')}
              {scorePair(t.admin.matchStatsExtraTime, 'team1_et', 'team2_et')}
              {scorePair(t.admin.matchStatsPenalties, 'team1_pen', 'team2_pen')}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">{t.admin.matchStatsYellow}</span>
                <input
                  type="number" inputMode="numeric" min={0}
                  value={form.yellow_cards}
                  onChange={e => setField('yellow_cards', e.target.value)}
                  className="w-16 bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">{t.admin.matchStatsRed}</span>
                <input
                  type="number" inputMode="numeric" min={0}
                  value={form.red_cards}
                  onChange={e => setField('red_cards', e.target.value)}
                  className="w-16 bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </label>
            </div>

            <button
              onClick={save}
              disabled={busy || !scoresFilled}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-full cursor-pointer self-start"
            >
              {busy ? t.admin.matchStatsSaving : t.admin.matchStatsSave}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
