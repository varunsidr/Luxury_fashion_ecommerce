-- Run once in the Supabase SQL Editor after deploying the server-side checkout route.
-- Customers can still read their own orders, but can no longer choose order totals,
-- payment status, or line item prices through direct browser writes.
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert order items for own orders" ON public.order_items;
