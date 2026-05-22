-- ============================================================================
-- WK 2026 Voorspelpool — full schema
-- ============================================================================
-- Idempotent: drops legacy guidimarket trading-game tables, then creates the
-- World Cup prediction game schema.
--
-- Apply: paste the entire file into the Supabase SQL Editor and run, OR use
-- `npm run apply-schema` (see scripts/apply-schema.mjs) with DATABASE_URL set.

begin;

-- ----------------------------------------------------------------------------
-- 1) Drop legacy tables from the trading game
-- ----------------------------------------------------------------------------
drop table if exists public.bankruptcies cascade;
drop table if exists public.loans cascade;
drop table if exists public.market_events cascade;
drop table if exists public.news_items cascade;
drop table if exists public.messages cascade;
drop table if exists public.short_positions cascade;
drop table if exists public.trades cascade;
drop table if exists public.holdings cascade;
drop table if exists public.price_history cascade;
drop table if exists public.stocks cascade;
drop table if exists public.bets cascade;
drop table if exists public.portfolios cascade;

drop function if exists public.init_portfolio(uuid) cascade;
drop function if exists public.execute_trade(uuid, uuid, text, integer) cascade;
drop function if exists public.admin_adjust_price(uuid, numeric) cascade;
drop function if exists public.generate_fake_trades() cascade;
drop function if exists public.generate_micro_trades() cascade;
drop function if exists public.publish_due_news_items() cascade;
drop function if exists public.publish_next_news() cascade;

-- ----------------------------------------------------------------------------
-- 2) Core tables
-- ----------------------------------------------------------------------------

create table if not exists public.app_state (
  id              integer primary key default 1,
  buyin_eur       numeric(10, 2) not null default 15,
  main_winner_user_id uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  constraint app_state_singleton check (id = 1)
);
insert into public.app_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.profiles (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  tokens            numeric(12, 2) not null default 0,
  prediction_points integer not null default 0,
  paid_in           boolean not null default false,
  created_at        timestamptz not null default now()
);

create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  fifa_code     text,
  flag_emoji    text,
  group_letter  text check (group_letter ~ '^[A-L]$'),
  created_at    timestamptz not null default now()
);

create table if not exists public.matches (
  id                  uuid primary key default gen_random_uuid(),
  external_id         text unique,
  round               text not null,
  stage               text not null check (stage in ('group','knockout')),
  group_letter        text,
  team1_id            uuid references public.teams(id) on delete set null,
  team2_id            uuid references public.teams(id) on delete set null,
  team1_placeholder   text,
  team2_placeholder   text,
  kickoff_at          timestamptz not null,
  ground              text,
  status              text not null default 'scheduled' check (status in ('scheduled','live','finished','cancelled')),
  team1_score         integer,
  team2_score         integer,
  team1_ht            integer,
  team2_ht            integer,
  team1_et            integer,
  team2_et            integer,
  team1_pen           integer,
  team2_pen           integer,
  yellow_cards        integer,
  red_cards           integer,
  finished_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists matches_kickoff_idx on public.matches(kickoff_at);
create index if not exists matches_stage_idx on public.matches(stage);

create table if not exists public.tournament_predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  prediction_type text not null,
  round_locked    text not null default 'pre_tournament',
  team_id         uuid references public.teams(id) on delete set null,
  string_value    text,
  number_value    numeric,
  bool_value      boolean,
  points_awarded  integer,
  resolved        boolean not null default false,
  resolved_at     timestamptz,
  updated_at      timestamptz not null default now(),
  unique (user_id, prediction_type, round_locked)
);
create index if not exists tp_user_idx on public.tournament_predictions(user_id);

create table if not exists public.group_predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  group_letter    text not null check (group_letter ~ '^[A-L]$'),
  round_locked    text not null default 'pre_tournament',
  first_team_id   uuid references public.teams(id) on delete set null,
  second_team_id  uuid references public.teams(id) on delete set null,
  third_team_id   uuid references public.teams(id) on delete set null,
  fourth_team_id  uuid references public.teams(id) on delete set null,
  points_awarded  integer,
  resolved        boolean not null default false,
  resolved_at     timestamptz,
  updated_at      timestamptz not null default now(),
  unique (user_id, group_letter, round_locked)
);
create index if not exists gp_user_idx on public.group_predictions(user_id);

create table if not exists public.match_predictions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  match_id           uuid not null references public.matches(id) on delete cascade,
  team1_score        integer,
  team2_score        integer,
  yellow_cards       integer,
  red_cards          integer,
  first_scorer_name  text,
  points_awarded     integer,
  resolved           boolean not null default false,
  resolved_at        timestamptz,
  updated_at         timestamptz not null default now(),
  unique (user_id, match_id)
);

create table if not exists public.side_bet_templates (
  id                    uuid primary key default gen_random_uuid(),
  key                   text not null unique,
  label                 text not null,
  description           text,
  category              text not null check (category in ('goals','cards','drama','result')),
  applies_to_stage      text not null default 'any' check (applies_to_stage in ('any','group','knockout')),
  side_a_label          text not null,
  side_b_label          text not null,
  created_at            timestamptz not null default now()
);

create table if not exists public.side_bets (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches(id) on delete cascade,
  template_id       uuid references public.side_bet_templates(id) on delete set null,
  custom_label      text,
  description       text,
  proposer_id       uuid not null references auth.users(id) on delete cascade,
  proposer_name     text not null,
  proposer_side     text not null,
  proposer_stake    numeric(12, 2) not null check (proposer_stake > 0),
  opponent_id       uuid references auth.users(id) on delete set null,
  opponent_name     text,
  opponent_side     text not null,
  opponent_stake    numeric(12, 2) not null check (opponent_stake > 0),
  invited_user_id   uuid references auth.users(id) on delete set null,
  status            text not null default 'open' check (status in ('open','accepted','cancelled','resolved')),
  outcome           text check (outcome in ('proposer','opponent','push')),
  accepted_at       timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists sb_match_idx on public.side_bets(match_id);
create index if not exists sb_status_idx on public.side_bets(status);
create index if not exists sb_proposer_idx on public.side_bets(proposer_id);
create index if not exists sb_opponent_idx on public.side_bets(opponent_id);
create index if not exists sb_invited_idx on public.side_bets(invited_user_id);

-- ----------------------------------------------------------------------------
-- 3) Row Level Security
-- ----------------------------------------------------------------------------
alter table public.app_state               enable row level security;
alter table public.profiles                enable row level security;
alter table public.teams                   enable row level security;
alter table public.matches                 enable row level security;
alter table public.tournament_predictions  enable row level security;
alter table public.group_predictions       enable row level security;
alter table public.match_predictions       enable row level security;
alter table public.side_bet_templates      enable row level security;
alter table public.side_bets               enable row level security;

drop policy if exists "read all" on public.app_state;
create policy "read all" on public.app_state for select using (true);

drop policy if exists "read all" on public.profiles;
create policy "read all" on public.profiles for select using (true);
drop policy if exists "self update" on public.profiles;
create policy "self update" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read all" on public.teams;
create policy "read all" on public.teams for select using (true);

drop policy if exists "read all" on public.matches;
create policy "read all" on public.matches for select using (true);

drop policy if exists "read all" on public.tournament_predictions;
create policy "read all" on public.tournament_predictions for select using (true);
drop policy if exists "self write" on public.tournament_predictions;
create policy "self write" on public.tournament_predictions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read all" on public.group_predictions;
create policy "read all" on public.group_predictions for select using (true);
drop policy if exists "self write" on public.group_predictions;
create policy "self write" on public.group_predictions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read all" on public.match_predictions;
create policy "read all" on public.match_predictions for select using (true);
drop policy if exists "self write" on public.match_predictions;
create policy "self write" on public.match_predictions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read all" on public.side_bet_templates;
create policy "read all" on public.side_bet_templates for select using (true);

drop policy if exists "read all" on public.side_bets;
create policy "read all" on public.side_bets for select using (true);

-- ----------------------------------------------------------------------------
-- 4) RPCs
-- ----------------------------------------------------------------------------
create or replace function public.init_profile(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_email   text;
begin
  select email into v_email from auth.users where id = p_user_id;

  insert into public.profiles (user_id, display_name)
  values (p_user_id, split_part(coalesce(v_email,''), '@', 1))
  on conflict (user_id) do nothing;

  select * into v_profile from public.profiles where user_id = p_user_id;
  return v_profile;
end $$;

grant execute on function public.init_profile(uuid) to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = 'caec526d-d38c-462b-a585-bbd2e119ed3f'::uuid;
$$;

grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.admin_topup_tokens(p_user_id uuid, p_amount numeric)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare v public.profiles;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  update public.profiles
     set tokens = tokens + p_amount
   where user_id = p_user_id
   returning * into v;
  return v;
end $$;
grant execute on function public.admin_topup_tokens(uuid, numeric) to authenticated;

create or replace function public.admin_set_paid_in(p_user_id uuid, p_paid boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare v public.profiles;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  update public.profiles set paid_in = p_paid where user_id = p_user_id returning * into v;
  return v;
end $$;
grant execute on function public.admin_set_paid_in(uuid, boolean) to authenticated;

create or replace function public.admin_set_main_winner(p_user_id uuid)
returns public.app_state
language plpgsql
security definer
set search_path = public
as $$
declare v public.app_state;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  update public.app_state set main_winner_user_id = p_user_id, updated_at = now() where id = 1 returning * into v;
  return v;
end $$;
grant execute on function public.admin_set_main_winner(uuid) to authenticated;

create or replace function public.admin_set_prediction_points(p_user_id uuid, p_points integer)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare v public.profiles;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  update public.profiles set prediction_points = p_points where user_id = p_user_id returning * into v;
  return v;
end $$;
grant execute on function public.admin_set_prediction_points(uuid, integer) to authenticated;

create or replace function public.propose_side_bet(
  p_match_id uuid,
  p_template_id uuid,
  p_custom_label text,
  p_description text,
  p_proposer_side text,
  p_proposer_stake numeric,
  p_opponent_side text,
  p_opponent_stake numeric,
  p_invited_user_id uuid
) returns public.side_bets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   public.profiles;
  v_kickoff   timestamptz;
  v_name      text;
  v_bet       public.side_bets;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_proposer_stake <= 0 or p_opponent_stake <= 0 then
    raise exception 'stakes must be positive';
  end if;
  if p_proposer_side = p_opponent_side then
    raise exception 'sides must differ';
  end if;

  select kickoff_at into v_kickoff from public.matches where id = p_match_id;
  if v_kickoff is null then raise exception 'match not found'; end if;
  if v_kickoff <= now() then raise exception 'match has already kicked off'; end if;

  select * into v_profile from public.profiles where user_id = v_uid for update;
  if v_profile.tokens < p_proposer_stake then
    raise exception 'insufficient tokens (need %, have %)', p_proposer_stake, v_profile.tokens;
  end if;

  v_name := coalesce(v_profile.display_name, 'Speler');

  update public.profiles set tokens = tokens - p_proposer_stake where user_id = v_uid;

  insert into public.side_bets (
    match_id, template_id, custom_label, description,
    proposer_id, proposer_name, proposer_side, proposer_stake,
    opponent_side, opponent_stake, invited_user_id, status
  ) values (
    p_match_id, p_template_id, p_custom_label, p_description,
    v_uid, v_name, p_proposer_side, p_proposer_stake,
    p_opponent_side, p_opponent_stake, p_invited_user_id, 'open'
  ) returning * into v_bet;

  return v_bet;
end $$;
grant execute on function public.propose_side_bet(uuid, uuid, text, text, text, numeric, text, numeric, uuid) to authenticated;

create or replace function public.accept_side_bet(p_bet_id uuid)
returns public.side_bets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_bet     public.side_bets;
  v_profile public.profiles;
  v_kickoff timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_bet from public.side_bets where id = p_bet_id for update;
  if v_bet.id is null then raise exception 'bet not found'; end if;
  if v_bet.status <> 'open' then raise exception 'bet is not open'; end if;
  if v_bet.proposer_id = v_uid then raise exception 'cannot accept your own bet'; end if;
  if v_bet.invited_user_id is not null and v_bet.invited_user_id <> v_uid then
    raise exception 'this bet is reserved for another player';
  end if;

  select kickoff_at into v_kickoff from public.matches where id = v_bet.match_id;
  if v_kickoff <= now() then raise exception 'match has already kicked off'; end if;

  select * into v_profile from public.profiles where user_id = v_uid for update;
  if v_profile.tokens < v_bet.opponent_stake then
    raise exception 'insufficient tokens (need %, have %)', v_bet.opponent_stake, v_profile.tokens;
  end if;

  update public.profiles set tokens = tokens - v_bet.opponent_stake where user_id = v_uid;

  update public.side_bets
     set opponent_id   = v_uid,
         opponent_name = coalesce(v_profile.display_name, 'Speler'),
         status        = 'accepted',
         accepted_at   = now()
   where id = p_bet_id
   returning * into v_bet;

  return v_bet;
end $$;
grant execute on function public.accept_side_bet(uuid) to authenticated;

create or replace function public.cancel_side_bet(p_bet_id uuid)
returns public.side_bets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bet public.side_bets;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_bet from public.side_bets where id = p_bet_id for update;
  if v_bet.id is null then raise exception 'bet not found'; end if;
  if v_bet.status <> 'open' then raise exception 'only open bets can be cancelled'; end if;
  if v_bet.proposer_id <> v_uid and not public.is_admin() then
    raise exception 'only the proposer (or admin) can cancel';
  end if;

  update public.profiles set tokens = tokens + v_bet.proposer_stake where user_id = v_bet.proposer_id;

  update public.side_bets set status = 'cancelled' where id = p_bet_id returning * into v_bet;
  return v_bet;
end $$;
grant execute on function public.cancel_side_bet(uuid) to authenticated;

create or replace function public.resolve_side_bet(p_bet_id uuid, p_outcome text)
returns public.side_bets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bet  public.side_bets;
  v_pot  numeric;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  if p_outcome not in ('proposer','opponent','push') then
    raise exception 'invalid outcome';
  end if;

  select * into v_bet from public.side_bets where id = p_bet_id for update;
  if v_bet.id is null then raise exception 'bet not found'; end if;
  if v_bet.status <> 'accepted' then raise exception 'only accepted bets can be resolved'; end if;

  v_pot := v_bet.proposer_stake + v_bet.opponent_stake;

  if p_outcome = 'proposer' then
    update public.profiles set tokens = tokens + v_pot where user_id = v_bet.proposer_id;
  elsif p_outcome = 'opponent' then
    update public.profiles set tokens = tokens + v_pot where user_id = v_bet.opponent_id;
  else
    update public.profiles set tokens = tokens + v_bet.proposer_stake where user_id = v_bet.proposer_id;
    update public.profiles set tokens = tokens + v_bet.opponent_stake where user_id = v_bet.opponent_id;
  end if;

  update public.side_bets
     set outcome = p_outcome,
         status = 'resolved',
         resolved_at = now()
   where id = p_bet_id
   returning * into v_bet;
  return v_bet;
end $$;
grant execute on function public.resolve_side_bet(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) Realtime publication
-- ----------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.matches; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.side_bets; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.app_state; exception when duplicate_object then null; end;
  end if;
end $$;

commit;
