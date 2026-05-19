-- Create job_matches table
-- Referenced throughout the codebase as a feature type but was never persisted.
-- Stores AI-matched job listings per user so matches can be cached and paginated.

CREATE TABLE IF NOT EXISTS public.job_matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
  match_score NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'viewed', 'applied', 'dismissed')),
  matched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_matches_user_id      ON public.job_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_match_score  ON public.job_matches(user_id, match_score DESC);

ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own job matches"
  ON public.job_matches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own job matches"
  ON public.job_matches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job matches"
  ON public.job_matches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job matches"
  ON public.job_matches FOR DELETE
  USING (auth.uid() = user_id);
