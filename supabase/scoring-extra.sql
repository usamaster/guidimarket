-- ============================================================================
-- WK 2026 Voorspelpool — Extra prediction types (name-matching helpers only)
-- ============================================================================
-- Provides the lenient name-matching helpers used by dutch_zero_minutes:
--   - norm_name(text)            normalise (lowercase, strip accents/punct)
--   - names_match(text,text)     surname/order/subset-tolerant comparison
--   - score_name_overlap(...)    5 points per uniquely-matched player
--
-- IMPORTANT: this file must NOT (re)define score_predictions(). That function
-- lives in knockout.sql (the knockout-aware version with the +2 advance bonus).
-- Re-applying this file previously reverted score_predictions() to a pre-knockout
-- version and dropped the advance bonus — do not reintroduce it here.
-- ============================================================================

begin;

-- Helper: normalise a single name for lenient comparison.
--   - lowercase, strip common diacritics, drop punctuation
--   - collapse whitespace
create or replace function public.norm_name(p text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
    regexp_replace(
      translate(
        lower(coalesce(p, '')),
        'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ',
        'aaaaaaceeeeiiiinooooouuuuyyoa'
      ),
      '[^a-z ]', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

-- Helper: does predicted name refer to the same player as actual name?
--   Lenient: order-insensitive, surname-token match, and subset match so
--   "Flekken" == "Mark Flekken" == "Flekken Mark".
create or replace function public.names_match(pred text, act text)
returns boolean
language plpgsql
immutable
as $$
declare
  np text := public.norm_name(pred);
  na text := public.norm_name(act);
  pt text[];
  at2 text[];
  tok text;
begin
  if np = '' or na = '' then return false; end if;
  if np = na then return true; end if;

  pt  := string_to_array(np, ' ');
  at2 := string_to_array(na, ' ');

  -- surname (last token) matches on both sides
  if pt[array_length(pt,1)] = at2[array_length(at2,1)] then
    return true;
  end if;

  -- every token the (shorter) prediction gives is present in the actual name
  -- (handles surname-only, or first+last in any order)
  foreach tok in array pt loop
    if length(tok) >= 3 and not (tok = any(at2)) then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- Helper: lenient name overlap, 5 points per uniquely-matched actual name.
-- Each actual player can only be credited once, even if the prediction lists
-- the same surname twice.
create or replace function public.score_name_overlap(predicted text, actual text)
returns integer
language plpgsql
immutable
as $$
declare
  predicted_names text[];
  actual_names    text[];
  pn              text;
  hits            integer := 0;
  used            integer[] := '{}';
  i               integer;
  pred_tokens     text[];
  an_norm         text;
  an_tokens       text[];
  an_surname      text;
begin
  if predicted is null or actual is null then return 0; end if;
  actual_names := string_to_array(actual, ',');

  if position(',' in predicted) > 0 then
    -- Normal comma-separated prediction: match each of the first 5 names.
    predicted_names := (string_to_array(predicted, ','))[1:5];
    foreach pn in array predicted_names loop
      if public.norm_name(pn) = '' then continue; end if;
      for i in 1 .. coalesce(array_length(actual_names, 1), 0) loop
        if not (i = any(used)) and public.names_match(pn, actual_names[i]) then
          hits := hits + 1;
          used := used || i;
          exit;
        end if;
      end loop;
    end loop;
  else
    -- No commas: treat the whole entry as a bag of surname tokens and credit
    -- an actual player when their surname token appears in that bag.
    pred_tokens := string_to_array(public.norm_name(predicted), ' ');
    for i in 1 .. coalesce(array_length(actual_names, 1), 0) loop
      an_norm    := public.norm_name(actual_names[i]);
      if an_norm = '' then continue; end if;
      an_tokens  := string_to_array(an_norm, ' ');
      an_surname := an_tokens[array_length(an_tokens, 1)];
      if length(an_surname) >= 3 and an_surname = any(pred_tokens) then
        hits := hits + 1;
      end if;
    end loop;
    hits := least(hits, 5);
  end if;

  return hits * 5;
end $$;


commit;
