-- ============================================================================
-- WK 2026 Voorspelpool — Admin prediction completion status
-- ============================================================================
-- Adds admin_prediction_status(): per-user count of completed predictions vs
-- the total expected, so the admin can chase players who haven't finished.
-- Runs as security definer so the admin sees everyone's progress even while
-- predictions are still private (pre-lock).
-- ============================================================================

begin;

drop function if exists public.admin_prediction_status();

create or replace function public.admin_prediction_status()
returns table (
  user_id          uuid,
  display_name     text,
  matches_done     integer,
  matches_total    integer,
  tournament_done  integer,
  tournament_total integer,
  knockout_done    integer,
  knockout_total   integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matches_total  integer;
  v_knockout_total integer;
  v_types text[] := array[
    'winner','runner_up','third','fourth','most_goals_against',
    'top_scorer','golden_ball','young_player','golden_glove','dutch_zero_minutes',
    'total_goals','total_red_cards','total_yellow_cards','total_penalties','highest_match_goals',
    'host_reaches_qf','undefeated_team_exists','any_zero_zero','final_goes_to_et','hat_trick_scored'
  ];
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;

  select count(*)::integer into v_matches_total
  from public.matches m
  where m.stage = 'group'
    and m.team1_id is not null
    and m.team2_id is not null;

  -- Knockout matches that are currently predictable: teams known and the
  -- round hasn't started yet. Started/locked rounds aren't counted as missing.
  select count(*)::integer into v_knockout_total
  from public.matches m
  where m.stage = 'knockout'
    and m.team1_id is not null
    and m.team2_id is not null
    and not public.knockout_round_started(m.round);

  return query
  select
    p.user_id,
    p.display_name,
    coalesce(mp.cnt, 0)::integer        as matches_done,
    v_matches_total                     as matches_total,
    coalesce(tp.cnt, 0)::integer        as tournament_done,
    array_length(v_types, 1)::integer   as tournament_total,
    coalesce(ko.cnt, 0)::integer        as knockout_done,
    v_knockout_total                    as knockout_total
  from public.profiles p
  left join (
    select mp.user_id, count(distinct mp.match_id) as cnt
    from public.match_predictions mp
    join public.matches m on m.id = mp.match_id
    where mp.team1_score is not null
      and mp.team2_score is not null
      and m.stage = 'group'
      and m.team1_id is not null
      and m.team2_id is not null
    group by mp.user_id
  ) mp on mp.user_id = p.user_id
  left join (
    select tp.user_id, count(distinct tp.prediction_type) as cnt
    from public.tournament_predictions tp
    where tp.prediction_type = any(v_types)
      and (
        tp.team_id is not null
        or nullif(btrim(tp.string_value), '') is not null
        or tp.number_value is not null
        or tp.bool_value is not null
      )
    group by tp.user_id
  ) tp on tp.user_id = p.user_id
  left join (
    select mp.user_id, count(distinct mp.match_id) as cnt
    from public.match_predictions mp
    join public.matches m on m.id = mp.match_id
    where mp.team1_score is not null
      and mp.team2_score is not null
      and mp.advance_team_id is not null
      and m.stage = 'knockout'
      and m.team1_id is not null
      and m.team2_id is not null
      and not public.knockout_round_started(m.round)
    group by mp.user_id
  ) ko on ko.user_id = p.user_id
  order by
    (coalesce(mp.cnt, 0) + coalesce(tp.cnt, 0) + coalesce(ko.cnt, 0)) asc,
    p.display_name asc;
end $$;

grant execute on function public.admin_prediction_status() to authenticated;

commit;
