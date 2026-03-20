ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS impacts_already_applied boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION publish_due_news_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  imp RECORD;
  v_new_price numeric;
  v_pct numeric;
BEGIN
  FOR r IN
    SELECT * FROM news_items
    WHERE published = false
      AND published_at IS NOT NULL
      AND published_at <= now()
    ORDER BY published_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    IF NOT COALESCE(r.impacts_already_applied, false) THEN
      FOR imp IN SELECT * FROM jsonb_to_recordset(r.impacts::jsonb) AS x(stock_id uuid, ticker text, pct numeric)
      LOOP
        v_pct := imp.pct / 100.0;
        UPDATE stocks
        SET current_price = GREATEST(0.01, current_price * (1.0 + v_pct))
        WHERE id = imp.stock_id
        RETURNING current_price INTO v_new_price;

        IF v_new_price IS NOT NULL THEN
          INSERT INTO price_history (stock_id, price) VALUES (imp.stock_id, v_new_price);
        END IF;
      END LOOP;
    END IF;

    UPDATE news_items
    SET published = true, impacts_already_applied = true
    WHERE id = r.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION publish_due_news_items() TO authenticated;
GRANT EXECUTE ON FUNCTION publish_due_news_items() TO anon;

UPDATE news_items AS n
SET
  published = false,
  impacts_already_applied = false,
  published_at = now() + (o.rn * interval '10 minutes')
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn
  FROM news_items
) AS o
WHERE n.id = o.id;
