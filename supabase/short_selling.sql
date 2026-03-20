DO $$ BEGIN
  ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_type_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.short_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  entry_price numeric NOT NULL,
  collateral numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stock_id)
);

CREATE INDEX IF NOT EXISTS idx_short_positions_stock ON public.short_positions(stock_id);

ALTER TABLE public.short_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_short_positions" ON public.short_positions;
DROP POLICY IF EXISTS "auth_all_short_positions" ON public.short_positions;

CREATE POLICY "anon_read_short_positions" ON public.short_positions FOR SELECT USING (true);
CREATE POLICY "auth_all_short_positions" ON public.short_positions FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION liquidate_shorts_at_price(p_stock_id uuid, p_new_price numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sp RECORD;
  v_uname text;
BEGIN
  FOR sp IN
    DELETE FROM public.short_positions
    WHERE stock_id = p_stock_id
      AND p_new_price >= entry_price * 1.5
    RETURNING *
  LOOP
    SELECT COALESCE(display_name, 'Unknown') INTO v_uname FROM public.portfolios WHERE user_id = sp.user_id;
    INSERT INTO public.trades (stock_id, user_id, username, type, quantity, price, total, is_fake)
    VALUES (p_stock_id, sp.user_id, v_uname, 'cover', sp.quantity, p_new_price, 0, false);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS execute_trade(uuid, uuid, text, int);

CREATE OR REPLACE FUNCTION execute_trade(
  p_user_id uuid,
  p_stock_id uuid,
  p_type text,
  p_quantity int
)
RETURNS SETOF trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock stocks%ROWTYPE;
  v_portfolio portfolios%ROWTYPE;
  v_holding holdings%ROWTYPE;
  v_short short_positions%ROWTYPE;
  v_exec_price numeric;
  v_total numeric;
  v_new_price numeric;
  v_impact numeric;
  v_trade trades%ROWTYPE;
  v_username text;
  v_last_trade timestamptz;
  v_daily_volume int;
  v_max_quantity int := 50;
  v_cooldown_seconds int := 5;
  v_daily_limit int := 200;
  v_collateral numeric;
  v_payout numeric;
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  IF p_quantity > v_max_quantity THEN
    RAISE EXCEPTION 'Maximum % shares per trade', v_max_quantity;
  END IF;

  IF p_type NOT IN ('buy', 'sell', 'short', 'cover') THEN
    RAISE EXCEPTION 'Invalid trade type';
  END IF;

  SELECT MAX(created_at) INTO v_last_trade
  FROM trades
  WHERE user_id = p_user_id
    AND stock_id = p_stock_id
    AND is_fake = false;

  IF v_last_trade IS NOT NULL
     AND v_last_trade > now() - (v_cooldown_seconds || ' seconds')::interval THEN
    RAISE EXCEPTION 'Please wait % seconds between trades on the same stock', v_cooldown_seconds;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_daily_volume
  FROM trades
  WHERE user_id = p_user_id
    AND stock_id = p_stock_id
    AND is_fake = false
    AND created_at > now() - interval '24 hours';

  IF v_daily_volume + p_quantity > v_daily_limit THEN
    RAISE EXCEPTION 'Daily limit of % shares per stock reached (used %/% today)',
      v_daily_limit, v_daily_volume, v_daily_limit;
  END IF;

  SELECT * INTO v_stock FROM stocks WHERE id = p_stock_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock not found';
  END IF;

  SELECT * INTO v_portfolio FROM portfolios WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found';
  END IF;

  v_username := COALESCE(v_portfolio.display_name, 'Unknown');
  v_impact := 0.005 * sqrt(p_quantity::numeric);

  IF p_type = 'buy' THEN
    v_new_price := v_stock.current_price * (1.0 + v_impact);
    v_exec_price := v_new_price;
    v_total := v_exec_price * p_quantity;

    IF v_portfolio.credits < v_total THEN
      RAISE EXCEPTION 'Insufficient credits';
    END IF;

    UPDATE portfolios
    SET credits = credits - v_total
    WHERE user_id = p_user_id;

    SELECT * INTO v_holding FROM holdings
    WHERE user_id = p_user_id AND stock_id = p_stock_id;

    IF FOUND THEN
      UPDATE holdings
      SET avg_buy_price = ((avg_buy_price * quantity) + v_total) / (quantity + p_quantity),
          quantity = quantity + p_quantity
      WHERE user_id = p_user_id AND stock_id = p_stock_id;
    ELSE
      INSERT INTO holdings (user_id, stock_id, quantity, avg_buy_price)
      VALUES (p_user_id, p_stock_id, p_quantity, v_exec_price);
    END IF;

    UPDATE stocks SET current_price = v_new_price WHERE id = p_stock_id;
    INSERT INTO price_history (stock_id, price) VALUES (p_stock_id, v_new_price);
    PERFORM liquidate_shorts_at_price(p_stock_id, v_new_price);

    INSERT INTO trades (stock_id, user_id, username, type, quantity, price, total, is_fake)
    VALUES (p_stock_id, p_user_id, v_username, p_type, p_quantity, v_exec_price, v_total, false)
    RETURNING * INTO v_trade;
    RETURN NEXT v_trade;
    RETURN;

  ELSIF p_type = 'sell' THEN
    SELECT * INTO v_holding FROM holdings
    WHERE user_id = p_user_id AND stock_id = p_stock_id;

    IF NOT FOUND OR v_holding.quantity < p_quantity THEN
      RAISE EXCEPTION 'Insufficient shares';
    END IF;

    v_new_price := v_stock.current_price * (1.0 - v_impact);
    IF v_new_price < 0.01 THEN
      v_new_price := 0.01;
    END IF;
    v_exec_price := v_new_price;
    v_total := v_exec_price * p_quantity;

    UPDATE portfolios
    SET credits = credits + v_total
    WHERE user_id = p_user_id;

    IF v_holding.quantity = p_quantity THEN
      DELETE FROM holdings
      WHERE user_id = p_user_id AND stock_id = p_stock_id;
    ELSE
      UPDATE holdings
      SET quantity = quantity - p_quantity
      WHERE user_id = p_user_id AND stock_id = p_stock_id;
    END IF;

    UPDATE stocks SET current_price = v_new_price WHERE id = p_stock_id;
    INSERT INTO price_history (stock_id, price) VALUES (p_stock_id, v_new_price);

    INSERT INTO trades (stock_id, user_id, username, type, quantity, price, total, is_fake)
    VALUES (p_stock_id, p_user_id, v_username, p_type, p_quantity, v_exec_price, v_total, false)
    RETURNING * INTO v_trade;
    RETURN NEXT v_trade;
    RETURN;

  ELSIF p_type = 'short' THEN
    SELECT * INTO v_short FROM short_positions
    WHERE user_id = p_user_id AND stock_id = p_stock_id FOR UPDATE;
    IF FOUND THEN
      RAISE EXCEPTION 'Already have a short position on this stock';
    END IF;

    v_new_price := v_stock.current_price * (1.0 - v_impact);
    IF v_new_price < 0.01 THEN
      v_new_price := 0.01;
    END IF;
    v_exec_price := v_new_price;
    v_total := v_exec_price * p_quantity;
    v_collateral := v_total * 2;

    IF v_portfolio.credits < v_collateral THEN
      RAISE EXCEPTION 'Insufficient credits for collateral';
    END IF;

    UPDATE portfolios
    SET credits = credits - v_collateral
    WHERE user_id = p_user_id;

    INSERT INTO short_positions (user_id, stock_id, quantity, entry_price, collateral)
    VALUES (p_user_id, p_stock_id, p_quantity, v_exec_price, v_collateral);

    UPDATE stocks SET current_price = v_new_price WHERE id = p_stock_id;
    INSERT INTO price_history (stock_id, price) VALUES (p_stock_id, v_new_price);

    INSERT INTO trades (stock_id, user_id, username, type, quantity, price, total, is_fake)
    VALUES (p_stock_id, p_user_id, v_username, p_type, p_quantity, v_exec_price, v_total, false)
    RETURNING * INTO v_trade;
    RETURN NEXT v_trade;
    RETURN;

  ELSE
    SELECT * INTO v_short FROM short_positions
    WHERE user_id = p_user_id AND stock_id = p_stock_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No short position';
    END IF;
    IF v_short.quantity <> p_quantity THEN
      RAISE EXCEPTION 'Quantity must match short position';
    END IF;

    v_new_price := v_stock.current_price * (1.0 + v_impact);
    v_exec_price := v_new_price;
    v_total := v_exec_price * p_quantity;
    v_payout := GREATEST(0::numeric, v_short.collateral + (v_short.entry_price - v_exec_price) * p_quantity);

    UPDATE portfolios
    SET credits = credits + v_payout
    WHERE user_id = p_user_id;

    DELETE FROM short_positions WHERE user_id = p_user_id AND stock_id = p_stock_id;

    UPDATE stocks SET current_price = v_new_price WHERE id = p_stock_id;
    INSERT INTO price_history (stock_id, price) VALUES (p_stock_id, v_new_price);
    PERFORM liquidate_shorts_at_price(p_stock_id, v_new_price);

    INSERT INTO trades (stock_id, user_id, username, type, quantity, price, total, is_fake)
    VALUES (p_stock_id, p_user_id, v_username, p_type, p_quantity, v_exec_price, v_payout, false)
    RETURNING * INTO v_trade;
    RETURN NEXT v_trade;
    RETURN;
  END IF;
END;
$$;
