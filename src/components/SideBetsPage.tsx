import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { t, fmtTokens, fmtKickoff } from '../lib/i18n'
import type { Match, Profile, SideBet, SideBetTemplate, Team } from '../lib/database.types'
import { SideBetProposeModal } from './SideBetProposeModal'

interface SideBetsPageProps {
  userId: string
  myTokens: number
  matches: Match[]
  teams: Team[]
  templates: SideBetTemplate[]
  sideBets: SideBet[]
  profiles: Profile[]
  onChanged: () => void
}

function teamLabel(match: Match, slot: 'team1' | 'team2', teams: Team[]) {
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

function betTitle(bet: SideBet, match: Match | undefined, teams: Team[], template?: SideBetTemplate) {
  if (!match) return bet.custom_label || '—'
  const t1 = teamLabel(match, 'team1', teams)
  const t2 = teamLabel(match, 'team2', teams)
  if (bet.custom_label) return applyTokens(bet.custom_label, t1, t2)
  if (template) return applyTokens(template.label, t1, t2)
  return '—'
}

function readableSide(value: string, match: Match | undefined, teams: Team[]) {
  if (!match) return value
  const t1 = teamLabel(match, 'team1', teams)
  const t2 = teamLabel(match, 'team2', teams)
  return applyTokens(value, t1, t2)
}

interface BetCardProps {
  bet: SideBet
  match: Match | undefined
  teams: Team[]
  template?: SideBetTemplate
  userId: string
  now: number
  onAccept?: () => void
  onCancel?: () => void
  busy?: boolean
}

function BetCard({ bet, match, teams, template, userId, now, onAccept, onCancel, busy }: BetCardProps) {
  const myProposer = bet.proposer_id === userId
  const myOpponent = bet.opponent_id === userId
  const mySide = myProposer ? bet.proposer_side : myOpponent ? bet.opponent_side : null
  const myStake = myProposer ? bet.proposer_stake : myOpponent ? bet.opponent_stake : null
  const matchKickedOff = match ? new Date(match.kickoff_at).getTime() <= now : false

  const proposerSideLabel = readableSide(bet.proposer_side, match, teams)
  const opponentSideLabel = readableSide(bet.opponent_side, match, teams)

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-text-muted">
            {match ? `${teamLabel(match, 'team1', teams)} ${t.sidebets.vs} ${teamLabel(match, 'team2', teams)}` : '—'}
          </p>
          <h3 className="text-sm font-semibold text-dark mt-0.5">{betTitle(bet, match, teams, template)}</h3>
          {bet.description && <p className="text-xs text-text-muted mt-1">{bet.description}</p>}
        </div>
        <div className="text-right shrink-0">
          {bet.status === 'open' && <span className="text-[10px] uppercase tracking-wide font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">open</span>}
          {bet.status === 'accepted' && <span className="text-[10px] uppercase tracking-wide font-bold text-yes bg-yes-light px-2 py-0.5 rounded">{t.sidebets.accepted}</span>}
          {bet.status === 'cancelled' && <span className="text-[10px] uppercase tracking-wide font-bold text-text-muted bg-bg px-2 py-0.5 rounded">{t.sidebets.cancelled}</span>}
          {bet.status === 'resolved' && <span className="text-[10px] uppercase tracking-wide font-bold text-text-secondary bg-bg px-2 py-0.5 rounded">{t.sidebets.resolved}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-bg rounded-md px-3 py-2">
          <p className="text-[10px] uppercase font-bold text-text-muted">{bet.proposer_name}</p>
          <p className="text-dark font-semibold mt-0.5">{proposerSideLabel}</p>
          <p className="text-text-secondary">{fmtTokens(bet.proposer_stake)} tokens</p>
        </div>
        <div className="bg-bg rounded-md px-3 py-2">
          <p className="text-[10px] uppercase font-bold text-text-muted">
            {bet.opponent_name || (bet.invited_user_id ? t.sidebets.invited : t.sidebets.waitingForOpponent)}
          </p>
          <p className="text-dark font-semibold mt-0.5">{opponentSideLabel}</p>
          <p className="text-text-secondary">{fmtTokens(bet.opponent_stake)} tokens</p>
        </div>
      </div>

      {(mySide || match) && (
        <div className="text-[11px] text-text-muted flex items-center gap-2 flex-wrap">
          {match && <span>{t.sidebets.kickoff}: {fmtKickoff(match.kickoff_at)}</span>}
          {bet.status === 'resolved' && bet.outcome && (
            <span className="font-semibold">
              · {bet.outcome === 'push'
                ? t.sidebets.pushed
                : (bet.outcome === 'proposer' ? bet.proposer_id === userId : bet.opponent_id === userId)
                  ? t.sidebets.won
                  : t.sidebets.lost}
            </span>
          )}
          {myStake !== null && bet.status === 'accepted' && (
            <span className="font-semibold">· {t.sidebets.youVs}: {fmtTokens(myStake)} tokens</span>
          )}
        </div>
      )}

      {(onAccept || onCancel) && !matchKickedOff && bet.status === 'open' && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border mt-1">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={busy}
              className="text-xs text-text-muted hover:text-dark px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              {t.sidebets.cancel}
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              disabled={busy}
              className="bg-yes hover:bg-yes-hover text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-50"
            >
              {t.sidebets.accept}
            </button>
          )}
        </div>
      )}

      {matchKickedOff && (bet.status === 'open' || bet.status === 'accepted') && (
        <p className="text-[11px] text-text-muted italic border-t border-border pt-1">{t.sidebets.matchKickedOff}</p>
      )}
    </div>
  )
}

export function SideBetsPage({
  userId, myTokens, matches, teams, templates, sideBets, profiles, onChanged,
}: SideBetsPageProps) {
  const [proposeMatch, setProposeMatch] = useState<Match | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const matchById = useMemo(() => {
    const m = new Map<string, Match>()
    for (const x of matches) m.set(x.id, x)
    return m
  }, [matches])
  const templateById = useMemo(() => {
    const m = new Map<string, SideBetTemplate>()
    for (const x of templates) m.set(x.id, x)
    return m
  }, [templates])

  const upcoming = useMemo(() => matches
    .filter(m => new Date(m.kickoff_at).getTime() > now)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()),
  [matches, now])

  const upcomingByDate = useMemo(() => {
    const groups = new Map<string, { label: string; key: string; matches: typeof upcoming }>()
    const fmt = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
    for (const m of upcoming) {
      const d = new Date(m.kickoff_at)
      const key = d.toISOString().slice(0, 10)
      const existing = groups.get(key)
      if (existing) existing.matches.push(m)
      else groups.set(key, { key, label: fmt.format(d), matches: [m] })
    }
    return [...groups.values()]
  }, [upcoming])

  const challenges = sideBets.filter(b => b.status === 'open' && b.invited_user_id === userId)
  const myActive = sideBets.filter(b =>
    (b.proposer_id === userId || b.opponent_id === userId) && (b.status === 'open' || b.status === 'accepted')
  )
  const history = sideBets.filter(b =>
    (b.proposer_id === userId || b.opponent_id === userId) && (b.status === 'resolved' || b.status === 'cancelled')
  ).slice(0, 10)

  const accept = async (id: string) => {
    setBusyId(id)
    setError(null)
    const { error: e } = await supabase.rpc('accept_side_bet', { p_bet_id: id })
    if (e) setError(e.message)
    else onChanged()
    setBusyId(null)
  }

  const cancel = async (id: string) => {
    setBusyId(id)
    setError(null)
    const { error: e } = await supabase.rpc('cancel_side_bet', { p_bet_id: id })
    if (e) setError(e.message)
    else onChanged()
    setBusyId(null)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-dark">{t.sidebets.pageTitle}</h1>
        <p className="text-sm text-text-secondary mt-1">{t.sidebets.pageSubtitle}</p>
      </div>

      {myTokens === 0 && myActive.length === 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary">
          {t.sidebets.noTokensWarning}
        </div>
      )}

      {error && (
        <div className="bg-no-light border border-no/20 text-no rounded-lg px-4 py-2 text-sm">{error}</div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-dark mb-3">{t.sidebets.challenges}</h2>
        {challenges.length === 0 ? (
          <p className="text-xs text-text-muted">{t.sidebets.noChallenges}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {challenges.map(b => (
              <BetCard
                key={b.id}
                bet={b}
                match={matchById.get(b.match_id)}
                teams={teams}
                template={b.template_id ? templateById.get(b.template_id) : undefined}
                userId={userId}
                now={now}
                onAccept={() => accept(b.id)}
                busy={busyId === b.id}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-dark mb-3">{t.sidebets.active}</h2>
        {myActive.length === 0 ? (
          <p className="text-xs text-text-muted">{t.sidebets.noActive}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myActive.map(b => (
              <BetCard
                key={b.id}
                bet={b}
                match={matchById.get(b.match_id)}
                teams={teams}
                template={b.template_id ? templateById.get(b.template_id) : undefined}
                userId={userId}
                now={now}
                onCancel={b.proposer_id === userId && b.status === 'open' ? () => cancel(b.id) : undefined}
                busy={busyId === b.id}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold text-dark">{t.sidebets.upcoming}</h2>
          {upcoming.length > 0 && (
            <span className="text-xs text-text-muted">{upcoming.length}</span>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-xs text-text-muted">{t.sidebets.noUpcoming}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {upcomingByDate.map(group => (
              <div key={group.key} className="flex flex-col gap-2">
                <h3 className="text-[11px] uppercase tracking-wide font-semibold text-text-muted sticky top-14 bg-bg/80 backdrop-blur-sm py-1 -mx-1 px-1 z-10">
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.matches.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setProposeMatch(m)}
                      className="text-left bg-card border border-border hover:border-primary/40 rounded-xl p-4 cursor-pointer transition-colors flex flex-col gap-1"
                    >
                      <p className="text-[11px] text-text-muted uppercase tracking-wide">{m.round}</p>
                      <p className="text-sm font-semibold text-dark">
                        {teamLabel(m, 'team1', teams)} <span className="text-text-muted">{t.sidebets.vs}</span> {teamLabel(m, 'team2', teams)}
                      </p>
                      <p className="text-[11px] text-text-muted mt-1">{fmtKickoff(m.kickoff_at)} · {m.ground || ''}</p>
                      <span className="self-end mt-2 text-[11px] font-semibold text-primary">{t.sidebets.propose} →</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-dark mb-3">{t.sidebets.history}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {history.map(b => (
              <BetCard
                key={b.id}
                bet={b}
                match={matchById.get(b.match_id)}
                teams={teams}
                template={b.template_id ? templateById.get(b.template_id) : undefined}
                userId={userId}
                now={now}
              />
            ))}
          </div>
        </section>
      )}

      {proposeMatch && (
        <SideBetProposeModal
          match={proposeMatch}
          teams={teams}
          templates={templates}
          profiles={profiles}
          currentUserId={userId}
          myTokens={myTokens}
          onClose={() => setProposeMatch(null)}
          onProposed={onChanged}
        />
      )}
    </div>
  )
}
