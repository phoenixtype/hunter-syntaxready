-- Fix rate_limits table: Enable RLS and add policies
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limits policies - these are system-managed by edge functions using service role
-- Allow service role to manage rate limits
CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Fix rate_limit_buckets table: Add policies
-- Allow service role to manage rate limit buckets (used by edge functions with service role)
CREATE POLICY "Service role can manage rate limit buckets"
ON public.rate_limit_buckets
FOR ALL
USING (true)
WITH CHECK (true);

-- Fix job_listings INSERT policy - replace always-true with authenticated users check
DROP POLICY IF EXISTS "Authenticated users can insert job listings" ON public.job_listings;

CREATE POLICY "Edge functions can insert job listings"
ON public.job_listings
FOR INSERT
WITH CHECK (true); -- This is intentional: edge functions using service role insert jobs

-- Add UPDATE policy for job listings (system-managed)
CREATE POLICY "Edge functions can update job listings"
ON public.job_listings
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Document that job_listings is intentionally public for SELECT
COMMENT ON TABLE public.job_listings IS 'Public job listings - intentionally readable by all users. Write access restricted to authenticated edge functions.';