-- Apply after purchase safeguards, admin catalog, order lifecycle and review workflow.
-- No email is sent by SQL. Workers must use these service-only RPCs.
BEGIN;
ALTER TABLE public.restock_notifications
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_payload jsonb,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS restock_delivery_due ON public.restock_notifications(next_attempt_at, id)
  WHERE notified_at IS NULL AND ready_at IS NOT NULL AND NOT needs_review;

CREATE OR REPLACE FUNCTION public.restock_option_available(p_product_id uuid, p_size text, p_color text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT
    (p_color IS NULL OR (p.image_url NOT LIKE '/demo-products/%' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(p.color_options) c WHERE c->>'name' = p_color)))
    AND CASE WHEN coalesce(cardinality(p.sizes),0) > 0 THEN
      (p_size IS NULL OR p_size = ANY(p.sizes)) AND EXISTS (
        SELECT 1 FROM product_size_stock s WHERE s.product_id = p.id
          AND s.size = ANY(p.sizes) AND (p_size IS NULL OR s.size = p_size) AND s.stock > 0)
    ELSE p_size IS NULL AND p.stock > 0 END
    FROM products p WHERE p.id = p_product_id), false);
$$;

CREATE OR REPLACE FUNCTION public.subscribe_restock(
  p_product_id uuid, p_email text, p_size text, p_color text, p_token text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product products%ROWTYPE; v_id uuid; v_email text := lower(btrim(p_email));
BEGIN
  IF v_email IS NULL OR length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
  -- All inventory writers lock the parent first. Subscription cannot race the
  -- zero-to-positive transaction and miss the corresponding queue transition.
  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
  IF (p_size IS NOT NULL AND NOT (p_size = ANY(v_product.sizes)))
    OR (p_color IS NOT NULL AND (v_product.image_url LIKE '/demo-products/%' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_product.color_options) c WHERE c->>'name' = p_color)))
    THEN RAISE EXCEPTION 'INVALID_OPTION'; END IF;
  IF restock_option_available(p_product_id,p_size,p_color) THEN RAISE EXCEPTION 'ALREADY_AVAILABLE'; END IF;
  INSERT INTO restock_notifications(product_id,email,size,color,unsubscribe_token)
    VALUES(p_product_id,v_email,p_size,p_color,p_token) ON CONFLICT DO NOTHING RETURNING id INTO v_id;
  RETURN CASE WHEN v_id IS NULL THEN 'already_subscribed' ELSE 'subscribed' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_restock_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sizes text[]; v_any_returned boolean := false; v_size text;
BEGIN
  IF NEW.stock <= 0 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN IF OLD.stock > 0 THEN RETURN NEW; END IF; END IF;
  IF TG_TABLE_NAME = 'products' THEN
    -- Sized availability comes from configured rows, never the aggregate field.
    IF coalesce(cardinality(NEW.sizes),0) > 0 THEN RETURN NEW; END IF;
    UPDATE restock_notifications SET ready_at = coalesce(ready_at,now()), next_attempt_at = coalesce(next_attempt_at,now())
      WHERE product_id = NEW.id AND size IS NULL AND notified_at IS NULL;
  ELSE
    SELECT sizes INTO v_sizes FROM products WHERE id = NEW.product_id;
    v_size := NEW.size;
    IF NOT (v_size = ANY(v_sizes)) THEN RETURN NEW; END IF;
    SELECT NOT EXISTS (SELECT 1 FROM product_size_stock s WHERE s.product_id = NEW.product_id
      AND s.size = ANY(v_sizes) AND s.size <> v_size AND s.stock > 0) INTO v_any_returned;
    UPDATE restock_notifications SET ready_at = coalesce(ready_at,now()), next_attempt_at = coalesce(next_attempt_at,now())
      WHERE product_id = NEW.product_id AND notified_at IS NULL AND (size = v_size OR size IS NULL AND v_any_returned);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS restock_unsized_transition ON public.products;
CREATE TRIGGER restock_unsized_transition AFTER UPDATE OF stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.queue_restock_transition();
DROP TRIGGER IF EXISTS restock_size_transition ON public.product_size_stock;
CREATE TRIGGER restock_size_transition AFTER INSERT OR UPDATE OF stock ON public.product_size_stock
  FOR EACH ROW EXECUTE FUNCTION public.queue_restock_transition();

CREATE OR REPLACE FUNCTION public.claim_restock_notifications(p_product_id uuid DEFAULT NULL, p_limit integer DEFAULT 10)
RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product products%ROWTYPE; v_request restock_notifications%ROWTYPE; v_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10 THEN RAISE EXCEPTION 'INVALID_LIMIT'; END IF;
  -- Resend deduplicates for 24 hours. Stop ambiguous retries after 23 hours;
  -- an operator must reconcile provider acceptance rather than risk a resend.
  FOR v_product IN SELECT p.* FROM products p WHERE (p_product_id IS NULL OR p.id = p_product_id)
    AND EXISTS (SELECT 1 FROM restock_notifications n WHERE n.product_id = p.id AND n.notified_at IS NULL
      AND n.ready_at IS NOT NULL AND NOT n.needs_review AND n.next_attempt_at <= now()
      AND (n.claimed_at IS NULL OR n.claimed_at <= now() - interval '10 minutes'))
    ORDER BY p.id FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE restock_notifications SET needs_review = true, last_error = 'RETRY_WINDOW_EXPIRED'
      WHERE product_id = v_product.id AND notified_at IS NULL AND NOT needs_review
        AND first_attempt_at <= now() - interval '23 hours'
        AND (claimed_at IS NULL OR claimed_at <= now() - interval '10 minutes');
    FOR v_request IN SELECT n.* FROM restock_notifications n WHERE n.product_id = v_product.id
      AND n.notified_at IS NULL AND n.ready_at IS NOT NULL AND NOT n.needs_review AND n.next_attempt_at <= now()
      AND (n.claimed_at IS NULL OR n.claimed_at <= now() - interval '10 minutes')
      AND restock_option_available(n.product_id,n.size,n.color)
      ORDER BY n.next_attempt_at,n.id LIMIT (p_limit - v_count) FOR UPDATE SKIP LOCKED
    LOOP
      UPDATE restock_notifications SET claim_token = gen_random_uuid(), claimed_at = now(),
        first_attempt_at = coalesce(first_attempt_at,now()), attempt_count = attempt_count + 1
        WHERE id = v_request.id RETURNING * INTO v_request;
      RETURN NEXT to_jsonb(v_request) || jsonb_build_object('product_name',v_product.name,'category',v_product.category);
      v_count := v_count + 1;
    END LOOP;
    EXIT WHEN v_count >= p_limit;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_restock_delivery(p_id uuid, p_claim uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_product_id uuid; v_payload jsonb;
BEGIN
  SELECT product_id INTO v_product_id FROM restock_notifications WHERE id = p_id;
  PERFORM 1 FROM products WHERE id = v_product_id FOR UPDATE;
  UPDATE restock_notifications SET delivery_payload = coalesce(delivery_payload,p_payload)
    WHERE id = p_id AND claim_token = p_claim AND notified_at IS NULL AND NOT needs_review
      AND claimed_at > now() - interval '10 minutes' AND first_attempt_at > now() - interval '23 hours'
      AND restock_option_available(product_id,size,color)
    RETURNING delivery_payload INTO v_payload;
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_restock_delivery(
  p_id uuid, p_claim uuid, p_success boolean, p_error text DEFAULT NULL, p_retryable boolean DEFAULT true
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE restock_notifications SET
    notified_at = CASE WHEN p_success THEN now() ELSE NULL END,
    next_attempt_at = CASE WHEN p_success THEN NULL ELSE now() + make_interval(secs => least(3600,60 * power(2,least(attempt_count - 1,6)))::integer) END,
    last_error = CASE WHEN p_success THEN NULL ELSE left(p_error,100) END,
    needs_review = NOT p_success AND NOT p_retryable,
    claim_token = NULL, claimed_at = NULL
    WHERE id = p_id AND claim_token = p_claim AND notified_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.restock_option_available(uuid,text,text), public.subscribe_restock(uuid,text,text,text,text),
  public.queue_restock_transition(), public.claim_restock_notifications(uuid,integer),
  public.prepare_restock_delivery(uuid,uuid,jsonb), public.finish_restock_delivery(uuid,uuid,boolean,text,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restock_option_available(uuid,text,text), public.subscribe_restock(uuid,text,text,text,text),
  public.claim_restock_notifications(uuid,integer), public.prepare_restock_delivery(uuid,uuid,jsonb),
  public.finish_restock_delivery(uuid,uuid,boolean,text,boolean) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
