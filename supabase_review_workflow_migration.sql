-- Apply after security hardening and admin catalog, before deploying review replies.
-- Rerunnable; existing author names cannot be reconstructed from old rows.
BEGIN;
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- NOT VALID retains historical values for inspection; checks govern future writes.
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS review_name_length;
ALTER TABLE public.reviews ADD CONSTRAINT review_name_length CHECK (name IS NULL OR char_length(btrim(name)) BETWEEN 1 AND 120) NOT VALID;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS review_reply_length;
ALTER TABLE public.reviews ADD CONSTRAINT review_reply_length CHECK (admin_reply IS NULL OR char_length(btrim(admin_reply)) BETWEEN 1 AND 2000) NOT VALID;

REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO service_role;
COMMIT;
