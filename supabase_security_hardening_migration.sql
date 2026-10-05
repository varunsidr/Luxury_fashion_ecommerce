-- Apply after the review and checkout migrations, before deploying the hardened app.
-- This file is safe to re-run. Verify the result with npm run security:check-db.

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
UPDATE public.reviews SET approved = FALSE WHERE approved IS NULL;
ALTER TABLE public.reviews ALTER COLUMN approved SET DEFAULT FALSE;
ALTER TABLE public.reviews ALTER COLUMN approved SET NOT NULL;

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Approved reviews are public or authors can view own" ON public.reviews;

-- Authors may read their pending submissions. Visitors see approved reviews only.
CREATE POLICY "Approved reviews are public or authors can view own"
  ON public.reviews FOR SELECT
  USING (approved IS TRUE OR auth.uid() = user_id);
-- All writes, including review creation, pass through checked server routes.
REVOKE ALL ON public.reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;

-- New review images are private until a moderator requests a short-lived URL.
-- Existing objects in the old public bucket must be reviewed separately.
INSERT INTO storage.buckets (id, name, "public")
VALUES ('review-images', 'review-images', FALSE)
ON CONFLICT (id) DO UPDATE SET "public" = FALSE;

-- One atomic counter is shared by every app instance. No public Data API access.
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0)
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_key_hash TEXT, p_limit INTEGER, p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_attempts INTEGER;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_key_hash !~ '^[0-9a-f]{64}$' OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'Invalid rate limit request';
  END IF;
  INSERT INTO public.api_rate_limits AS limits (key_hash, window_started_at, attempts)
  VALUES (p_key_hash, v_now, 1)
  ON CONFLICT (key_hash) DO UPDATE SET
    window_started_at = CASE
      WHEN limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      THEN v_now ELSE limits.window_started_at END,
    attempts = CASE
      WHEN limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      THEN 1 ELSE limits.attempts + 1 END
  RETURNING attempts INTO v_attempts;
  RETURN v_attempts > p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER)
  TO service_role;

NOTIFY pgrst, 'reload schema';
