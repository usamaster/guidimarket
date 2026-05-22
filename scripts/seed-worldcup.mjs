import { readFileSync } from 'node:fs'
import pg from 'pg'

const SRC_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

const FLAGS = {
  Mexico: { emoji: '🇲🇽', code: 'MEX' },
  'South Africa': { emoji: '🇿🇦', code: 'RSA' },
  'South Korea': { emoji: '🇰🇷', code: 'KOR' },
  'Czech Republic': { emoji: '🇨🇿', code: 'CZE' },
  Canada: { emoji: '🇨🇦', code: 'CAN' },
  'Bosnia & Herzegovina': { emoji: '🇧🇦', code: 'BIH' },
  Qatar: { emoji: '🇶🇦', code: 'QAT' },
  Switzerland: { emoji: '🇨🇭', code: 'SUI' },
  Brazil: { emoji: '🇧🇷', code: 'BRA' },
  Morocco: { emoji: '🇲🇦', code: 'MAR' },
  Haiti: { emoji: '🇭🇹', code: 'HAI' },
  Scotland: { emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', code: 'SCO' },
  USA: { emoji: '🇺🇸', code: 'USA' },
  Paraguay: { emoji: '🇵🇾', code: 'PAR' },
  Australia: { emoji: '🇦🇺', code: 'AUS' },
  Turkey: { emoji: '🇹🇷', code: 'TUR' },
  Germany: { emoji: '🇩🇪', code: 'GER' },
  'Curaçao': { emoji: '🇨🇼', code: 'CUW' },
  'Ivory Coast': { emoji: '🇨🇮', code: 'CIV' },
  Ecuador: { emoji: '🇪🇨', code: 'ECU' },
  Netherlands: { emoji: '🇳🇱', code: 'NED' },
  Japan: { emoji: '🇯🇵', code: 'JPN' },
  Sweden: { emoji: '🇸🇪', code: 'SWE' },
  Tunisia: { emoji: '🇹🇳', code: 'TUN' },
  Belgium: { emoji: '🇧🇪', code: 'BEL' },
  Egypt: { emoji: '🇪🇬', code: 'EGY' },
  Iran: { emoji: '🇮🇷', code: 'IRN' },
  'New Zealand': { emoji: '🇳🇿', code: 'NZL' },
  Spain: { emoji: '🇪🇸', code: 'ESP' },
  'Cape Verde': { emoji: '🇨🇻', code: 'CPV' },
  'Saudi Arabia': { emoji: '🇸🇦', code: 'KSA' },
  Uruguay: { emoji: '🇺🇾', code: 'URU' },
  France: { emoji: '🇫🇷', code: 'FRA' },
  Senegal: { emoji: '🇸🇳', code: 'SEN' },
  Iraq: { emoji: '🇮🇶', code: 'IRQ' },
  Norway: { emoji: '🇳🇴', code: 'NOR' },
  Argentina: { emoji: '🇦🇷', code: 'ARG' },
  Algeria: { emoji: '🇩🇿', code: 'ALG' },
  Austria: { emoji: '🇦🇹', code: 'AUT' },
  Jordan: { emoji: '🇯🇴', code: 'JOR' },
  Portugal: { emoji: '🇵🇹', code: 'POR' },
  'DR Congo': { emoji: '🇨🇩', code: 'COD' },
  Uzbekistan: { emoji: '🇺🇿', code: 'UZB' },
  Colombia: { emoji: '🇨🇴', code: 'COL' },
  England: { emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', code: 'ENG' },
  Croatia: { emoji: '🇭🇷', code: 'CRO' },
  Ghana: { emoji: '🇬🇭', code: 'GHA' },
  Panama: { emoji: '🇵🇦', code: 'PAN' },
}

const SIDE_BET_TEMPLATES = [
  { key: 'goals_over_2_5', label: 'Meer dan 2,5 doelpunten', description: 'Eindscore telt minstens 3 doelpunten samen.', category: 'goals', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'goals_over_1_5', label: 'Meer dan 1,5 doelpunten', description: 'Er vallen minstens 2 doelpunten in deze wedstrijd.', category: 'goals', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'goals_under_2_5', label: 'Minder dan 2,5 doelpunten', description: 'Hooguit 2 doelpunten samen.', category: 'goals', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'btts', label: 'Beide teams scoren', description: 'Allebei de teams scoren minstens één keer.', category: 'goals', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'team1_wins', label: '{team1} wint', description: 'Reguliere speeltijd; gelijkspel telt als verlies.', category: 'result', applies_to_stage: 'any', side_a_label: '{team1}', side_b_label: 'niet {team1}' },
  { key: 'team2_wins', label: '{team2} wint', description: 'Reguliere speeltijd; gelijkspel telt als verlies.', category: 'result', applies_to_stage: 'any', side_a_label: '{team2}', side_b_label: 'niet {team2}' },
  { key: 'draw', label: 'Wedstrijd eindigt gelijk', description: 'Reguliere speeltijd eindigt gelijk.', category: 'result', applies_to_stage: 'group', side_a_label: 'gelijk', side_b_label: 'beslist' },
  { key: 'team1_wins_by_2', label: '{team1} wint met 2+ verschil', description: 'Verschil van minstens 2 doelpunten.', category: 'result', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'red_card', label: 'Rode kaart valt', description: 'Iemand pakt rood (direct of na 2x geel).', category: 'cards', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'yellows_5plus', label: '5 of meer gele kaarten', description: 'Tikkie veel kaarten dus.', category: 'cards', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'penalty', label: 'Strafschop wordt toegekend', description: 'In reguliere speeltijd of verlenging.', category: 'drama', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'extra_time', label: 'Wedstrijd gaat naar verlenging', description: 'Alleen knockout-wedstrijden.', category: 'drama', applies_to_stage: 'knockout', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'goalless_first_half', label: '0-0 bij rust', description: 'Geen doelpunten in de eerste helft.', category: 'goals', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'hat_trick', label: 'Een speler scoort een hattrick', description: 'Drie of meer goals door één speler.', category: 'drama', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'comeback', label: 'Team dat achterstaat bij rust wint alsnog', description: 'Echte comeback, niet alleen gelijk.', category: 'drama', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'clean_sheet_t1', label: '{team1} houdt de nul', description: 'Tegenstander scoort niet in reguliere speeltijd.', category: 'result', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'clean_sheet_t2', label: '{team2} houdt de nul', description: 'Tegenstander scoort niet in reguliere speeltijd.', category: 'result', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
  { key: 'vibes_check', label: 'Eigen weddenschap', description: 'Vrije tekst voor wat je maar wilt voorspellen.', category: 'drama', applies_to_stage: 'any', side_a_label: 'ja', side_b_label: 'nee' },
]

function parseKickoff(date, time) {
  const m = /^(\d{2}):(\d{2})\s+UTC([+-]\d+)$/.exec(time.trim())
  if (!m) throw new Error(`bad time format: "${time}"`)
  const [, hh, mm, off] = m
  const offNum = parseInt(off, 10)
  const sign = offNum >= 0 ? '+' : '-'
  const abs = Math.abs(offNum).toString().padStart(2, '0')
  return new Date(`${date}T${hh}:${mm}:00${sign}${abs}:00`).toISOString()
}

function classifyStage(round) {
  return round.startsWith('Matchday') ? 'group' : 'knockout'
}

function looksLikeTeam(s) {
  return Boolean(s) && Object.prototype.hasOwnProperty.call(FLAGS, s)
}

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('Set DATABASE_URL in .env (Supabase → Settings → Database → Connection string).')
    process.exit(1)
  }

  let raw
  try {
    const res = await fetch(SRC_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    raw = await res.json()
  } catch (e) {
    console.error('Failed to fetch openfootball JSON, falling back to local copy.', e)
    raw = JSON.parse(readFileSync(new URL('./worldcup-2026.fallback.json', import.meta.url), 'utf8'))
  }

  const matches = raw.matches
  const groupByTeam = {}
  for (const m of matches) {
    if (!m.group) continue
    const letter = m.group.replace('Group ', '').trim()
    if (looksLikeTeam(m.team1)) groupByTeam[m.team1] = letter
    if (looksLikeTeam(m.team2)) groupByTeam[m.team2] = letter
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected.')

  try {
    await client.query('begin')

    for (const [name, info] of Object.entries(FLAGS)) {
      const letter = groupByTeam[name] || null
      await client.query(
        `insert into public.teams (name, fifa_code, flag_emoji, group_letter)
         values ($1, $2, $3, $4)
         on conflict (name) do update
         set fifa_code = excluded.fifa_code,
             flag_emoji = excluded.flag_emoji,
             group_letter = excluded.group_letter`,
        [name, info.code, info.emoji, letter]
      )
    }
    console.log(`Upserted ${Object.keys(FLAGS).length} teams.`)

    const teamIdByName = new Map()
    {
      const rs = await client.query('select id, name from public.teams')
      for (const r of rs.rows) teamIdByName.set(r.name, r.id)
    }

    let matchCounter = 0
    for (const m of matches) {
      const stage = classifyStage(m.round)
      const groupLetter = m.group ? m.group.replace('Group ', '').trim() : null
      const team1Id = looksLikeTeam(m.team1) ? teamIdByName.get(m.team1) : null
      const team2Id = looksLikeTeam(m.team2) ? teamIdByName.get(m.team2) : null
      const team1Placeholder = team1Id ? null : m.team1
      const team2Placeholder = team2Id ? null : m.team2
      const kickoff = parseKickoff(m.date, m.time)
      const externalId = `wc2026-${m.num ?? `g-${m.date}-${m.team1}-${m.team2}`}`

      await client.query(
        `insert into public.matches
          (external_id, round, stage, group_letter,
           team1_id, team2_id, team1_placeholder, team2_placeholder,
           kickoff_at, ground)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (external_id) do update
         set round = excluded.round,
             stage = excluded.stage,
             group_letter = excluded.group_letter,
             team1_id = excluded.team1_id,
             team2_id = excluded.team2_id,
             team1_placeholder = excluded.team1_placeholder,
             team2_placeholder = excluded.team2_placeholder,
             kickoff_at = excluded.kickoff_at,
             ground = excluded.ground`,
        [externalId, m.round, stage, groupLetter, team1Id, team2Id, team1Placeholder, team2Placeholder, kickoff, m.ground]
      )
      matchCounter += 1
    }
    console.log(`Upserted ${matchCounter} matches.`)

    for (const t of SIDE_BET_TEMPLATES) {
      await client.query(
        `insert into public.side_bet_templates
          (key, label, description, category, applies_to_stage, side_a_label, side_b_label)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (key) do update
         set label = excluded.label,
             description = excluded.description,
             category = excluded.category,
             applies_to_stage = excluded.applies_to_stage,
             side_a_label = excluded.side_a_label,
             side_b_label = excluded.side_b_label`,
        [t.key, t.label, t.description, t.category, t.applies_to_stage, t.side_a_label, t.side_b_label]
      )
    }
    console.log(`Upserted ${SIDE_BET_TEMPLATES.length} side-bet templates.`)

    await client.query('commit')
    console.log('Done.')
  } catch (e) {
    await client.query('rollback').catch(() => {})
    console.error(e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
