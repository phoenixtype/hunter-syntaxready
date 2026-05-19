-- Security Hardening: Remove insecure RLS policies left over from development

-- 1. job_listings: Remove any legacy write access
DROP POLICY IF EXISTS "Edge functions can insert job listings" ON public.job_listings;
DROP POLICY IF EXISTS "Edge functions can update job listings" ON public.job_listings;
DROP POLICY IF EXISTS "Job listings are publicly readable" ON public.job_listings;

-- Ensure read access is only for authenticated users (as per the latest intent)
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON public.job_listings;
CREATE POLICY "Authenticated users can view jobs" ON public.job_listings
  FOR SELECT TO authenticated USING (true);

-- 2. rate_limit_buckets: Remove legacy management policies
DROP POLICY IF EXISTS "Service role can manage rate limit buckets" ON public.rate_limit_buckets;
DROP POLICY IF EXISTS "Users can view own rate limit buckets" ON public.rate_limit_buckets;
CREATE POLICY "Users can view own rate limit buckets" ON public.rate_limit_buckets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Ensure service_role can still manage everything (bypasses RLS)
-- No explicit action needed as service_role bypasses RLS in Supabase by default.

-- 4. Audit subscription visibility
-- Ensure users can't see other users' subscriptions even if they guess IDs
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
