-- Apply after demo catalog, security hardening and purchase safeguards.
-- Legacy invalid rows are retained for explicit repair; NOT VALID checks enforce
-- all subsequent inserts/updates without silently rewriting historical data.
BEGIN;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_admin_price_check;
ALTER TABLE public.products ADD CONSTRAINT products_admin_price_check
  CHECK (price IS NOT NULL AND price >= 0 AND price < 10000000000) NOT VALID;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_admin_stock_check;
ALTER TABLE public.products ADD CONSTRAINT products_admin_stock_check
  CHECK (stock IS NOT NULL AND stock >= 0) NOT VALID;
REVOKE INSERT, UPDATE, DELETE ON public.products, public.product_size_stock FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products, public.product_size_stock TO service_role;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_size_stock'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_catalog_insert_guard ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_catalog_update_guard ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_catalog_delete_guard ON public.%I', t);
    EXECUTE format('CREATE POLICY admin_catalog_insert_guard ON public.%I AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY admin_catalog_update_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false)', t);
    EXECUTE format('CREATE POLICY admin_catalog_delete_guard ON public.%I AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false)', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.save_admin_product(p_product_id uuid, p_product jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
  v_sizes text[];
  v_images text[];
  v_total bigint;
  v_price numeric;
  v_stock numeric;
  v_product public.products%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_product) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_product->'name') IS DISTINCT FROM 'string'
    OR length(trim(p_product->>'name')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_product->'price') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_product->'stock') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_product->'sizes') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_product->'images') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_product->'description') IS DISTINCT FROM 'string'
    OR length(p_product->>'description') > 10000
    OR jsonb_typeof(p_product->'image_url') IS DISTINCT FROM 'string'
    OR p_product->>'category' IS NULL
    OR p_product->>'category' NOT IN ('Women''s Dress','Women''s Blouse & Shirt','Women''s Jacket','Women''s Skirt','Women''s Trousers','Men''s Suit','Men''s Shirt','Men''s Trousers','Men''s Jacket','Shoes','Bags','Accessories','Perfume','Makeup')
    THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
  v_price := (p_product->>'price')::numeric;
  v_stock := (p_product->>'stock')::numeric;
  IF v_price < 0 OR v_price >= 10000000000 OR v_price <> round(v_price, 2)
    OR v_stock < 0 OR v_stock > 2147483647 OR v_stock <> trunc(v_stock)
    THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
  SELECT coalesce(array_agg(value), '{}'::text[]) INTO v_sizes FROM jsonb_array_elements_text(p_product->'sizes');
  SELECT coalesce(array_agg(value), '{}'::text[]) INTO v_images FROM jsonb_array_elements_text(p_product->'images');
  IF cardinality(v_sizes) > 15 OR cardinality(v_images) > 12
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_product->'sizes') s WHERE jsonb_typeof(s) <> 'string')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_product->'images') s WHERE jsonb_typeof(s) <> 'string')
    OR EXISTS (SELECT 1 FROM unnest(v_sizes) s WHERE s IS NULL OR s NOT IN ('XS','S','M','L','XL','XXL','36','37','38','39','40','41','42','43','44'))
    OR (SELECT count(DISTINCT s) FROM unnest(v_sizes) s) <> cardinality(v_sizes)
    THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;

  IF p_product_id IS NULL THEN
    INSERT INTO public.products(name, category, price, stock) VALUES(trim(p_product->>'name'),p_product->>'category',v_price,0) RETURNING id INTO v_id;
  ELSE
    -- Parent-product lock is also used by checkout and per-size stock changes.
    SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
    v_id := v_product.id;
  END IF;
  DELETE FROM public.product_size_stock WHERE product_id = v_id AND NOT (size = ANY(v_sizes));
  INSERT INTO public.product_size_stock(product_id, size, stock)
    SELECT v_id, size, 0 FROM unnest(v_sizes) size
    ON CONFLICT(product_id, size) DO NOTHING;
  IF cardinality(v_sizes) > 0 THEN
    SELECT coalesce(sum(stock),0) INTO v_total FROM public.product_size_stock WHERE product_id = v_id AND size = ANY(v_sizes);
  ELSIF p_product_id IS NULL THEN v_total := v_stock;
  ELSIF coalesce(cardinality(v_product.sizes),0) = 0 THEN
    -- Catalog edits never overwrite stock changed by checkout since form load.
    -- Existing unsized quantities are edited only through set_product_stock.
    v_total := v_product.stock;
  ELSE v_total := 0; -- Removing all sizes starts an unsized item at zero.
  END IF;
  IF v_total > 2147483647 THEN RAISE EXCEPTION 'INVALID_STOCK_TOTAL'; END IF;
  UPDATE public.products SET name = trim(p_product->>'name'), category = p_product->>'category', price = v_price,
    description = p_product->>'description', sizes = v_sizes, images = v_images,
    image_url = p_product->>'image_url', stock = v_total WHERE id = v_id RETURNING * INTO v_product;
  RETURN to_jsonb(v_product);
END;
$$;
REVOKE ALL ON FUNCTION public.save_admin_product(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_product(uuid,jsonb) TO service_role;

-- Supabase storage exists in hosted projects. Public images remain readable;
-- restrictive policies prohibit browser-role product-image writes even if an
-- older permissive storage policy exists. Uploads use the server service role.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      VALUES('product-images','product-images',true,2097152,ARRAY['image/jpeg','image/png','image/webp'])
      ON CONFLICT(id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];
    DROP POLICY IF EXISTS admin_product_images_insert_guard ON storage.objects;
    DROP POLICY IF EXISTS admin_product_images_update_guard ON storage.objects;
    DROP POLICY IF EXISTS admin_product_images_delete_guard ON storage.objects;
    CREATE POLICY admin_product_images_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'product-images');
    CREATE POLICY admin_product_images_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (bucket_id <> 'product-images') WITH CHECK (bucket_id <> 'product-images');
    CREATE POLICY admin_product_images_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id <> 'product-images');
  END IF;
END $$;
COMMIT;
