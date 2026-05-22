import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ADMIN_USER_ID } from './lib/constants'
import type {
  AppState,
  Match,
  MatchPrediction,
  Profile,
  SideBet,
  SideBetTemplate,
  Team,
  TournamentPrediction,
  TournamentResult,
} from './lib/database.types'
import { Header, type Page } from './components/Header'
import { LoginScreen } from './components/LoginScreen'
import { DisplayNameForm } from './components/DisplayNameForm'
import { PredictionsPage } from './components/PredictionsPage'
import { AllPredictionsView } from './components/AllPredictionsView'
import { SideBetsPage } from './components/SideBetsPage'
import { Leaderboard } from './components/Leaderboard'
import { AdminPanel } from './components/AdminPanel'

interface AppData {
  profile: Profile | null
  profiles: Profile[]
  appState: AppState | null
  teams: Team[]
  matches: Match[]
  templates: SideBetTemplate[]
  tournamentPredictions: TournamentPrediction[]
  matchPredictions: MatchPrediction[]
  tournamentResults: TournamentResult[]
  sideBets: SideBet[]
}

const EMPTY_DATA: AppData = {
  profile: null,
  profiles: [],
  appState: null,
  teams: [],
  matches: [],
  templates: [],
  tournamentPredictions: [],
  matchPredictions: [],
  tournamentResults: [],
  sideBets: [],
}

async function loadAllData(userId: string): Promise<AppData> {
  const baseRes = await Promise.all([
    supabase.rpc('init_profile', { p_user_id: userId }),
    supabase.from('profiles').select('*'),
    supabase.from('app_state').select('*').eq('id', 1).maybeSingle(),
    supabase.from('teams').select('*').order('name'),
    supabase.from('matches').select('*').order('kickoff_at'),
    supabase.from('side_bet_templates').select('*').order('category'),
    supabase.from('tournament_results').select('*'),
    supabase.from('side_bets').select('*').order('created_at', { ascending: false }).limit(200),
  ])
  const [profileRes, profilesRes, appStateRes, teamsRes, matchesRes, templatesRes, trRes, sbRes] = baseRes
  const appState = (appStateRes.data as AppState | null) ?? null
  const locked = appState?.predictions_locked ?? false

  const tpQuery = supabase.from('tournament_predictions').select('*')
  const mpQuery = supabase.from('match_predictions').select('*')
  const [tpRes, mpRes] = await Promise.all([
    locked ? tpQuery : tpQuery.eq('user_id', userId),
    locked ? mpQuery : mpQuery.eq('user_id', userId),
  ])

  return {
    profile: (profileRes.data as Profile | null) ?? null,
    profiles: (profilesRes.data as Profile[]) ?? [],
    appState,
    teams: (teamsRes.data as Team[]) ?? [],
    matches: (matchesRes.data as Match[]) ?? [],
    templates: (templatesRes.data as SideBetTemplate[]) ?? [],
    tournamentPredictions: (tpRes.data as TournamentPrediction[]) ?? [],
    matchPredictions: (mpRes.data as MatchPrediction[]) ?? [],
    tournamentResults: (trRes.data as TournamentResult[]) ?? [],
    sideBets: (sbRes.data as SideBet[]) ?? [],
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [data, setData] = useState<AppData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Page>('predictions')
  const [predictionsView, setPredictionsView] = useState<'mine' | 'others'>('others')
  const [showAdmin, setShowAdmin] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    loadAllData(session.user.id).then(result => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [session, refreshKey])

  useEffect(() => {
    if (!session) return

    const profilesChannel = supabase
      .channel('profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        if (payload.eventType === 'INSERT') {
          const next = payload.new as Profile
          setData(d => ({ ...d, profiles: [...d.profiles.filter(p => p.user_id !== next.user_id), next] }))
        } else if (payload.eventType === 'UPDATE') {
          const next = payload.new as Profile
          setData(d => ({
            ...d,
            profiles: d.profiles.map(p => p.user_id === next.user_id ? next : p),
            profile: d.profile && d.profile.user_id === next.user_id ? next : d.profile,
          }))
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as Profile
          setData(d => ({ ...d, profiles: d.profiles.filter(p => p.user_id !== old.user_id) }))
        }
      })
      .subscribe()

    const sideBetsChannel = supabase
      .channel('side-bets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'side_bets' }, payload => {
        if (payload.eventType === 'INSERT') {
          const next = payload.new as SideBet
          setData(d => ({ ...d, sideBets: [next, ...d.sideBets.filter(b => b.id !== next.id)].slice(0, 200) }))
        } else if (payload.eventType === 'UPDATE') {
          const next = payload.new as SideBet
          setData(d => ({ ...d, sideBets: d.sideBets.map(b => b.id === next.id ? next : b) }))
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as SideBet
          setData(d => ({ ...d, sideBets: d.sideBets.filter(b => b.id !== old.id) }))
        }
      })
      .subscribe()

    const matchesChannel = supabase
      .channel('matches-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        const next = payload.new as Match
        setData(d => ({ ...d, matches: d.matches.map(m => m.id === next.id ? next : m) }))
      })
      .subscribe()

    const appStateChannel = supabase
      .channel('app-state-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state' }, payload => {
        const next = payload.new as AppState
        setData(d => {
          const lockChanged = (d.appState?.predictions_locked ?? false) !== next.predictions_locked
          if (lockChanged) setRefreshKey(k => k + 1)
          return { ...d, appState: next }
        })
      })
      .subscribe()

    const matchPredsChannel = supabase
      .channel('match-predictions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_predictions' }, payload => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as MatchPrediction
          setData(d => ({ ...d, matchPredictions: d.matchPredictions.filter(p => p.id !== old.id) }))
        } else {
          const next = payload.new as MatchPrediction
          setData(d => ({
            ...d,
            matchPredictions: [...d.matchPredictions.filter(p => p.id !== next.id), next],
          }))
        }
      })
      .subscribe()

    const tournamentPredsChannel = supabase
      .channel('tournament-predictions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_predictions' }, payload => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as TournamentPrediction
          setData(d => ({ ...d, tournamentPredictions: d.tournamentPredictions.filter(p => p.id !== old.id) }))
        } else {
          const next = payload.new as TournamentPrediction
          setData(d => ({
            ...d,
            tournamentPredictions: [...d.tournamentPredictions.filter(p => p.id !== next.id), next],
          }))
        }
      })
      .subscribe()

    const tournamentResultsChannel = supabase
      .channel('tournament-results-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_results' }, payload => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as TournamentResult
          setData(d => ({ ...d, tournamentResults: d.tournamentResults.filter(r => r.prediction_type !== old.prediction_type) }))
        } else {
          const next = payload.new as TournamentResult
          setData(d => ({
            ...d,
            tournamentResults: [...d.tournamentResults.filter(r => r.prediction_type !== next.prediction_type), next],
          }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(profilesChannel)
      supabase.removeChannel(sideBetsChannel)
      supabase.removeChannel(matchesChannel)
      supabase.removeChannel(appStateChannel)
      supabase.removeChannel(tournamentResultsChannel)
      supabase.removeChannel(matchPredsChannel)
      supabase.removeChannel(tournamentPredsChannel)
    }
  }, [session])

  const handleLogout = () => { supabase.auth.signOut() }
  const handleRefresh = () => setRefreshKey(k => k + 1)

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <LoginScreen onLoggedIn={() => {}} />

  if (!loading && data.profile && !data.profile.display_name) {
    return <DisplayNameForm userId={session.user.id} onSaved={handleRefresh} />
  }

  if (loading || !data.profile) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  const username = data.profile.display_name || session.user.email?.split('@')[0] || 'Speler'
  const isAdmin = session.user.id === ADMIN_USER_ID
  const tokens = Number(data.profile.tokens)
  const points = data.profile.prediction_points
  const locked = data.appState?.predictions_locked ?? false

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Header
        tokens={tokens}
        predictionPoints={points}
        username={username}
        isAdmin={isAdmin}
        showAdmin={showAdmin}
        page={page}
        onPageChange={p => { setPage(p); setShowAdmin(false) }}
        onToggleAdmin={() => setShowAdmin(s => !s)}
        onLogout={handleLogout}
      />

      <main className="flex-1 pb-12 sm:pb-0">
        {showAdmin && isAdmin ? (
          <AdminPanel
            profiles={data.profiles}
            appState={data.appState}
            sideBets={data.sideBets}
            teams={data.teams}
            tournamentResults={data.tournamentResults}
            onChanged={handleRefresh}
          />
        ) : page === 'predictions' ? (
          locked && predictionsView === 'others' ? (
            <AllPredictionsView
              currentUserId={session.user.id}
              profiles={data.profiles}
              teams={data.teams}
              matches={data.matches}
              matchPredictions={data.matchPredictions}
              tournamentPredictions={data.tournamentPredictions}
              tournamentResults={data.tournamentResults}
              onSwitchToMine={() => setPredictionsView('mine')}
            />
          ) : (
            <PredictionsPage
              userId={session.user.id}
              profiles={data.profiles}
              appState={data.appState}
              teams={data.teams}
              matches={data.matches}
              tournamentPredictions={data.tournamentPredictions}
              matchPredictions={data.matchPredictions}
              onSaved={handleRefresh}
              onSwitchToOthers={locked ? () => setPredictionsView('others') : undefined}
            />
          )
        ) : page === 'sidebets' ? (
          <SideBetsPage
            userId={session.user.id}
            myTokens={tokens}
            matches={data.matches}
            teams={data.teams}
            templates={data.templates}
            sideBets={data.sideBets}
            profiles={data.profiles}
            onChanged={handleRefresh}
          />
        ) : (
          <Leaderboard profiles={data.profiles} currentUserId={session.user.id} />
        )}
      </main>
    </div>
  )
}

export default App
