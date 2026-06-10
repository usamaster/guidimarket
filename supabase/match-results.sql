-- ============================================================================
-- WK 2026 Voorspelpool — Manual match results
-- ============================================================================
-- admin_set_match_result(): lets the admin enter a match result + statistics
-- by hand. The regular-time score (team1_score/team2_score) is what player
-- predictions are scored against (90 minutes, no penalties). After saving the
-- admin runs score_predictions() to recompute everyone's points.
-- ============================================================================

begin;

create or replace function public.admin_set_match_result(
  p_match_id     uuid,
  p_team1_score  integer,
  p_team2_score  integer,
  p_status       text default 'finished',
  p_team1_ht     integer default null,
  p_team2_ht     integer default null,
  p_team1_et     integer default null,
  p_team2_et     integer default null,
  p_team1_pen    integer default null,
  p_team2_pen    integer default null,
  p_yellow_cards integer default null,
  p_red_cards    integer default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.matches;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  if p_status not in ('scheduled','live','finished','cancelled') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.matches
    set team1_score  = p_team1_score,
        team2_score  = p_team2_score,
        status       = p_status,
        team1_ht     = p_team1_ht,
        team2_ht     = p_team2_ht,
        team1_et     = p_team1_et,
        team2_et     = p_team2_et,
        team1_pen    = p_team1_pen,
        team2_pen    = p_team2_pen,
        yellow_cards = p_yellow_cards,
        red_cards    = p_red_cards,
        finished_at  = case when p_status = 'finished' then now() else null end
    where id = p_match_id
    returning * into v;

  if v.id is null then raise exception 'match not found'; end if;
  return v;
end $$;

grant execute on function public.admin_set_match_result(
  uuid, integer, integer, text, integer, integer, integer, integer, integer, integer, integer, integer
) to authenticated;

commit;
