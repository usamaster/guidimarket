# GuidiMarket — Supabase Infrastructure

## Project

- **Supabase Project Ref**: `inxcedeyqqbusetvmpxz`
- **Dashboard**: https://supabase.com/dashboard/project/inxcedeyqqbusetvmpxz
- **DB Connection**: `postgresql://postgres:<password>@db.inxcedeyqqbusetvmpxz.supabase.co:5432/postgres`
- **Production URL**: https://guidimarket.vercel.app
- **Auth method**: Magic link (email OTP) — no passwords

## Admin User

- **Email**: `ufarag@protonmail.com`
- **User ID**: `b330e6ae-5ef6-47c4-9e24-0b06fd932908`
- Admin ID is hardcoded in two places:
  1. `src/lib/constants.ts` → `ADMIN_USER_ID` (frontend gating)
  2. `admin_adjust_price()` SQL function (server-side authorization)

## Database Schema

### `stocks`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| ticker | text | e.g. `CHEESE`, `SLORV` |
| name | text | Full name |
| emoji | text | Display emoji |
| current_price | numeric | Live price, updated on every trade |
| previous_close | numeric | Snapshot for % change calc |
| created_at | timestamptz | |

### `price_history`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| stock_id | uuid FK → stocks | |
| price | numeric | |
| created_at | timestamptz | One row per price change |

### `portfolios`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid UNIQUE | FK → auth.users |
| credits | numeric | Starting balance: 1000 |
| display_name | text | Set by user on first login |
| created_at | timestamptz | |

### `holdings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | |
| stock_id | uuid | |
| quantity | integer | |
| avg_buy_price | numeric | Weighted average |

Unique constraint on `(user_id, stock_id)`.

### `short_positions`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | FK → auth.users |
| stock_id | uuid | FK → stocks |
| quantity | integer | Short size |
| entry_price | numeric | Exec price at open |
| collateral | numeric | Typically 2× notional |
| created_at | timestamptz | |

Unique constraint on `(user_id, stock_id)`. One open short per stock per user.

Apply schema and RPC updates by running `supabase/short_selling.sql` in the SQL Editor. Afterward, enable Realtime if needed: `ALTER PUBLICATION supabase_realtime ADD TABLE short_positions;`

### `trades`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| stock_id | uuid | |
| user_id | uuid nullable | null for bot trades |
| username | text | Display name of trader |
| type | text | `buy`, `sell`, `short`, or `cover` |
| quantity | integer | |
| price | numeric | Price at time of trade |
| total | numeric | price × quantity |
| is_fake | boolean | true for bot/fake trades |
| created_at | timestamptz | |

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid | |
| display_name | text | Cached display name |
| content | text | Max 500 chars (frontend enforced) |
| created_at | timestamptz | |

### `news_items`
| Column | Type | Notes |
|--------|------|-------|
| headline | text | |
| image_url | text nullable | |
| impacts | jsonb | `{ stock_id, ticker, pct }[]` |
| published | boolean | Visible in feed and snackbar when true |
| published_at | timestamptz nullable | When the item becomes eligible to publish |
| impacts_already_applied | boolean | If true, `publish_due_news_items` skips moving prices (e.g. market events already adjusted prices) |

Run `supabase/publish_due_news.sql` in the SQL Editor to add `impacts_already_applied` and the RPC. To reschedule all rows as unpublished with staggered future times (10 minutes apart), run `supabase/reset_news_schedule.sql` after that. The app calls `publish_due_news_items` every 30 seconds so items flip to `published` when `published_at` passes.

## RPC Functions

### `init_portfolio(p_user_id uuid) → portfolios`
Called on login. Creates portfolio with 1000 credits if not exists. Sets `display_name` from email prefix. Idempotent.

### `execute_trade(p_user_id uuid, p_stock_id uuid, p_type text, p_quantity int) → trades`
Atomic buy/sell/short/cover. Buy/sell: updates holdings, exec-first price impact. **short**: locks 2× collateral, opens `short_positions`, moves price down. **cover**: closes short, returns `collateral + P/L` (floored at 0), moves price up. Liquidates shorts when price ≥ 1.5× entry after buy/cover. Same cooldown and daily volume limits as spot trades.

### `admin_adjust_price(p_stock_id uuid, p_percentage numeric) → stocks`
Admin only (checks `auth.uid()` against hardcoded admin UUID). Adjusts price by given percentage. Used by admin panel buttons (±5%, ±10%, ±20%, ±50%, ±100%).

### `generate_fake_trades() → void`
Picks 3-5 random stocks, creates fake buy/sell trades (qty 1-5) with bot names (MarketMaker, AlgoBot, WallStBets, etc.). Moves prices 0.1-0.4% per unit. Can be triggered from admin panel "Generate Market Noise" button.

### `generate_micro_trades() → void`
Picks 5-10 random stocks, creates single-unit fake trades with smaller impact (0.05-0.2%). Bot names: FloorTrader, ScalpKing, NanoTrader, etc.

### `publish_due_news_items() → void`
Sets `published = true` on every row where `published = false` and `published_at <= now()`, ordered by `published_at`. Applies `impacts` to `stocks` / `price_history` when `impacts_already_applied` is false, then sets that flag true. Invoked from the frontend on an interval and safe to call repeatedly.

Legacy `publish_next_news()` (random pick) conflicts with scheduled publishing; unschedule `news-publisher` if you use `publish_due_news_items` and `reset_news_schedule.sql`.

## Cron Jobs (pg_cron)

**Active:** (varies by project; confirm in SQL) If `news-publisher` calls `publish_next_news`, remove it when using `publish_due_news_items`.

**Disabled** (fake trades). To re-enable:

```sql
-- Every 2 minutes: larger fake trades
SELECT cron.schedule('fake-trades-every-2min', '*/2 * * * *', 'SELECT generate_fake_trades()');

-- Every 1 minute: micro trades for continuous activity
SELECT cron.schedule('micro-trades-every-min', '* * * * *', 'SELECT generate_micro_trades()');
```

To disable:
```sql
SELECT cron.unschedule('fake-trades-every-2min');
SELECT cron.unschedule('micro-trades-every-min');
```

To check active jobs:
```sql
SELECT * FROM cron.job;
```

## Realtime

Supabase Realtime is enabled on these tables (via `supabase_realtime` publication):
- `stocks` — price updates push to all clients
- `trades` — new trades appear in ticker/feed
- `messages` — chat messages broadcast instantly
- `news_items` — when a news item is published (UPDATE with published=true), all clients get a snackbar + sound notification
- `short_positions` — add to publication after migration (see `short_positions` section above)

Frontend subscribes in `App.tsx` (stocks, trades, short_positions, etc.) and `ChatBox.tsx` (messages channel).

## RLS Policies

| Table | Policy | Rule |
|-------|--------|------|
| stocks, holdings, portfolios, price_history, trades, short_positions | `anon_read_*` | SELECT for everyone |
| stocks, holdings, portfolios, price_history, trades, short_positions | `auth_all_*` | ALL for authenticated users |
| messages | `Anyone can read messages` | SELECT for everyone |
| messages | `Auth users can insert` | INSERT where `auth.uid() = user_id` |

## Environment Variables

```
VITE_SUPABASE_URL=https://inxcedeyqqbusetvmpxz.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key in .env>
```

## Seeded Stocks (20)

The stocks were seeded via `scripts/migrate.mjs` (deleted after use). They include LAN party / gaming themed stocks related to the group members (AnneDrank, Slorv, Danordaan, Davy, NathanJewish, Graftak, Bryce, Ewald) and games (Warcraft, Trackmania, Age of Empires).

## Key Frontend Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client init |
| `src/lib/constants.ts` | `ADMIN_USER_ID`, `USERNAME_DOMAIN` |
| `src/lib/database.types.ts` | TypeScript interfaces for all tables |
| `src/lib/portfolio.ts` | `computePortfolioValue()` helper |
| `src/App.tsx` | Main app: auth, data loading, Realtime subscriptions, routing |
| `src/components/LoginScreen.tsx` | Magic link auth |
| `src/components/DisplayNameForm.tsx` | First-login display name picker |
| `src/components/Header.tsx` | Nav bar with Market/Trade Log tabs, admin toggle |
| `src/components/StockCard.tsx` | Stock tile with sparkline |
| `src/components/StockDetail.tsx` | Modal: chart (lightweight-charts), trade panel, trade feed |
| `src/components/Portfolio.tsx` | Sidebar: holdings and short positions |
| `src/components/Leaderboard.tsx` | Sidebar: ranked users, expandable portfolios |
| `src/components/AdminPanel.tsx` | Price adjustment buttons, generate noise |
| `src/components/TradeLog.tsx` | Filterable/sortable trade history table |
| `src/components/TradeTicker.tsx` | Toast notifications for new trades |
| `src/components/MarqueeTicker.tsx` | Scrolling stock ticker bar |
| `src/components/ChatBox.tsx` | Floating real-time chat |
| `src/components/NewsFeed.tsx` | News page: published items with images, sentiment badges |
| `src/components/NewsSnackbar.tsx` | Breaking news toast notification on new publish |
