CREATE OR REPLACE FUNCTION execute_trade(
  p_user_id uuid,
  p_stock_id uuid,
  p_type text,
  p_quantity int
)
RETURNS SETOF trades
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock stocks%ROWTYPE;
  v_portfolio portfolios%ROWTYPE;
  v_holding holdings%ROWTYPE;
  v_exec_price numeric;
  v_total numeric;
  v_new_price numeric;
  v_impact numeric;
  v_trade trades%ROWTYPE;
  v_username text;
  v_last_trade timestamptz;
  v_daily_volume int;
  v_max_quantity int := 50;
  v_cooldown_seconds int := 15;
  v_daily_limit int := 200;
BEGIN
  IF p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  IF p_quantity > v_max_quantity THEN
    RAISE EXCEPTION 'Maximum % shares per trade', v_max_quantity;
  END IF;

  IF p_type NOT IN ('buy', 'sell') THEN
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

  ELSE
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
  END IF;

  UPDATE stocks SET current_price = v_new_price WHERE id = p_stock_id;

  INSERT INTO price_history (stock_id, price) VALUES (p_stock_id, v_new_price);

  INSERT INTO trades (stock_id, user_id, username, type, quantity, price, total, is_fake)
  VALUES (p_stock_id, p_user_id, v_username, p_type, p_quantity, v_exec_price, v_total, false)
  RETURNING * INTO v_trade;

  RETURN NEXT v_trade;
END;
$$;
