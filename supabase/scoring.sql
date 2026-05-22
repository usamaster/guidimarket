-- ============================================================================
-- WK 2026 Voorspelpool — Scoring system
-- ============================================================================
-- Adds:
--   - match_predictions.boost_applied
--   - tournament_results table (stores the actual outcome of award/total/drama bets)
--   - apply_boost(match_id, applied)              user RPC
--   - admin_set_tournament_result(...)            admin RPC
--   - score_predictions()                         admin RPC, recomputes everyone's points
--
-- Scoring rules:
--   Match:
--     winner/draw correct      +4
--     correct goal difference  +2
--     team1 exact goals        +1
--     team2 exact goals        +1
--     exact score bonus        +2
--     => max 10 in group stage
--   Stage multiplier:  group 1.0 · R32 1.25 · R16 1.5 · QF 2.0 · SF 2.5 · 3rd-place 2.0 · Final 3.0
--   Boost: x2 multiplier on top, max 3 boosts per stage, must be set before kickoff
--   Tournament:
--     winner exact 25, runner-up exact 15, third exact 8, fourth exact 8
--       (consolation: 4 if predicted team is one of the four semifinalists)
--     Player awards (top scorer / best player / best young / golden glove) exact 15/10/10/10
--     Total numbers proximity: exact 15 · ≤2 12 · ≤5 8 · ≤10 4 · else 0
--     Drama yes/no: correct 5
--   Predictions are scored against 90-minute scores only (matches.team1_score / team2_score)
-- ============================================================================

begin;

alter table public.match_predictions
  add column if not exists boost_applied boolean not null default false;

create table if not exists public.tournament_results (
  prediction_type text primary key,
  team_id         uuid references public.teams(id) on delete set null,
  string_value    text,
  number_value    numeric,
  bool_value      boolean,
  updated_at      timestamptz not null default now()
);

alter table public.tournament_results enable row level security;
drop policy if exists "read all" on public.tournament_results;
create policy "read all" on public.tournament_results for select using (true);

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.score_match(p1 integer, p2 integer, a1 integer, a2 integer)
returns integer
language plpgsql
immutable
as $$
declare pts integer := 0;
begin
  if p1 is null or p2 is null or a1 is null or a2 is null then
    return 0;
  end if;
  if (p1 > p2 and a1 > a2) or (p1 < p2 and a1 < a2) or (p1 = p2 and a1 = a2) then
    pts := pts + 4;
  end if;
  if (p1 - p2) = (a1 - a2) then pts := pts + 2; end if;
  if p1 = a1 then pts := pts + 1; end if;
  if p2 = a2 then pts := pts + 1; end if;
  if p1 = a1 and p2 = a2 then pts := pts + 2; end if;
  return pts;
end $$;

create or replace function public.round_multiplier(p_round text)
returns numeric
language sql
immutable
as $$
  select case
    when p_round like 'Matchday %'         then 1.0
    when p_round = 'Round of 32'           then 1.25
    when p_round = 'Round of 16'           then 1.5
    when p_round = 'Quarter-final'         then 2.0
    when p_round = 'Semi-final'            then 2.5
    when p_round = 'Match for third place' then 2.0
    when p_round = 'Final'                 then 3.0
    else 1.0
  end::numeric;
$$;

create or replace function public.boost_stage_key(p_round text, p_stage text)
returns text
language sql
immutable
as $$
  select case
    when p_stage = 'group'                 then 'group'
    when p_round = 'Round of 32'           then 'r32'
    when p_round = 'Round of 16'           then 'r16'
    when p_round = 'Quarter-final'         then 'qf'
    when p_round = 'Semi-final'            then 'sf'
    when p_round = 'Match for third place' then 'final_phase'
    when p_round = 'Final'                 then 'final_phase'
    else 'group'
  end;
$$;

create or replace function public.score_total_proximity(predicted numeric, actual numeric)
returns integer
language plpgsql
immutable
as $$
declare diff numeric;
begin
  if predicted is null or actual is null then return 0; end if;
  diff := abs(actual - predicted);
  if diff = 0 then return 15; end if;
  if diff <= 2 then return 12; end if;
  if diff <= 5 then return 8; end if;
  if diff <= 10 then return 4; end if;
  return 0;
end $$;

-- ----------------------------------------------------------------------------
-- User RPC: toggle boost
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
-- Admin RPC: set / clear tournament results
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_tournament_result(
  p_type      text,
  p_team_id   uuid,
  p_string    text,
  p_number    numeric,
  p_bool      boolean
) returns public.tournament_results
language plpgsql
security definer
set search_path = public
as $$
declare v public.tournament_results;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  insert into public.tournament_results (prediction_type, team_id, string_value, number_value, bool_value)
  values (p_type, p_team_id, p_string, p_number, p_bool)
  on conflict (prediction_type)
  do update set team_id      = excluded.team_id,
                string_value = excluded.string_value,
                number_value = excluded.number_value,
                bool_value   = excluded.bool_value,
                updated_at   = now()
  returning * into v;
  return v;
end $$;
grant execute on function public.admin_set_tournament_result(text, uuid, text, numeric, boolean) to authenticated;

create or replace function public.admin_clear_tournament_result(p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  delete from public.tournament_results where prediction_type = p_type;
end $$;
grant execute on function public.admin_clear_tournament_result(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Admin RPC: recompute everyone's points
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
      select mp.id            as pred_id,
             mp.team1_score   as pt1,
             mp.team2_score   as pt2,
             mp.boost_applied as boost,
             m.team1_score    as at1,
             m.team2_score    as at2,
             m.status         as mstatus,
             m.round          as mround
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

-- Realtime: ensure tournament_results pushes
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.tournament_results; exception when duplicate_object then null; end;
  end if;
end $$;

commit;
