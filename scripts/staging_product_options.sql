-- FIXTURE SETUP ONLY: run manually on an isolated staging demo database.
-- Resets stock for exactly these demo photographs; never use as a shared/live reset.
-- Brown Twist Blouse keeps its existing UUID and receives S=0, M=4, L=5.
BEGIN;
UPDATE public.products SET sizes = ARRAY['S','M','L'], stock = CASE
  WHEN image_url = '/kadin-bluz-1.jpg' THEN 9
  WHEN image_url = '/demo-products/womens-dress/01.jpg' THEN 6 ELSE 0 END
WHERE image_url IN ('/kadin-bluz-1.jpg', '/demo-products/womens-dress/01.jpg', '/demo-products/womens-dress/05.jpg');
DELETE FROM public.product_size_stock WHERE product_id IN (
  SELECT id FROM public.products WHERE image_url IN
    ('/kadin-bluz-1.jpg', '/demo-products/womens-dress/01.jpg', '/demo-products/womens-dress/05.jpg')
);
INSERT INTO public.product_size_stock(product_id, size, stock)
SELECT p.id, s.size, CASE
  WHEN s.size = 'S' OR p.image_url LIKE '%/05.jpg' THEN 0
  WHEN p.image_url = '/kadin-bluz-1.jpg' THEN CASE WHEN s.size = 'M' THEN 4 ELSE 5 END
  ELSE CASE WHEN s.size = 'M' THEN 2 ELSE 4 END END
FROM public.products p CROSS JOIN (VALUES ('S'),('M'),('L')) s(size)
WHERE p.image_url IN ('/kadin-bluz-1.jpg', '/demo-products/womens-dress/01.jpg', '/demo-products/womens-dress/05.jpg');
COMMIT;
-- Inspect actual records: a successful script with missing products is not fixture evidence.
SELECT p.id, p.name, p.sizes, p.stock, s.size, s.stock AS size_stock
FROM public.products p JOIN public.product_size_stock s ON s.product_id = p.id
WHERE p.image_url IN ('/kadin-bluz-1.jpg', '/demo-products/womens-dress/01.jpg', '/demo-products/womens-dress/05.jpg')
ORDER BY p.id, s.size;
