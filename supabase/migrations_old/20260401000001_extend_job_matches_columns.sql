-- Extend job_matches with columns the client already reads.
-- Also adds matched_at staleness tracking so the cached-job-engine freshness
-- gate can skip rows older than 12 hours without touching the live job_listings table.

-- Extra scoring columns (the UI reads these but the table never had them)
ALTER TABLE public.job_matches
  ADD COLUMN IF NOT EXISTS skill_match     NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS culture_fit     NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS location_match  NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reasoning       TEXT[] DEFAULT '{}';

-- matched_at is already in the table; add an index so the freshness filter is fast
CREATE INDEX IF NOT EXISTS idx_job_matches_matched_at
  ON public.job_matches (user_id, matched_at DESC);

-- Allow service-role upserts from the daily orchestrator (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'job_matches'
      AND policyname = 'Service role can manage job matches'
  ) THEN
    EXECUTE '
      CREATE POLICY "Service role can manage job matches"
        ON public.job_matches FOR ALL
        USING (true)
        WITH CHECK (true)
    ';
  END IF;
END $$;

