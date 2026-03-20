CREATE OR REPLACE FUNCTION process_scheduled_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ev RECORD;
  imp RECORD;
  v_new_price numeric;
  v_pct numeric;
BEGIN
  FOR ev IN
    SELECT * FROM market_events
    WHERE executed = false AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    FOR imp IN SELECT * FROM jsonb_to_recordset(ev.impacts::jsonb) AS x(stock_id uuid, ticker text, pct numeric)
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

    UPDATE market_events
    SET executed = true, executed_at = now()
    WHERE id = ev.id;

    INSERT INTO news_items (headline, impacts, published, published_at)
    VALUES (ev.news_headline, ev.impacts, true, now());
  END LOOP;
END;
$$;
