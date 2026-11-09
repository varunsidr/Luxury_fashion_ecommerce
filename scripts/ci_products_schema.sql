-- Minimal isolated schema for the CI seed script.
-- The production Supabase schema depends on Supabase-managed auth roles and functions,
-- which are not available in the plain Postgres container used by this workflow.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  price NUMERIC(12, 2),
  image_url TEXT,
  tag TEXT,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  color_options JSONB DEFAULT '[]',
  sizes TEXT[] DEFAULT '{}',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE TABLE product_size_stock (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  PRIMARY KEY(product_id,size)
);
