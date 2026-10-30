-- Apply after purchase safeguards/admin catalog. Cancellation is a demo operation.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_restored_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_admin_order_status(p_order_id UUID, p_status TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
  v_product public.products%ROWTYPE;
  v_stock BIGINT;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending','processing','shipped','delivered','cancelled') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  -- A repeated request is an idempotent read, including historically cancelled orders.
  IF v_order.status = p_status THEN RETURN to_jsonb(v_order); END IF;
  IF NOT ((v_order.status = 'pending' AND p_status IN ('processing','cancelled'))
    OR (v_order.status = 'processing' AND p_status IN ('shipped','cancelled'))
    OR (v_order.status = 'shipped' AND p_status = 'delivered')) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  IF p_status = 'cancelled' THEN
    -- Match checkout/catalog/stock lock order before touching size quantities.
    PERFORM p.id FROM public.products p WHERE p.id IN
      (SELECT product_id FROM public.order_items WHERE order_id = p_order_id)
      ORDER BY p.id FOR UPDATE;
    FOR v_item IN SELECT product_id, size, sum(quantity)::BIGINT AS quantity
      FROM public.order_items WHERE order_id = p_order_id AND product_id IS NOT NULL
      GROUP BY product_id, size ORDER BY product_id, size LOOP
      SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
      IF NOT FOUND THEN CONTINUE; END IF;
      IF coalesce(cardinality(v_product.sizes),0) > 0 THEN
        IF v_item.size IS NULL OR NOT (v_item.size = ANY(v_product.sizes)) THEN
          RAISE EXCEPTION 'INVENTORY_CONFIGURATION_CHANGED';
        END IF;
        UPDATE public.product_size_stock SET stock = stock + v_item.quantity
          WHERE product_id = v_item.product_id AND size = v_item.size;
        IF NOT FOUND THEN RAISE EXCEPTION 'INVENTORY_CONFIGURATION_CHANGED'; END IF;
        SELECT coalesce(sum(stock),0) INTO v_stock FROM public.product_size_stock
          WHERE product_id = v_item.product_id AND size = ANY(v_product.sizes);
        UPDATE public.products SET stock = v_stock WHERE id = v_item.product_id;
      ELSE
        IF v_item.size IS NOT NULL THEN RAISE EXCEPTION 'INVENTORY_CONFIGURATION_CHANGED'; END IF;
        UPDATE public.products SET stock = coalesce(stock,0) + v_item.quantity WHERE id = v_item.product_id;
      END IF;
    END LOOP;
    UPDATE public.orders SET stock_restored_at = now() WHERE id = p_order_id;
  END IF;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id RETURNING * INTO v_order;
  RETURN to_jsonb(v_order);
END;
$$;
REVOKE ALL ON FUNCTION public.set_admin_order_status(UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_order_status(UUID,TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
