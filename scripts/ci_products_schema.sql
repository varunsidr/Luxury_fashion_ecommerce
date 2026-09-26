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
  tag TEXT
);
