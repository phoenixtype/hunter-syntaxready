-- Add last_verified_at to job_listings
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_job_listings_last_verified_at ON public.job_listings(last_verified_at ASC);
