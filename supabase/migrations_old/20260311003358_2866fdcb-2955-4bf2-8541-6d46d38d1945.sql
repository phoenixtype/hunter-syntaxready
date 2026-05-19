
-- Fix all RLS policies from RESTRICTIVE to PERMISSIVE

-- profiles
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- users
DROP POLICY IF EXISTS "Users can manage own user record" ON public.users;
CREATE POLICY "Users can manage own user record" ON public.users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_preferences
DROP POLICY IF EXISTS "Users can manage own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- candidate_profiles
DROP POLICY IF EXISTS "Users can manage own profile" ON public.candidate_profiles;
CREATE POLICY "Users can manage own candidate profile" ON public.candidate_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- application_history
DROP POLICY IF EXISTS "Users can manage own applications" ON public.application_history;
CREATE POLICY "Users can manage own applications" ON public.application_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- agent_activity_logs
DROP POLICY IF EXISTS "Users can manage own logs" ON public.agent_activity_logs;
CREATE POLICY "Users can manage own logs" ON public.agent_activity_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- learning_weights
DROP POLICY IF EXISTS "Users can manage own weights" ON public.learning_weights;
CREATE POLICY "Users can manage own weights" ON public.learning_weights
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- feedback_actions
DROP POLICY IF EXISTS "Users can manage own feedback" ON public.feedback_actions;
CREATE POLICY "Users can manage own feedback" ON public.feedback_actions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- compliance_metrics
DROP POLICY IF EXISTS "Users can manage own metrics" ON public.compliance_metrics;
CREATE POLICY "Users can manage own metrics" ON public.compliance_metrics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notification_preferences
DROP POLICY IF EXISTS "Users can manage own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users can manage own notification prefs" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tailored_resumes
DROP POLICY IF EXISTS "Users can manage own tailored resumes" ON public.tailored_resumes;
CREATE POLICY "Users can manage own tailored resumes" ON public.tailored_resumes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- job_listings (read-only for authenticated)
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON public.job_listings;
CREATE POLICY "Authenticated users can view jobs" ON public.job_listings
  FOR SELECT TO authenticated USING (true);

-- subscriptions
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- rate_limits
DROP POLICY IF EXISTS "Users can view own rate limits" ON public.rate_limits;
CREATE POLICY "Users can view own rate limits" ON public.rate_limits
  FOR SELECT USING (auth.uid() = user_id);

-- rate_limit_buckets
DROP POLICY IF EXISTS "Users can view own rate limit buckets" ON public.rate_limit_buckets;
CREATE POLICY "Users can view own rate limit buckets" ON public.rate_limit_buckets
  FOR SELECT USING (auth.uid() = user_id);
