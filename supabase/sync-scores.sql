-- ============================================================================
-- WK 2026 Voorspelpool — Sync match scores from openfootball
-- ============================================================================
-- admin_sync_match_scores(p_rows jsonb): bulk-applies finished scores fetched
-- from the openfootball 2026 dataset. Each element:
--   { "external_id": "wc2026-...", "ft1": 2, "ft2": 0,
--     "ht1": 1, "ht2": 0, "et1": null, "et2": null,
--     "pen1": null, "pen2": null }
--
-- Behaviour:
--   - Only fills matches that don't already have a regular-time score, so any
--     result the admin entered by hand is never overwritten.
--   - Sets status = 'finished' and finished_at = now() for newly filled rows.
--   - The matches update trigger auto-resolves the knockout bracket; we also
--     call resolve_bracket() + score_predictions() explicitly so the whole
--     state is consistent after one call.
--   - Returns the number of matches updated.
--
-- Called by the `sync-scores` Edge Function (which does the HTTP fetch).
-- Apply: npm run apply-sync-scores
-- Idempotent — safe to re-run.
-- ============================================================================

begin;

create or replace function public.admin_sync_match_scores(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     jsonb;
  v_ext     text;
  v_ft1     integer;
  v_ft2     integer;
  v_count   integer := 0;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_ext := v_row->>'external_id';
    v_ft1 := nullif(v_row->>'ft1', '')::integer;
    v_ft2 := nullif(v_row->>'ft2', '')::integer;

    if v_ext is null or v_ft1 is null or v_ft2 is null then
      continue;
    end if;

    update public.matches m
       set team1_score = v_ft1,
           team2_score = v_ft2,
           team1_ht    = nullif(v_row->>'ht1', '')::integer,
           team2_ht    = nullif(v_row->>'ht2', '')::integer,
           team1_et    = nullif(v_row->>'et1', '')::integer,
           team2_et    = nullif(v_row->>'et2', '')::integer,
           team1_pen   = nullif(v_row->>'pen1', '')::integer,
           team2_pen   = nullif(v_row->>'pen2', '')::integer,
           status      = 'finished',
           finished_at = now()
     where m.external_id = v_ext
       and (m.status <> 'finished' or m.team1_score is null or m.team2_score is null);

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  perform public.resolve_bracket();
  perform public.score_predictions();

  return v_count;
end $$;

grant execute on function public.admin_sync_match_scores(jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- Read-only preview: which matches WOULD be filled, without writing anything.
-- Returns one row per incoming score that targets an existing, not-yet-scored
-- match, with both the current and the incoming values for a sanity check.
-- ----------------------------------------------------------------------------
create or replace function public.admin_preview_match_scores(p_rows jsonb)
returns table (
  external_id   text,
  round         text,
  team1_label   text,
  team2_label   text,
  current_score text,
  incoming_ft1  integer,
  incoming_ft2  integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  return query
  with incoming as (
    select
      el->>'external_id'              as ext,
      nullif(el->>'ft1', '')::integer as ft1,
      nullif(el->>'ft2', '')::integer as ft2
    from jsonb_array_elements(p_rows) el
  )
  select
    m.external_id,
    m.round,
    coalesce(t1.name, m.team1_placeholder, '?'),
    coalesce(t2.name, m.team2_placeholder, '?'),
    case
      when m.team1_score is not null and m.team2_score is not null
        then m.team1_score || ' - ' || m.team2_score
      else '—'
    end,
    i.ft1,
    i.ft2
  from incoming i
  join public.matches m on m.external_id = i.ext
  left join public.teams t1 on t1.id = m.team1_id
  left join public.teams t2 on t2.id = m.team2_id
  where i.ft1 is not null
    and i.ft2 is not null
    and (m.status <> 'finished' or m.team1_score is null or m.team2_score is null)
  order by m.kickoff_at;
end $$;

grant execute on function public.admin_preview_match_scores(jsonb) to authenticated;

commit;
