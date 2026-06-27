# WK 2026 Voorspelpool — Supabase Infrastructure

## Project

- **Supabase Project Ref**: `adeactqablfksthhkbay`
- **Dashboard**: https://supabase.com/dashboard/project/adeactqablfksthhkbay
- **DB Connection**: `postgresql://postgres:<password>@db.adeactqablfksthhkbay.supabase.co:5432/postgres`
- **Auth method**: Magic link (email OTP) — no passwords
- **UI language**: Dutch (NL). All copy lives in `src/lib/i18n.ts`.

## Admin User

- **User ID**: `caec526d-d38c-462b-a585-bbd2e119ed3f`
- Hardcoded in:
  1. `src/lib/constants.ts` → `ADMIN_USER_ID` (frontend gating)
  2. `is_admin()` SQL function (server-side authorization for every `admin_*` RPC)

## Currencies (two, kept separate)

| Currency | Column | Used for | Refilled by |
|----------|--------|----------|-------------|
| Voorspellingspunten (prediction points) | `profiles.prediction_points int` | Drives the EUR prize-pot ranking | Admin / future scoring RPC |
| Tokens | `profiles.tokens numeric` | Asymmetric peer-to-peer side bets | Admin via `admin_topup_tokens` after irl payment. **Everyone starts at 0 tokens.** |

The real-money pool is tracked via `profiles.paid_in boolean`. Each user pays €15 irl; admin flips `paid_in = true` via `admin_set_paid_in(user_id, true)`. The `PrizePotBanner` shows `paid_count × buyin_eur` from `app_state.buyin_eur` (default 15).

## Database Schema

### `app_state` (single row, id = 1)

| Column | Type | Notes |
|--------|------|-------|
| id | int PK | always 1 |
| buyin_eur | numeric default 15 | shown in banner |
| main_winner_user_id | uuid nullable | flipped via admin RPC after the tournament |
| predictions_locked | bool default false | once true: writes blocked, others' predictions become readable |
| updated_at | timestamptz | |

### `profiles`

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid PK → auth.users | |
| display_name | text | Set on first login |
| tokens | numeric default 0 | Side-bet currency |
| prediction_points | int default 0 | Main-game ranking |
| paid_in | bool default false | Did they pay €15 irl? |
| created_at | timestamptz | |

### `teams`

48 teams seeded from the openfootball repo. Has `name`, `fifa_code`, `flag_emoji`, `group_letter` (A..L).

### `matches`

104 fixtures seeded from the openfootball repo. `kickoff_at` is stored in UTC. Knockout placeholders (`W101`, `2A`, etc.) live in `team1_placeholder` / `team2_placeholder` and get nulled out in favour of `team1_id` / `team2_id` once the live-score worker resolves them.

All score columns (`team1_score`, `team1_ht`, `team1_et`, `team1_pen`, `yellow_cards`, `red_cards`, ...) are nullable — populated later by the live-score worker.

### `tournament_predictions`

Flexible bag of single-row-per-`(user, prediction_type, round_locked)` predictions. `prediction_type` examples: `winner`, `runner_up`, `third`, `fourth`, `top_scorer`, `golden_ball`, `young_player`, `golden_glove`, `total_goals`, `total_red_cards`, `total_yellow_cards`, `total_penalties`, `highest_match_goals`, `host_reaches_qf`, `undefeated_team_exists`, `any_zero_zero`, `final_goes_to_et`, `hat_trick_scored`. Holds `team_id` / `string_value` / `number_value` / `bool_value` so any prediction shape fits.

`round_locked` defaults to `'pre_tournament'` and leaves room for a future `'post_group_stage'` round without a schema change.

### `group_predictions`

Per-user, per-group ranking 1..4. Unique on `(user_id, group_letter, round_locked)`.

### `match_predictions`

Per-user 90-minute score predictions for every individual match. Unique on `(user_id, match_id)`.

Columns:

- `team1_score int`, `team2_score int` — predicted 90-minute regular-time scores (no extra time, no penalties).
- `advance_team_id uuid → teams.id` — for knockout matches, who the player thinks advances (decided after ET/penalties). Worth +2 points when correct.
- `boost_applied bool default false` — when true, the match's calculated points are doubled.
- `points_awarded int`, `resolved bool`, `resolved_at timestamptz` — populated by `score_predictions()`.

### `tournament_results`

Single row per `prediction_type`. Stores the actual outcome of every tournament-level prediction so the scoring RPC can compare against it.

| Column | Type | Notes |
|--------|------|-------|
| prediction_type | text PK | matches the `prediction_type` value used in `tournament_predictions` |
| team_id | uuid → teams.id | filled for `winner` / `runner_up` / `third` / `fourth` |
| string_value | text | filled for player awards (`top_scorer`, `golden_ball`, `young_player`, `golden_glove`) |
| number_value | numeric | filled for totals (`total_goals`, `total_red_cards`, ...) |
| bool_value | bool | filled for drama yes/no questions |

## Scoring System

### Per-match (90 minutes only — penalties never count)

Base points (max 10 in the group stage):

| Component | Points |
|-----------|--------|
| Correct winner / draw | +4 |
| Correct goal difference | +2 |
| Exact team1 goals | +1 |
| Exact team2 goals | +1 |
| Exact-score bonus (team1 + team2 both right) | +2 |

Stage multiplier (applied to the base sum, then rounded to int):

| Round | Multiplier |
|-------|------------|
| Group | 1× |
| Any knockout round (R32 → Final) | 2× |

Knockout matches also award **+2 points** for correctly predicting which team advances (`match_predictions.advance_team_id`), decided on the 90′ score, then extra time, then penalties (`knockout_advancer()`). The advance bonus is added before the boost doubling.

### Boosts (`match_predictions.boost_applied`)

Two boost pools (`boost_stage_key()`): **3 in the group stage** and **3 for the entire knockout phase**. A boost doubles the match's total points (score + advance bonus). Toggleable via the `apply_boost(match_id, applied)` RPC, which:

1. Rejects if the match has already kicked off.
2. Rejects if turning a boost on would exceed 3 used boosts in that pool (`group` / `knockout`).
3. Group matches are blocked once the pool is locked; knockout matches stay boostable until each match's kickoff.
4. Upserts the `match_predictions` row.

### Tournament awards

| Prediction | Exact | Consolation (predicted team made the semis) |
|------------|-------|----------------------------------------------|
| Winner | 25 | 4 |
| Runner-up | 15 | 4 |
| Third | 8 | 4 |
| Fourth | 8 | 4 |

### Player awards (case-insensitive trim match)

| Prediction | Points |
|------------|--------|
| Topscorer | 15 |
| Beste speler / Beste jongere / Beste keeper | 10 each |

### Totals (proximity scoring)

Diff = `abs(actual − predicted)`:

| Diff | Points |
|------|--------|
| 0 | 15 |
| ≤ 2 | 12 |
| ≤ 5 | 8 |
| ≤ 10 | 4 |
| > 10 | 0 |

### Drama yes/no

Correct → 5, wrong → 0.

### Recompute (`score_predictions()`)

Admin-only RPC. Loops every player and:

1. Resets / fills `match_predictions.points_awarded` for finished matches.
2. Compares `tournament_predictions` rows against `tournament_results`, fills `points_awarded`.
3. Sums all of the above into `profiles.prediction_points`, which drives the leaderboard and the prize-pot banner.

Idempotent. Run after each ingest.

### `side_bet_templates`

Premade Dutch fun bets (see `scripts/seed-worldcup.mjs` for the list). Each row has `key`, `label`, `description`, `category` (`goals|cards|drama|result`), `applies_to_stage` (`any|group|knockout`), and the `side_a_label` / `side_b_label` strings (with `{team1}` / `{team2}` placeholders).

### `side_bets`

Asymmetric peer-to-peer bets. `proposer_stake` and `opponent_stake` are independent — a player can offer "200 vs 100" trash-talk odds. `invited_user_id` is set when targeting a specific friend, otherwise the bet is open to anyone. Status flow: `open → accepted → resolved`, or `open → cancelled`.

## RPC Functions

### Public (any authenticated user)

- `init_profile(p_user_id) → profiles` — idempotent. Inserts row with `tokens = 0`, `paid_in = false`, `display_name = email_prefix`. Called on every login.
- `apply_boost(p_match_id, p_applied) → match_predictions` — toggles `boost_applied`. Caps 3 per stage, rejects after kickoff. See **Scoring System** above.
- `propose_side_bet(p_match_id, p_template_id, p_custom_label, p_description, p_proposer_side, p_proposer_stake, p_opponent_side, p_opponent_stake, p_invited_user_id) → side_bets`
  - Verifies kickoff is in the future, sides differ, stakes are positive, proposer has tokens.
  - Atomically deducts proposer's stake.
- `accept_side_bet(p_bet_id) → side_bets`
  - Verifies bet is open, kickoff still in the future, opponent isn't the proposer, opponent has tokens, and (if `invited_user_id` is set) that the caller is the invited player.
  - Atomically deducts opponent's stake; sets `opponent_id`, `opponent_name`, `accepted_at`.
- `cancel_side_bet(p_bet_id) → side_bets`
  - Proposer-only (admin can also cancel). Refunds the proposer's stake. Status must be `open`.

### Knockout bracket (auto-advance)

Knockout matches carry a progression rule in `team1_placeholder` / `team2_placeholder`:

- `W{n}` / `L{n}` — winner / loser of match number `n` (mapped via `external_id = 'wc2026-{n}'`).
- `1{X}` / `2{X}` — winner / runner-up of group `X` (computed once all of that group's matches are finished).
- `3…` — best-third slots; filled manually by the admin (the FIFA allocation depends on the third-place combination).

`resolve_bracket()` fills every slot it can compute and **never clobbers a slot with null**, so manual assignments and overrides survive. It runs automatically via the `matches_resolve_bracket` statement-level trigger whenever a result is entered (`pg_trigger_depth()` guards recursion) — so entering a knockout result instantly populates the next round's teams. No external worker or cron needed.

- `admin_resolve_bracket() → integer` — manual re-run; returns the number of slots updated.
- `admin_set_match_teams(match_id, team1_id, team2_id) → matches` — manual slot override (best-thirds, corrections). Pass `null` to clear a slot.

### Admin only (`is_admin()` check)

- `admin_topup_tokens(user_id, amount) → profiles` — adds tokens after irl payment.
- `admin_set_paid_in(user_id, bool) → profiles` — flips €15 paid status.
- `admin_set_main_winner(user_id) → app_state` — sets the tournament winner; banner flips to "Winnaar".
- `admin_set_prediction_points(user_id, int) → profiles` — manual override (mostly obsolete — use `score_predictions()`).
- `admin_set_tournament_result(p_type, p_team_id, p_string, p_number, p_bool) → tournament_results` — upsert one row in `tournament_results`. Pass `null` for the value kinds you don't need.
- `admin_clear_tournament_result(p_type)` — removes a single result row.
- `admin_lock_predictions(p_locked) → app_state` — flips the global lock. When locked: all writes to `match_predictions` / `tournament_predictions` and the `apply_boost` RPC are blocked, and the SELECT policies on those tables open up so every player can read every other player's predictions.
- `score_predictions() → table(user_id, total)` — recomputes everyone's `prediction_points` from `match_predictions` + `tournament_predictions` against the live `matches` and `tournament_results`. Idempotent.
- `resolve_side_bet(bet_id, outcome) → side_bets` — outcome ∈ `proposer | opponent | push`. Pays out the pot. Status must be `accepted`.

## Realtime

The following tables are added to `supabase_realtime` publication by `worldcup_schema.sql`:

- `profiles` — token balance, prediction points, paid-in flag, display name
- `matches` — live score updates (when ingestion lands)
- `side_bets` — propose / accept / cancel / resolve all push live
- `app_state` — banner reacts to `main_winner_user_id` flips and `buyin_eur` changes
- `tournament_results` — admin-set outcomes flow back into the predictions UI in real time
- `messages` — group chat sidebox

Frontend subscribes in `App.tsx` and refetches the view via `setRefreshKey` when needed.

## RLS Policies

| Table | Policy | Rule |
|-------|--------|------|
| profiles, teams, matches, side_bet_templates, side_bets, app_state, tournament_results | `read all` | SELECT for everyone |
| profiles | `self update` | UPDATE only when `auth.uid() = user_id` |
| group_predictions | `self write` | ALL only for own rows |
| match_predictions, tournament_predictions | `read locked or own` (SELECT) | Anyone can read once `predictions_are_locked()` returns true; otherwise only own rows |
| match_predictions, tournament_predictions | `self insert/update/delete pre lock` | Writes only when `auth.uid() = user_id` AND `predictions_are_locked() = false` |
| side_bets | (no direct INSERT/UPDATE policy) | All writes go through SECURITY DEFINER RPCs that enforce stake/tokens rules |

## Apply schema and seed (one time, manual)

The Supabase password is not committed; you need it locally. Drop the postgres connection string from Supabase → Settings → Database into `.env`:

```
DATABASE_URL=postgresql://postgres:<password>@db.adeactqablfksthhkbay.supabase.co:5432/postgres
VITE_SUPABASE_URL=https://adeactqablfksthhkbay.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Then:

```bash
npm run apply-schema     # runs supabase/worldcup_schema.sql
npm run apply-scoring    # runs supabase/scoring.sql (boost column, tournament_results, scoring RPCs)
npm run apply-lock       # runs supabase/lock-predictions.sql (global lock + tightened RLS)
npm run apply-chat       # runs supabase/chat.sql (group chat messages table + realtime)
npm run apply-knockout   # runs supabase/knockout.sql (knockout phase: advance prediction, 2× scoring, single knockout boost pool, bracket auto-advance trigger, per-match-until-kickoff RLS)
npm run seed-worldcup    # fetches openfootball 2026 JSON and upserts teams + matches + side-bet templates
```

All scripts are idempotent — safe to re-run.

## Environment Variables

```
VITE_SUPABASE_URL=https://adeactqablfksthhkbay.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key in .env>
DATABASE_URL=<postgres URL from Supabase → Settings → Database>
```

## Key Frontend Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client init |
| `src/lib/constants.ts` | `ADMIN_USER_ID`, `BUYIN_EUR`, `GROUP_LETTERS` |
| `src/lib/database.types.ts` | TypeScript interfaces for every table |
| `src/lib/i18n.ts` | Dutch copy + `fmtEur` / `fmtTokens` / `fmtKickoff` formatters |
| `src/App.tsx` | Auth, data loading, three-page router, realtime subscriptions |
| `src/components/LoginScreen.tsx` | Magic link login (Dutch) |
| `src/components/DisplayNameForm.tsx` | First-login display-name picker (Dutch) |
| `src/components/Header.tsx` | Three Dutch tabs + token + points + admin button |
| `src/components/PrizePotBanner.tsx` | EUR pot total + current leader / winner + top 3 |
| `src/components/PredictionsPage.tsx` | Group matches + awards + totals + drama, draft/dirty diff, sticky save |
| `src/components/GroupMatchesSection.tsx` | One group's 6 match score inputs + live virtual standings + boost button |
| `src/components/ScoringLegend.tsx` | Collapsible per-match / multiplier / awards / totals / drama explainer |
| `src/components/StickySaveBar.tsx` | Fixed-bottom unsaved-changes bar |
| `src/lib/scoring.ts` | Stage / multiplier / boost-counting helpers shared between components |
| `src/components/SideBetsPage.tsx` | Challenges / active / upcoming / history |
| `src/components/SideBetProposeModal.tsx` | Asymmetric-stakes propose modal |
| `src/components/Leaderboard.tsx` | Two columns: Hoofdpoule (points) + Tokens |
| `src/components/AllPredictionsView.tsx` | Locked-pool view: focused match card with team flags, every player's predicted score, ⚡ boost markers, earned points, and a tournament-awards panel grouped per type |
| `src/components/ChatBox.tsx` | Floating bottom-right chat sidebox with realtime messages and unread badge |
| `src/components/AdminPanel.tsx` | Lock pool, topup tokens, mark paid, set winner, set tournament results, recompute scores, resolve bets |

### Knockout page (`src/components/KnockoutPage.tsx`)

Separate "Knockout" nav tab. Lists every knockout match grouped by round. Per match the player predicts the 90′ score and picks which team advances, plus a ⚡ boost (shared pool of 3). Matches become editable as soon as both teams are known and stay editable until kickoff — even after the group/tournament pool is locked. The previous round's results auto-fill the next round's teams (via the bracket trigger), so players can keep predicting without admin intervention beyond entering scores.

## What's left for later

- Second prediction round after group stage (`round_locked` already supports it).
- Live-score ingestion (column slots + `resolve_side_bet` + `score_predictions` already exist, no worker yet) — would also auto-fire the bracket trigger.
- Real EUR payout to winner (manual: pay irl, then call `admin_set_main_winner`).
- Automatic best-third (`3…`) allocation — currently assigned by the admin via `admin_set_match_teams`.
