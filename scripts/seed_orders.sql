-- Sample orders seed for Supabase/Postgres
-- Run in Supabase SQL editor or via psql against your database

-- Insert two sample orders and items
INSERT INTO orders (id, user_id, total, status, shipping_address, payment_method, placed_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 129900.00, 'pending', '{"line1":"Test Street 1","city":"Istanbul"}', 'card', NOW()),
  ('00000000-0000-0000-0000-000000000002', NULL, 42000.00, 'shipped', '{"line1":"Sample Ave 5","city":"Ankara"}', 'card', NOW() - INTERVAL '1 day');

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', (SELECT id FROM products LIMIT 1), 1, 129900.00),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', (SELECT id FROM products LIMIT 1 OFFSET 1), 2, 21000.00);

-- Adjust the SELECT product ids above if your products table has different UUIDs or run after seeding products.
