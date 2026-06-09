-- ============================================================================
-- WK 2026 Voorspelpool — Extra prediction types
-- ============================================================================
-- Adds scoring for two new tournament prediction types:
--   - most_goals_against   : single team prediction (exact = 15)
--   - dutch_zero_minutes   : comma-separated list of player names (5 per hit)
-- ============================================================================

begin;

-- Helper: case-insensitive trimmed name overlap, 5 points per hit
create or replace function public.score_name_overlap(predicted text, actual text)
returns integer
language plpgsql
immutable
as $$
declare
  predicted_names text[];
  actual_names    text[];
  pn              text;
  an              text;
  hits            integer := 0;
  matched         boolean;
begin
  if predicted is null or actual is null then return 0; end if;
  predicted_names := string_to_array(lower(predicted), ',');
  predicted_names := predicted_names[1:5];
  actual_names    := string_to_array(lower(actual), ',');
  foreach pn in array predicted_names loop
    matched := false;
    foreach an in array actual_names loop
      if trim(pn) <> '' and trim(pn) = trim(an) then
        matched := true;
        exit;
      end if;
    end loop;
    if matched then hits := hits + 1; end if;
  end loop;
  return hits * 5;
end $$;

-- Replace score_predictions with extended version covering the new types
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

commit;
