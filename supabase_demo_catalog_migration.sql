-- Apply once in the Supabase SQL editor before seeding the demo catalog.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sizes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color_options JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS color TEXT;

CREATE TABLE IF NOT EXISTS public.product_size_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE(product_id, size)
);
ALTER TABLE public.product_size_stock ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.product_size_stock TO anon, authenticated;
DROP POLICY IF EXISTS "Public can read product size stock" ON public.product_size_stock;
CREATE POLICY "Public can read product size stock" ON public.product_size_stock FOR SELECT USING (true);
CREATE UNIQUE INDEX IF NOT EXISTS product_size_stock_product_size_unique ON public.product_size_stock(product_id, size);

CREATE TABLE IF NOT EXISTS public.restock_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  size TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  unsubscribe_token TEXT UNIQUE
);
ALTER TABLE public.restock_notifications ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS restock_notifications_pending_unique
  ON public.restock_notifications (product_id, lower(email), COALESCE(size, ''), COALESCE(color, ''))
  WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS restock_notifications_pending_product
  ON public.restock_notifications (product_id, size) WHERE notified_at IS NULL;

ALTER TABLE public.restock_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.restock_notifications FROM anon, authenticated;
GRANT ALL ON public.restock_notifications TO service_role;

-- The checkout RPC snapshots the selected options and checks size stock when a
-- size is supplied. Color stock is shared with that size for this demo catalog.
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
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_size TEXT;
  v_color TEXT;
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

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_size := NULLIF(v_item->>'size', '');
    v_color := NULLIF(v_item->>'color', '');
    IF v_quantity < 1 OR v_quantity > 20 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    IF v_size IS NULL THEN
      UPDATE products SET stock = COALESCE(stock, 0) - v_quantity
      WHERE id = v_product_id AND COALESCE(stock, 0) >= v_quantity
      RETURNING price INTO v_price;
    ELSE
      UPDATE product_size_stock SET stock = stock - v_quantity
      WHERE product_id = v_product_id AND size = v_size AND stock >= v_quantity;
      IF FOUND THEN
        UPDATE products SET stock = GREATEST(COALESCE(stock, 0) - v_quantity, 0)
        WHERE id = v_product_id RETURNING price INTO v_price;
      END IF;
    END IF;
    IF v_price IS NULL THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, size, color)
    VALUES (v_order_id, v_product_id, v_quantity, v_price, v_size, v_color);
    v_total := v_total + v_price * v_quantity;
    v_price := NULL;
  END LOOP;

  UPDATE orders SET total = v_total WHERE id = v_order_id;
  RETURN jsonb_build_object('order_id', v_order_id, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(UUID, JSONB, JSONB, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
