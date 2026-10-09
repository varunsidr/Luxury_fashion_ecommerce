-- Apply AFTER demo catalog and security hardening migrations, in isolated staging first.
-- This intentionally removes the old non-idempotent checkout signature.
BEGIN;
CREATE TABLE IF NOT EXISTS public.checkout_attempts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_key UUID NOT NULL,
  payload JSONB NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, attempt_key)
);
ALTER TABLE public.checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.checkout_attempts TO service_role;

DROP FUNCTION IF EXISTS public.create_checkout_order(UUID, JSONB, JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_user_id UUID, p_items JSONB, p_shipping_address JSONB,
  p_payment_method TEXT, p_idempotency_key UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payload JSONB;
  v_attempt public.checkout_attempts%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_order_id UUID;
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_quantity INTEGER;
  v_size TEXT;
  v_color TEXT;
  v_stock INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL OR p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50
    OR p_payment_method IS NULL OR p_payment_method NOT IN ('card_demo', 'cash_on_delivery')
    OR p_shipping_address IS NULL OR jsonb_typeof(p_shipping_address) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) i WHERE jsonb_typeof(i) <> 'object'
    OR COALESCE(i->>'quantity', '') !~ '^[0-9]+$'
    OR COALESCE(i->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) i
    GROUP BY i->>'id', i->>'size', i->>'color'
    HAVING sum((i->>'quantity')::integer) NOT BETWEEN 1 AND 20) THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;
  v_payload := jsonb_build_object('items', p_items, 'address', p_shipping_address, 'payment', p_payment_method);
  -- Serialize only identical user/attempt pairs; different customers cannot replay an order.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_idempotency_key::text, 0));
  SELECT * INTO v_attempt FROM public.checkout_attempts WHERE user_id = p_user_id AND attempt_key = p_idempotency_key;
  IF FOUND THEN
    IF v_attempt.payload <> v_payload THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN jsonb_build_object('order_id', v_attempt.order_id, 'total', v_attempt.total);
  END IF;
  -- Shared product locks in UUID order avoid crossed multi-product checkout deadlocks.
  -- Stock edits below lock the product before its size rows as well.
  PERFORM id FROM public.products WHERE id IN
    (SELECT (i->>'id')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY id FOR UPDATE;
  INSERT INTO public.profiles(id, full_name) VALUES(p_user_id, p_shipping_address->>'fullName')
    ON CONFLICT(id) DO UPDATE SET full_name = EXCLUDED.full_name;
  INSERT INTO public.orders(user_id, total, status, shipping_address, payment_method)
    VALUES(p_user_id, 0, 'pending', p_shipping_address, p_payment_method) RETURNING id INTO v_order_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;
    v_quantity := (v_item->>'quantity')::integer;
    v_size := NULLIF(v_item->>'size', '');
    v_color := NULLIF(v_item->>'color', '');
    IF v_quantity NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'INVALID_PAYLOAD'; END IF;
    IF COALESCE(cardinality(v_product.sizes), 0) > 0 THEN
      IF v_size IS NULL OR NOT (v_size = ANY(v_product.sizes)) THEN RAISE EXCEPTION 'INVALID_OPTION'; END IF;
    ELSIF v_size IS NOT NULL THEN RAISE EXCEPTION 'INVALID_OPTION'; END IF;
    IF v_product.image_url LIKE '/demo-products/%' OR jsonb_array_length(COALESCE(v_product.color_options, '[]'::jsonb)) = 0 THEN
      IF v_color IS NOT NULL THEN RAISE EXCEPTION 'INVALID_OPTION'; END IF;
    ELSIF v_color IS NULL OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_product.color_options) c WHERE c->>'name' = v_color) THEN
      RAISE EXCEPTION 'INVALID_OPTION';
    END IF;
    IF v_size IS NULL THEN
      UPDATE public.products SET stock = COALESCE(stock, 0) - v_quantity
        WHERE id = v_product.id AND COALESCE(stock, 0) >= v_quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;
    ELSE
      UPDATE public.product_size_stock SET stock = stock - v_quantity
        WHERE product_id = v_product.id AND size = v_size AND stock >= v_quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;
      SELECT COALESCE(sum(stock), 0) INTO v_stock FROM public.product_size_stock
        WHERE product_id = v_product.id AND size = ANY(v_product.sizes);
      UPDATE public.products SET stock = v_stock WHERE id = v_product.id;
    END IF;
    INSERT INTO public.order_items(order_id, product_id, quantity, unit_price, size, color)
      VALUES(v_order_id, v_product.id, v_quantity, v_product.price, v_size, v_color);
    v_total := v_total + v_product.price * v_quantity;
  END LOOP;
  UPDATE public.orders SET total = v_total WHERE id = v_order_id;
  INSERT INTO public.checkout_attempts(user_id, attempt_key, payload, order_id, total)
    VALUES(p_user_id, p_idempotency_key, v_payload, v_order_id, v_total);
  RETURN jsonb_build_object('order_id', v_order_id, 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.create_checkout_order(UUID, JSONB, JSONB, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(UUID, JSONB, JSONB, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.set_product_stock(p_product_id UUID, p_size TEXT, p_stock INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sizes TEXT[]; v_total INTEGER;
BEGIN
  IF p_stock IS NULL OR p_stock < 0 THEN RAISE EXCEPTION 'INVALID_STOCK'; END IF;
  SELECT sizes INTO v_sizes FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
  IF COALESCE(cardinality(v_sizes), 0) > 0 THEN
    IF p_size IS NULL OR NOT (p_size = ANY(v_sizes)) THEN RAISE EXCEPTION 'INVALID_OPTION'; END IF;
    INSERT INTO public.product_size_stock(product_id, size, stock) VALUES(p_product_id, p_size, p_stock)
      ON CONFLICT(product_id, size) DO UPDATE SET stock = EXCLUDED.stock;
    SELECT COALESCE(sum(stock), 0) INTO v_total FROM public.product_size_stock
      WHERE product_id = p_product_id AND size = ANY(v_sizes);
  ELSE
    IF p_size IS NOT NULL THEN RAISE EXCEPTION 'INVALID_OPTION'; END IF;
    v_total := p_stock;
  END IF;
  UPDATE public.products SET stock = v_total WHERE id = p_product_id;
  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.set_product_stock(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_product_stock(UUID, TEXT, INTEGER) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
