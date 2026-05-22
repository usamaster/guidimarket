-- ============================================================================
-- WK 2026 Voorspelpool — Predictions lock
-- ============================================================================
-- Adds:
--   - app_state.predictions_locked
--   - admin_lock_predictions(boolean)         flips the lock
-- Tightens RLS so:
--   - Predictions are PRIVATE before the lock (only own rows readable).
--   - Predictions are PUBLIC once the lock is on (everyone can read everyone).
--   - Writes (insert/update/delete + apply_boost) are blocked after the lock.
-- ============================================================================

begin;

alter table public.app_state
  add column if not exists predictions_locked boolean not null default false;

create or replace function public.admin_lock_predictions(p_locked boolean)
returns public.app_state
language plpgsql
security definer
set search_path = public
as $$
declare v public.app_state;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  update public.app_state
    set predictions_locked = p_locked,
        updated_at         = now()
    where id = 1
    returning * into v;
  return v;
end $$;
grant execute on function public.admin_lock_predictions(boolean) to authenticated;

create or replace function public.predictions_are_locked()
returns boolean
language sql
stable
as $$
  select coalesce((select predictions_locked from public.app_state where id = 1), false);
$$;

-- ----------------------------------------------------------------------------
-- match_predictions RLS
-- ----------------------------------------------------------------------------
drop policy if exists "read all"            on public.match_predictions;
drop policy if exists "self write"          on public.match_predictions;
drop policy if exists "self read"           on public.match_predictions;
drop policy if exists "read locked or own"  on public.match_predictions;
drop policy if exists "self insert pre lock" on public.match_predictions;
drop policy if exists "self update pre lock" on public.match_predictions;
drop policy if exists "self delete pre lock" on public.match_predictions;

create policy "read locked or own" on public.match_predictions
  for select using (
    auth.uid() = user_id
    or public.predictions_are_locked()
  );

create policy "self insert pre lock" on public.match_predictions
  for insert with check (
    auth.uid() = user_id
    and not public.predictions_are_locked()
  );

create policy "self update pre lock" on public.match_predictions
  for update using (
    auth.uid() = user_id
    and not public.predictions_are_locked()
  ) with check (
    auth.uid() = user_id
    and not public.predictions_are_locked()
  );

create policy "self delete pre lock" on public.match_predictions
  for delete using (
    auth.uid() = user_id
    and not public.predictions_are_locked()
  );

-- ----------------------------------------------------------------------------
-- tournament_predictions RLS
-- ----------------------------------------------------------------------------
drop policy if exists "read all"            on public.tournament_predictions;
drop policy if exists "self write"          on public.tournament_predictions;
drop policy if exists "self read"           on public.tournament_predictions;
drop policy if exists "read locked or own"  on public.tournament_predictions;
drop policy if exists "self insert pre lock" on public.tournament_predictions;
drop policy if exists "self update pre lock" on public.tournament_predictions;
drop policy if exists "self delete pre lock" on public.tournament_predictions;

create policy "read locked or own" on public.tournament_predictions
  for select using (
    auth.uid() = user_id
    or public.predictions_are_locked()
  );

create policy "self insert pre lock" on public.tournament_predictions
  for insert with check (
    auth.uid() = user_id
    and not public.predictions_are_locked()
  );

create policy "self update pre lock" on public.tournament_predictions
  for update using (
    auth.uid() = user_id
    and not public.predictions_are_locked()
  ) with check (
    auth.uid() = user_id
    and not public.predictions_are_locked()
  );

create policy "self delete pre lock" on public.tournament_predictions
  for delete using (
    auth.uid() = user_id
    and not public.predictions_are_locked()
  );

-- ----------------------------------------------------------------------------
-- Block boost toggling once locked
-- ----------------------------------------------------------------------------
create or replace function public.apply_boost(p_match_id uuid, p_applied boolean)
returns public.match_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_match   public.matches;
  v_count   integer;
  v_max     integer := 3;
  v_pred    public.match_predictions;
  v_stage   text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if public.predictions_are_locked() then raise exception 'voorspellingen zijn vergrendeld'; end if;

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then raise exception 'match not found'; end if;
  if v_match.kickoff_at <= now() then raise exception 'wedstrijd is al begonnen'; end if;

  v_stage := public.boost_stage_key(v_match.round, v_match.stage);

  if p_applied then
    select count(*) into v_count
    from public.match_predictions mp
    join public.matches m on m.id = mp.match_id
    where mp.user_id = v_uid
      and mp.boost_applied = true
      and mp.match_id <> p_match_id
      and public.boost_stage_key(m.round, m.stage) = v_stage;
    if v_count >= v_max then
      raise exception 'maximaal % boosts in deze fase', v_max;
    end if;
  end if;

  insert into public.match_predictions (user_id, match_id, boost_applied)
  values (v_uid, p_match_id, p_applied)
  on conflict (user_id, match_id)
  do update set boost_applied = excluded.boost_applied,
                updated_at    = now()
  returning * into v_pred;

  return v_pred;
end $$;

commit;
