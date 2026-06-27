-- ============================================================================
-- WK 2026 Voorspelpool — Knockout phase
-- ============================================================================
-- Adds the knockout prediction phase on top of the existing schema:
--   - match_predictions.advance_team_id    who the player thinks advances
--   - round_multiplier()                   knockout matches now score 2x the
--                                           group base (flat double)
--   - boost_stage_key()                    one shared pool of 3 knockout boosts
--   - knockout_advancer()                  90' -> extra time -> penalties winner
--   - group_position_team()                computes a group's 1st/2nd from
--                                           finished group matches
--   - resolve_slot() / resolve_bracket()   fill W#/L#/1X/2X placeholders
--   - matches trigger                      auto-resolves the bracket after the
--                                           admin enters a result (no worker)
--   - admin_resolve_bracket()              manual re-run
--   - admin_set_match_teams()              manual slot override (best-thirds etc.)
--   - apply_boost()                        knockout boosts stay open until each
--                                           match kicks off, even when locked
--   - match_pred_writable() + RLS          knockout match predictions editable
--                                           per-match until kickoff after lock
--   - score_predictions()                  knockout score x2 + 2 advance points
--
-- Apply: npm run apply-knockout (DATABASE_URL set), or paste into SQL Editor.
-- Idempotent — safe to re-run.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Advance prediction column
-- ----------------------------------------------------------------------------
alter table public.match_predictions
  add column if not exists advance_team_id uuid references public.teams(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 2) Knockout matches score double the group base
-- ----------------------------------------------------------------------------
create or replace function public.round_multiplier(p_round text)
returns numeric
language sql
immutable
as $$
  select case
    when p_round in ('Round of 32','Round of 16','Quarter-final','Semi-final','Match for third place','Final')
      then 2.0
    else 1.0
  end::numeric;
$$;

-- ----------------------------------------------------------------------------
-- 3) One shared pool of boosts for the whole knockout phase
-- ----------------------------------------------------------------------------
create or replace function public.boost_stage_key(p_round text, p_stage text)
returns text
language sql
immutable
as $$
  select case when p_stage = 'group' then 'group' else 'knockout' end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Who advances from a finished knockout match (90' -> ET -> penalties)
-- ----------------------------------------------------------------------------
create or replace function public.knockout_advancer(
  p_team1_id uuid, p_team2_id uuid,
  p_t1 integer, p_t2 integer,
  p_et1 integer, p_et2 integer,
  p_pen1 integer, p_pen2 integer
)
returns uuid
language sql
immutable
as $$
  select case
    when p_team1_id is null or p_team2_id is null then null
    when p_t1 is null or p_t2 is null then null
    when p_t1 > p_t2 then p_team1_id
    when p_t2 > p_t1 then p_team2_id
    when p_et1 is not null and p_et2 is not null and p_et1 > p_et2 then p_team1_id
    when p_et1 is not null and p_et2 is not null and p_et2 > p_et1 then p_team2_id
    when p_pen1 is not null and p_pen2 is not null and p_pen1 > p_pen2 then p_team1_id
    when p_pen1 is not null and p_pen2 is not null and p_pen2 > p_pen1 then p_team2_id
    else null
  end;
$$;

-- ----------------------------------------------------------------------------
-- 5) A group's nth-placed team, only once all its matches are finished
-- ----------------------------------------------------------------------------
create or replace function public.group_position_team(p_group text, p_pos integer)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_total integer;
  v_done  integer;
  v_team  uuid;
begin
  select count(*) into v_total
    from public.matches
   where stage = 'group' and group_letter = p_group
     and team1_id is not null and team2_id is not null;

  select count(*) into v_done
    from public.matches
   where stage = 'group' and group_letter = p_group
     and status = 'finished'
     and team1_score is not null and team2_score is not null;

  if v_total = 0 or v_done < v_total then
    return null;
  end if;

  with played as (
    select team1_id as tid, team1_score as gf, team2_score as ga
      from public.matches
     where stage = 'group' and group_letter = p_group and status = 'finished'
    union all
    select team2_id as tid, team2_score as gf, team1_score as ga
      from public.matches
     where stage = 'group' and group_letter = p_group and status = 'finished'
  ),
  agg as (
    select tid,
           sum(case when gf > ga then 3 when gf = ga then 1 else 0 end) as pts,
           sum(gf - ga) as gd,
           sum(gf) as gf
      from played
     group by tid
  )
  select tid into v_team
    from agg
   order by pts desc, gd desc, gf desc
   offset (p_pos - 1) limit 1;

  return v_team;
end $$;

-- ----------------------------------------------------------------------------
-- 6) Resolve a single placeholder to a team id (null = leave for manual)
--    W#  -> winner of match #         L#  -> loser of match #
--    1X  -> winner of group X         2X  -> runner-up of group X
--    3.. -> best-third slot, manual    (handled by admin_set_match_teams)
-- ----------------------------------------------------------------------------
create or replace function public.resolve_slot(p_ph text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_num text;
  v_src public.matches;
  v_adv uuid;
  v_pos integer;
  v_grp text;
begin
  if p_ph is null or btrim(p_ph) = '' then
    return null;
  end if;

  if p_ph ~ '^[WL][0-9]+$' then
    v_num := substring(p_ph from 2);
    select * into v_src from public.matches where external_id = 'wc2026-' || v_num;
    if v_src.id is null or v_src.status <> 'finished' then
      return null;
    end if;
    v_adv := public.knockout_advancer(
      v_src.team1_id, v_src.team2_id,
      v_src.team1_score, v_src.team2_score,
      v_src.team1_et, v_src.team2_et,
      v_src.team1_pen, v_src.team2_pen
    );
    if v_adv is null then
      return null;
    end if;
    if left(p_ph, 1) = 'W' then
      return v_adv;
    elsif v_adv = v_src.team1_id then
      return v_src.team2_id;
    else
      return v_src.team1_id;
    end if;
  end if;

  if p_ph ~ '^[12][A-L]$' then
    v_pos := substring(p_ph from 1 for 1)::integer;
    v_grp := substring(p_ph from 2 for 1);
    return public.group_position_team(v_grp, v_pos);
  end if;

  return null;
end $$;

-- ----------------------------------------------------------------------------
-- 7) Fill every knockout slot we can compute. Never clobbers a slot with null,
--    so manually-assigned best-thirds and overrides survive re-runs.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_bracket()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  m         record;
  v_t1      uuid;
  v_t2      uuid;
  v_count   integer := 0;
begin
  for m in
    select * from public.matches where stage = 'knockout' order by kickoff_at
  loop
    v_t1 := public.resolve_slot(m.team1_placeholder);
    v_t2 := public.resolve_slot(m.team2_placeholder);

    if v_t1 is not null and v_t1 is distinct from m.team1_id then
      update public.matches set team1_id = v_t1 where id = m.id;
      v_count := v_count + 1;
    end if;
    if v_t2 is not null and v_t2 is distinct from m.team2_id then
      update public.matches set team2_id = v_t2 where id = m.id;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end $$;

create or replace function public.trg_resolve_bracket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  perform public.resolve_bracket();
  return null;
end $$;

drop trigger if exists matches_resolve_bracket on public.matches;
create trigger matches_resolve_bracket
  after update of status, team1_score, team2_score, team1_et, team2_et, team1_pen, team2_pen
  on public.matches
  for each statement
  execute function public.trg_resolve_bracket();

-- ----------------------------------------------------------------------------
-- 8) Admin: manual bracket re-run + manual slot override
-- ----------------------------------------------------------------------------
create or replace function public.admin_resolve_bracket()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  return public.resolve_bracket();
end $$;
grant execute on function public.admin_resolve_bracket() to authenticated;

create or replace function public.admin_set_match_teams(
  p_match_id uuid,
  p_team1_id uuid,
  p_team2_id uuid
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare v public.matches;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  update public.matches
     set team1_id = p_team1_id,
         team2_id = p_team2_id
   where id = p_match_id
   returning * into v;
  if v.id is null then raise exception 'match not found'; end if;
  return v;
end $$;
grant execute on function public.admin_set_match_teams(uuid, uuid, uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 9) Boosts: knockout matches stay boostable until kickoff, even when locked
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

  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then raise exception 'match not found'; end if;

  if v_match.stage = 'group' and public.predictions_are_locked() then
    raise exception 'voorspellingen zijn vergrendeld';
  end if;
  if v_match.stage = 'knockout' and public.knockout_round_started(v_match.round) then
    raise exception 'deze knockout-ronde is al begonnen';
  end if;
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
grant execute on function public.apply_boost(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 10) RLS: keep pre-lock behaviour, but allow knockout writes until the round
--     starts. A whole knockout round locks at the kickoff of its first match.
-- ----------------------------------------------------------------------------
create or replace function public.knockout_round_started(p_round text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
     where m.stage = 'knockout'
       and m.round = p_round
       and m.kickoff_at <= now()
  );
$$;

create or replace function public.match_pred_writable(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.predictions_are_locked() then true
    else exists (
      select 1 from public.matches m
       where m.id = p_match_id
         and m.stage = 'knockout'
         and not public.knockout_round_started(m.round)
    )
  end;
$$;

drop policy if exists "self insert pre lock" on public.match_predictions;
drop policy if exists "self update pre lock" on public.match_predictions;
drop policy if exists "self delete pre lock" on public.match_predictions;
drop policy if exists "self insert open" on public.match_predictions;
drop policy if exists "self update open" on public.match_predictions;
drop policy if exists "self delete open" on public.match_predictions;

create policy "self insert open" on public.match_predictions
  for insert with check (
    auth.uid() = user_id and public.match_pred_writable(match_id)
  );

create policy "self update open" on public.match_predictions
  for update using (
    auth.uid() = user_id and public.match_pred_writable(match_id)
  ) with check (
    auth.uid() = user_id and public.match_pred_writable(match_id)
  );

create policy "self delete open" on public.match_predictions
  for delete using (
    auth.uid() = user_id and public.match_pred_writable(match_id)
  );

-- ----------------------------------------------------------------------------
-- 10b) RLS read: others' predictions become visible per the timing rules.
--   - group match     : visible to everyone once the pool is locked (unchanged)
--   - knockout match  : visible to others only once that match's ROUND has
--                       started (earliest kickoff in the round is in the past)
-- A player can always read their own rows.
-- ----------------------------------------------------------------------------
create or replace function public.match_pred_readable(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
     where m.id = p_match_id
       and (
         (m.stage = 'group' and public.predictions_are_locked())
         or (m.stage = 'knockout' and public.knockout_round_started(m.round))
       )
  );
$$;

drop policy if exists "read locked or own" on public.match_predictions;
drop policy if exists "read open or own"   on public.match_predictions;

create policy "read open or own" on public.match_predictions
  for select using (
    auth.uid() = user_id
    or public.match_pred_readable(match_id)
  );

-- ----------------------------------------------------------------------------
-- 11) Scoring: knockout score x2 (via round_multiplier) + 2 advance points
-- ----------------------------------------------------------------------------
create or replace function public.score_predictions()
returns table (user_id uuid, total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual_winner    uuid;
  v_actual_runner_up uuid;
  v_actual_third     uuid;
  v_actual_fourth    uuid;
  v_semis            uuid[];
  v_user             record;
  v_pred             record;
  v_pts              integer;
  v_match_pts        integer;
  v_total            integer;
  v_actual           public.tournament_results;
  v_match_finished   boolean;
  v_advancer         uuid;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;

  select team_id into v_actual_winner    from public.tournament_results where prediction_type = 'winner';
  select team_id into v_actual_runner_up from public.tournament_results where prediction_type = 'runner_up';
  select team_id into v_actual_third     from public.tournament_results where prediction_type = 'third';
  select team_id into v_actual_fourth    from public.tournament_results where prediction_type = 'fourth';

  v_semis := array_remove(array[v_actual_winner, v_actual_runner_up, v_actual_third, v_actual_fourth], null);

  for v_user in select profiles.user_id as uid from public.profiles loop
    v_total := 0;

    for v_pred in
      select mp.id              as pred_id,
             mp.team1_score     as pt1,
             mp.team2_score     as pt2,
             mp.advance_team_id as adv_pred,
             mp.boost_applied   as boost,
             m.team1_id         as m_t1,
             m.team2_id         as m_t2,
             m.team1_score      as at1,
             m.team2_score      as at2,
             m.team1_et         as aet1,
             m.team2_et         as aet2,
             m.team1_pen        as apen1,
             m.team2_pen        as apen2,
             m.status           as mstatus,
             m.round            as mround,
             m.stage            as mstage
      from public.match_predictions mp
      join public.matches m on m.id = mp.match_id
      where mp.user_id = v_user.uid
    loop
      v_match_finished := v_pred.mstatus = 'finished'
                         and v_pred.at1 is not null
                         and v_pred.at2 is not null;
      if v_match_finished then
        v_match_pts := public.score_match(v_pred.pt1, v_pred.pt2, v_pred.at1, v_pred.at2);
        v_match_pts := round(v_match_pts * public.round_multiplier(v_pred.mround))::integer;

        if v_pred.mstage = 'knockout' and v_pred.adv_pred is not null then
          v_advancer := public.knockout_advancer(
            v_pred.m_t1, v_pred.m_t2,
            v_pred.at1, v_pred.at2,
            v_pred.aet1, v_pred.aet2,
            v_pred.apen1, v_pred.apen2
          );
          if v_advancer is not null and v_pred.adv_pred = v_advancer then
            v_match_pts := v_match_pts + 2;
          end if;
        end if;

        if v_pred.boost then v_match_pts := v_match_pts * 2; end if;

        update public.match_predictions
          set points_awarded = v_match_pts,
              resolved       = true,
              resolved_at    = now()
          where id = v_pred.pred_id;
        v_total := v_total + v_match_pts;
      else
        update public.match_predictions
          set points_awarded = null,
              resolved       = false,
              resolved_at    = null
          where id = v_pred.pred_id;
      end if;
    end loop;

    for v_pred in
      select tp.id, tp.prediction_type, tp.team_id, tp.string_value, tp.number_value, tp.bool_value
      from public.tournament_predictions tp
      where tp.user_id = v_user.uid
    loop
      v_pts := 0;
      select * into v_actual from public.tournament_results where prediction_type = v_pred.prediction_type;

      if v_pred.prediction_type = 'winner' then
        if v_actual.team_id is not null and v_pred.team_id = v_actual.team_id then
          v_pts := 25;
        elsif v_pred.team_id is not null and v_pred.team_id = any(v_semis) then
          v_pts := 4;
        end if;
      elsif v_pred.prediction_type = 'runner_up' then
        if v_actual.team_id is not null and v_pred.team_id = v_actual.team_id then
          v_pts := 15;
        elsif v_pred.team_id is not null and v_pred.team_id = any(v_semis) then
          v_pts := 4;
        end if;
      elsif v_pred.prediction_type in ('third','fourth') then
        if v_actual.team_id is not null and v_pred.team_id = v_actual.team_id then
          v_pts := 8;
        elsif v_pred.team_id is not null and v_pred.team_id = any(v_semis) then
          v_pts := 4;
        end if;
      elsif v_pred.prediction_type = 'most_goals_against' then
        if v_actual.team_id is not null and v_pred.team_id = v_actual.team_id then
          v_pts := 15;
        end if;
      elsif v_pred.prediction_type = 'top_scorer' then
        if v_actual.string_value is not null
           and v_pred.string_value is not null
           and lower(trim(v_pred.string_value)) = lower(trim(v_actual.string_value)) then
          v_pts := 15;
        end if;
      elsif v_pred.prediction_type in ('golden_ball','young_player','golden_glove') then
        if v_actual.string_value is not null
           and v_pred.string_value is not null
           and lower(trim(v_pred.string_value)) = lower(trim(v_actual.string_value)) then
          v_pts := 10;
        end if;
      elsif v_pred.prediction_type = 'dutch_zero_minutes' then
        v_pts := public.score_name_overlap(v_pred.string_value, v_actual.string_value);
      elsif v_pred.prediction_type in ('total_goals','total_red_cards','total_yellow_cards','total_penalties','highest_match_goals') then
        if v_actual.number_value is not null and v_pred.number_value is not null then
          v_pts := public.score_total_proximity(v_pred.number_value, v_actual.number_value);
        end if;
      elsif v_pred.prediction_type in ('host_reaches_qf','undefeated_team_exists','any_zero_zero','final_goes_to_et','hat_trick_scored') then
        if v_actual.bool_value is not null
           and v_pred.bool_value is not null
           and v_actual.bool_value = v_pred.bool_value then
          v_pts := 5;
        end if;
      end if;

      update public.tournament_predictions
        set points_awarded = v_pts,
            resolved       = (v_actual.prediction_type is not null),
            resolved_at    = case when v_actual.prediction_type is not null then now() else null end
        where id = v_pred.id;
      v_total := v_total + v_pts;
    end loop;

    update public.profiles set prediction_points = v_total where profiles.user_id = v_user.uid;
  end loop;

  return query select profiles.user_id, profiles.prediction_points
               from public.profiles
               order by profiles.prediction_points desc;
end $$;
grant execute on function public.score_predictions() to authenticated;

-- ----------------------------------------------------------------------------
-- 12) Realtime: make sure prediction tables push (idempotent)
-- ----------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.match_predictions; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.tournament_predictions; exception when duplicate_object then null; end;
  end if;
end $$;

commit;
