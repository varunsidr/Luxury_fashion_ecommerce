# EL'S — Architecture Overview

This document gives a concise, developer-focused overview of the app architecture, integration points, and recommended extension points (reviews, admin moderation, storage).

## Components

- Next.js (App Router)
  - Server-side routes: `src/app/api/*` providing server APIs, test helpers, and dev-only endpoints.
  - Pages and layouts in `src/app` and components in `src/components`.
- Supabase
  - Auth: `auth.users` manages customer accounts.
  - Database: Postgres for `products`, `profiles`, `cart_items`, `favorites`, `reviews`, `orders`, and `order_items`.
  - Storage: object storage for product images and user-uploaded review images.
- Client
  - React + Tailwind UI components and Context providers (`CartContext`, `FavoritesContext`).
- Admin
  - Simple password-protected admin UI at `/admin`; server-only admin actions available via protected API routes.

## Data flow (high level)

- Customer browse → product data fetched from Supabase (public read) → images served from Storage CDN.
- Signup/login → Supabase Auth (client-side anon key) → `profiles` row created by auth trigger.
- Checkout → authenticated session → profile upsert for legacy users → `orders` insert → `order_items` insert → confirmation.
- Review submission → authenticated POST to `/api/reviews` (server route) → server validates, stores images in Storage, writes `reviews` row (default `approved=false`).
- Admin moderation → admin UI calls `/api/admin/reviews/*` to approve or delete reviews; approved reviews are visible in storefront.

## Checkout and profile integrity

Orders reference `profiles.id`, not `auth.users.id` directly. New accounts receive a profile through `on_auth_user_created`. Checkout also performs an idempotent profile upsert before creating an order so accounts created before the trigger was installed can still place orders. Existing databases should run [supabase_checkout_profile_fix.sql](supabase_checkout_profile_fix.sql) once to backfill those profiles and add the matching RLS insert policy.

The client currently supports authenticated checkout only. Demo card payments are simulated in the browser and never charge or store real card details; cash on delivery is also available.

## Admin authentication

The `/admin` page submits the password to `/api/admin/login`. The route compares it with the server-only `DEV_CREATE_USER_KEY`, signs a short-lived token, and returns it in an HttpOnly `admin_token` cookie. `DEV_ADMIN_USERNAME` is optional and applies to custom API clients that send a username. No admin password is stored in source control.

## Security and best practices

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. Use server-only routes for operations that require elevated privileges (uploads that need signed URLs, test endpoints, dev auto-create users).
- Row-Level Security (RLS): keep strict RLS for `profiles`, `cart_items`, `favorites`, and `reviews` to ensure users only access their own data.
- Environment files: commit example env files (e.g. `.env.example`) but **never** commit `.env.local` or files containing real service role keys.

## Reviews & Admin (extension plan)

- Reviews table: `id, product_id, user_id, rating (1-5), title, body, images text[], approved boolean, created_at`.
- Image handling: accept up to 3 images per review, 2 MB per image, generate thumbnails, store both original and thumb.
- API endpoints:
  - `POST /api/reviews` (auth required)
  - `GET /api/products/:id/reviews` (public)
  - `GET /api/admin/reviews?status=pending` (admin only)
  - `PUT /api/admin/reviews/:id/approve` (admin only)

## Operational notes

- Local dev convenience: `/api/dev/create-user` aids testing by creating confirmed users (guarded by `DEV_CREATE_USER_KEY`). Limit to small number of dev accounts.
- Environment changes require a full Next.js dev-server restart because server routes read `.env.local` at process startup.
- CI / deployments: set environment variables in the hosting platform (Vercel, Netlify) rather than committing them.

## Useful files

- `supabase_schema.sql` — canonical DB schema and policies
- `supabase_checkout_profile_fix.sql` — idempotent repair for existing Supabase projects
- `src/lib/supabase.ts` — Supabase client initialization and fallbacks
- `src/app/api` — server API routes (test helpers, dev helpers, production APIs)

---

If you want, I can extend this file with an ER diagram or a Mermaid sequence diagram for the review upload flow next.