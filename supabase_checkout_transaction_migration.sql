-- Apply in the Supabase SQL editor to install or update checkout stock handling.
-- Creates the order, snapshots current prices, and inserts all lines in one transaction.
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_user_id UUID,
  p_items JSONB,
  p_shipping_address JSONB,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_total NUMERIC(12,2);
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_price NUMERIC(12,2);
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Invalid order payload';
  END IF;
  IF p_payment_method NOT IN ('card_demo', 'cash_on_delivery') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;
  IF jsonb_typeof(p_shipping_address) <> 'object' THEN RAISE EXCEPTION 'Invalid shipping address'; END IF;

  INSERT INTO profiles (id, full_name) VALUES (p_user_id, p_shipping_address->>'fullName')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO orders (user_id, total, status, shipping_address, payment_method)
  VALUES (p_user_id, 0, 'pending', p_shipping_address, p_payment_method)
  RETURNING id INTO v_order_id;

  v_total := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    IF v_quantity < 1 OR v_quantity > 20 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    UPDATE products
    SET stock = COALESCE(stock, 0) - v_quantity
    WHERE id = v_product_id
      AND COALESCE(stock, 0) >= v_quantity
    RETURNING price INTO v_price;
    IF NOT FOUND THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;
    IF v_price < 0 THEN RAISE EXCEPTION 'Product unavailable'; END IF;
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, v_product_id, v_quantity, v_price);
    v_total := v_total + v_price * v_quantity;
  END LOOP;

  UPDATE orders SET total = v_total WHERE id = v_order_id;
  RETURN jsonb_build_object('order_id', v_order_id, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(UUID, JSONB, JSONB, TEXT) TO service_role;
