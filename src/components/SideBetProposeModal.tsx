import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { t, fmtTokens, fmtKickoff } from '../lib/i18n'
import type { Match, Profile, SideBetTemplate, Team } from '../lib/database.types'

interface SideBetProposeModalProps {
  match: Match
  teams: Team[]
  templates: SideBetTemplate[]
  profiles: Profile[]
  currentUserId: string
  myTokens: number
  onClose: () => void
  onProposed: () => void
}

function teamName(match: Match, slot: 'team1' | 'team2', teams: Team[]) {
  const id = slot === 'team1' ? match.team1_id : match.team2_id
  const placeholder = slot === 'team1' ? match.team1_placeholder : match.team2_placeholder
  if (id) {
    const team = teams.find(t2 => t2.id === id)
    return team ? `${team.flag_emoji ? team.flag_emoji + ' ' : ''}${team.name}` : '—'
  }
  return placeholder || '—'
}

function applyTokens(label: string, t1: string, t2: string) {
  return label.replaceAll('{team1}', t1).replaceAll('{team2}', t2)
}

export function SideBetProposeModal({
  match, teams, templates, profiles, currentUserId, myTokens, onClose, onProposed,
}: SideBetProposeModalProps) {
  const t1Name = teamName(match, 'team1', teams)
  const t2Name = teamName(match, 'team2', teams)

  const eligibleTemplates = useMemo(() => templates.filter(t2 =>
    t2.applies_to_stage === 'any' || t2.applies_to_stage === match.stage
  ), [templates, match.stage])

  const [templateKey, setTemplateKey] = useState<string>(eligibleTemplates[0]?.key ?? 'vibes_check')
  const [customLabel, setCustomLabel] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [mySide, setMySide] = useState<string>('')
  const [myStake, setMyStake] = useState<number>(100)
  const [opponentStake, setOpponentStake] = useState<number>(100)
  const [invitedUserId, setInvitedUserId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const template = eligibleTemplates.find(t2 => t2.key === templateKey) || null
  const isCustom = !template || template.key === 'vibes_check'

  const sideALabel = template ? applyTokens(template.side_a_label, t1Name, t2Name) : 'ja'
  const sideBLabel = template ? applyTokens(template.side_b_label, t1Name, t2Name) : 'nee'
  const sideAValue = template?.side_a_label || 'ja'
  const sideBValue = template?.side_b_label || 'nee'

  const effectiveMySide = mySide || sideAValue
  const effectiveOpponentSide = effectiveMySide === sideAValue ? sideBValue : sideAValue
  const effectiveOpponentLabel = effectiveMySide === sideAValue ? sideBLabel : sideALabel
  const effectiveMyLabel = effectiveMySide === sideAValue ? sideALabel : sideBLabel

  const otherProfiles = profiles.filter(p => p.user_id !== currentUserId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)

    if (myStake <= 0 || opponentStake <= 0) {
      setError(t.sidebets.insufficientTokens)
      return
    }
    if (myStake > myTokens) {
      setError(t.sidebets.insufficientTokens)
      return
    }
    if (isCustom && !customLabel.trim()) {
      setError(t.sidebets.customLabelPlaceholder)
      return
    }

    setSubmitting(true)
    const { error: rpcErr } = await supabase.rpc('propose_side_bet', {
      p_match_id: match.id,
      p_template_id: template && !isCustom ? template.id : null,
      p_custom_label: isCustom ? customLabel.trim() : null,
      p_description: isCustom ? customDesc.trim() || null : null,
      p_proposer_side: effectiveMySide,
      p_proposer_stake: myStake,
      p_opponent_side: effectiveOpponentSide,
      p_opponent_stake: opponentStake,
      p_invited_user_id: invitedUserId || null,
    })

    if (rpcErr) {
      setError(rpcErr.message)
      setSubmitting(false)
      return
    }

    onProposed()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-card text-card-ink border border-border rounded-2xl w-full max-w-md p-5 sm:p-6 my-8 shadow-xl"
      >
        <header className="mb-4">
          <p className="text-[11px] uppercase tracking-wide font-bold text-text-muted">{t.sidebets.proposeFor}</p>
          <h2 className="text-lg font-bold text-dark">{t1Name} <span className="text-text-muted">{t.sidebets.vs}</span> {t2Name}</h2>
          <p className="text-xs text-text-muted mt-1">{fmtKickoff(match.kickoff_at)} · {match.ground || ''}</p>
        </header>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{t.sidebets.pickTemplate}</span>
            <select
              value={templateKey}
              onChange={e => { setTemplateKey(e.target.value); setMySide('') }}
              className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              {eligibleTemplates.map(t2 => (
                <option key={t2.id} value={t2.key}>{applyTokens(t2.label, t1Name, t2Name)}</option>
              ))}
            </select>
            {template?.description && !isCustom && (
              <span className="text-[11px] text-text-muted">{template.description}</span>
            )}
          </label>

          {isCustom && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">{t.sidebets.customLabelPlaceholder}</span>
                <input
                  type="text"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">{t.sidebets.customDescriptionPlaceholder}</span>
                <textarea
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                  rows={2}
                  className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </label>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            {[[sideAValue, sideALabel], [sideBValue, sideBLabel]].map(([val, label]) => {
              const active = effectiveMySide === val
              return (
                <button
                  type="button"
                  key={val}
                  onClick={() => setMySide(val)}
                  className={`text-sm font-semibold px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    active ? 'bg-primary text-white border-primary' : 'bg-bg border-border text-dark hover:border-primary/40'
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wide opacity-80">{t.sidebets.mySide}</span>
                  {label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">{t.sidebets.myStake}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={myStake}
                onChange={e => setMyStake(Number(e.target.value))}
                className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <span className="text-[11px] text-text-muted">max {fmtTokens(myTokens)}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">{t.sidebets.opponentStake}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={opponentStake}
                onChange={e => setOpponentStake(Number(e.target.value))}
                className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <span className="text-[11px] text-text-muted">{effectiveOpponentLabel}</span>
            </label>
          </div>

          <div className="bg-bg border border-border rounded-md px-3 py-2 text-xs text-text-secondary">
            <span className="font-semibold text-dark">{fmtTokens(myStake)}</span> ({effectiveMyLabel})
            {' '}vs{' '}
            <span className="font-semibold text-dark">{fmtTokens(opponentStake)}</span> ({effectiveOpponentLabel})
            {' · '}{t.sidebets.pot}: <span className="font-semibold text-dark">{fmtTokens(myStake + opponentStake)}</span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">{t.sidebets.targetFriend}</span>
            <select
              value={invitedUserId}
              onChange={e => setInvitedUserId(e.target.value)}
              className="bg-bg border border-border rounded-md px-2 py-2 text-sm text-dark cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="">{t.sidebets.openToAll}</option>
              {otherProfiles.map(p => (
                <option key={p.user_id} value={p.user_id}>{p.display_name || '—'}</option>
              ))}
            </select>
          </label>

          {error && (
            <p className="text-xs text-no bg-no-light border border-no/20 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-dark px-3 py-2 cursor-pointer"
          >
            {t.sidebets.cancelBtn}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? t.sidebets.submitting : t.sidebets.submit}
          </button>
        </div>
      </form>
    </div>
  )
}
