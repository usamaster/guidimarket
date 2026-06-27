import { createClient } from 'jsr:@supabase/supabase-js@2'

const SRC_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OpenFootballScore {
  ft?: [number, number]
  ht?: [number, number]
  et?: [number, number]
  aet?: [number, number]
  pen?: [number, number]
  p?: [number, number]
}

interface OpenFootballMatch {
  round: string
  num?: number
  date: string
  team1: string
  team2: string
  score?: OpenFootballScore
}

function externalIdOf(m: OpenFootballMatch): string {
  return `wc2026-${m.num ?? `g-${m.date}-${m.team1}-${m.team2}`}`
}

function num(v: number | undefined | null): number | null {
  return v === undefined || v === null ? null : v
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!supabaseUrl || !anonKey) {
    return new Response(JSON.stringify({ error: 'Edge Function niet geconfigureerd.' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Niet ingelogd.' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  let dryRun = false
  try {
    const body = await req.json()
    dryRun = body?.dryRun === true
  } catch {
    dryRun = false
  }

  let raw: { matches: OpenFootballMatch[] }
  try {
    const res = await fetch(SRC_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    raw = await res.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: `Kon openfootball-data niet ophalen: ${String(e)}` }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const rows = raw.matches
    .filter(m => m.score && Array.isArray(m.score.ft))
    .map(m => {
      const s = m.score as OpenFootballScore
      const et = s.et ?? s.aet ?? null
      const pen = s.pen ?? s.p ?? null
      return {
        external_id: externalIdOf(m),
        ft1: num(s.ft![0]),
        ft2: num(s.ft![1]),
        ht1: s.ht ? num(s.ht[0]) : null,
        ht2: s.ht ? num(s.ht[1]) : null,
        et1: et ? num(et[0]) : null,
        et2: et ? num(et[1]) : null,
        pen1: pen ? num(pen[0]) : null,
        pen2: pen ? num(pen[1]) : null,
      }
    })

  if (dryRun) {
    const { data, error } = await supabase.rpc('admin_preview_match_scores', { p_rows: rows })
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ preview: data ?? [], available: rows.length }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase.rpc('admin_sync_match_scores', { p_rows: rows })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ updated: data, available: rows.length }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
