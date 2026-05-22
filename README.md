# WK 2026 Voorspelpool

A small Dutch-language World Cup 2026 prediction app for a friend group, built on top of the Cursor + React + Vite + Supabase boilerplate from the previous Landalf Stock Market project.

## What it does

- **Mijn Voorspellingen** — voorspel **per individuele wedstrijd** een eindstand (90 minuten, géén penalties). Naast elk groepje van 6 wedstrijden draait een live virtuele groepsstand mee. Daarnaast: onderscheidingen (winnaar, runner-up, top scorer, gouden bal, ...), totalen met proximity-scoring, en ja/nee drama-vinkjes. Bulk save via een sticky onderbalk die verschijnt zodra iets dirty is.
- **Pool sluiten** — admin sluit de pool met één knop. Daarna kan niemand meer wijzigen, en zien alle spelers elkaars voorspellingen voor de huidige of eerstvolgende wedstrijd in een groot scoreboard met landenvlaggen en boost-markers.
- **Boosts (⚡)** — 3 boosts per fase (groep / R32 / R16 / kwart / halve / finale). Een boost verdubbelt je punten op die ene wedstrijd. Toggle vóór de aftrap.
- **Onderlinge Weddenschappen** — peer-to-peer side bets met **asymmetrische inzet**. Kies een premade lol-weddenschap (of schrijf zelf een), kies je kant, zet je eigen inzet én die van je tegenstander (offer dus rustig "200 vs 100" odds). Optioneel target je een specifieke vriend of open je het voor iedereen.
- **Klassement** — twee kolommen. Hoofdpoule rankt op voorspellingspunten (winnaar pakt de EUR-pot). Tokens rankt op token-saldo (side bets).
- **Prijzenpot banner** — totale EUR-pot (`paid_in × €15`), huidige leider, top 3, flipt naar "Winnaar" zodra admin de toernooiwinnaar zet.

## Scoring (per wedstrijd, 90 minuten)

| Component | Punten |
|-----------|--------|
| Juiste winnaar / gelijkspel | +4 |
| Correct doelsaldo | +2 |
| Exact aantal goals per team | +1 per team |
| Exacte score-bonus | +2 |
| **Totaal max in groepsfase** | **10** |

Stage-multipliers: groep 1× · R32 1,25× · achtste 1,5× · kwart 2× · halve 2,5× · finale 3×. Boost stapelt daar bovenop met ×2.

Onderscheidingen: winnaar 25 · runner-up 15 · 3e/4e plek 8 (4 troostpunten als je voorspelde team in elk geval halve finalist werd). Topscorer 15. Beste speler / jongere / keeper 10.

Totalen: proximity scoring — exact 15 · binnen 2 = 12 · binnen 5 = 8 · binnen 10 = 4.

Drama yes/no: goed 5, fout 0.

Volledige uitleg + Supabase-implementatie staat in [SUPABASE.md](SUPABASE.md#scoring-system).

## Currencies

- **Voorspellingspunten** — verdiend met je voorspellingen, bepaalt wie de EUR-pot wint.
- **Tokens** — alleen voor side bets. **Iedereen start op 0.** Betaal Usama €15 irl, hij topt je tokens bij via het admin-paneel.

## Tech stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4
- Supabase (Postgres + magic-link auth + realtime + RLS)

## Setup

```bash
npm install
```

Drop your Supabase credentials into `.env`:

```
VITE_SUPABASE_URL=https://adeactqablfksthhkbay.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
DATABASE_URL=postgresql://postgres:<password>@db.adeactqablfksthhkbay.supabase.co:5432/postgres
```

Apply the schema and seed the World Cup data (one time):

```bash
npm run apply-schema      # supabase/worldcup_schema.sql
npm run apply-scoring     # supabase/scoring.sql (boost + scoring RPCs)
npm run apply-lock        # supabase/lock-predictions.sql (global pool lock + tightened RLS)
npm run seed-worldcup     # fetches openfootball/worldcup.json (2026)
```

All scripts are idempotent.

## Develop

```bash
npm run dev          # vite dev server
npm run build        # tsc + vite build
npm run lint-fix     # eslint --fix
```

## Layout

| Path | Purpose |
|------|---------|
| `src/lib/i18n.ts` | All Dutch UI copy + EUR/token formatters |
| `src/lib/scoring.ts` | Stage / multiplier / boost-counting helpers |
| `src/App.tsx` | Auth, data loading, three-page router |
| `src/components/PredictionsPage.tsx` | Main prediction form + sticky save (read-only when pool is locked) |
| `src/components/GroupMatchesSection.tsx` | One group's 6 match score inputs + live virtual standings + boost ⚡ |
| `src/components/AllPredictionsView.tsx` | Locked-pool scoreboard: every player's prediction for the current/next match, with country flags and boost markers |
| `src/components/ScoringLegend.tsx` | Collapsible scoring explainer |
| `src/components/SideBetsPage.tsx` | Side bets + propose modal |
| `src/components/PrizePotBanner.tsx` | Prize-pot card with leader and top 3 |
| `src/components/AdminPanel.tsx` | Lock pool, topup tokens, mark paid, set winner, set tournament results, recompute scores |
| `supabase/worldcup_schema.sql` | Full schema, RLS, RPCs, realtime publication |
| `supabase/scoring.sql` | Scoring layer: boost column, tournament_results, helper functions, `score_predictions()` |
| `supabase/lock-predictions.sql` | Global lock + RLS: predictions are private until admin closes the pool |
| `scripts/seed-worldcup.mjs` | Seed teams + matches + side-bet templates |

See [SUPABASE.md](SUPABASE.md) for the full database & RPC reference.

## Live scores

Niet aangesloten. Schema staat klaar (elke score-kolom op `matches` is nullable). Zodra de API er is, hoort een ingestion worker:

1. De API match-id te matchen tegen `matches.external_id`.
2. Score / kaarten / status / `finished_at` bij te werken (90-minuten score in `team1_score` / `team2_score`, eventuele extra tijd / penalties in de et / pen kolommen).
3. Voor afgelopen wedstrijden `resolve_side_bet(bet_id, outcome)` te roepen.
4. `score_predictions()` te triggeren zodat `profiles.prediction_points` bijwerkt en het klassement / prijzenpot live mee verandert.
