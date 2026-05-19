
-- Fix all RESTRICTIVE RLS policies by dropping and recreating as PERMISSIVE
-- This is critical: RESTRICTIVE policies with no PERMISSIVE policies = no access

-- ============ agent_activity_logs ============
DROP POLICY IF EXISTS "Users can delete their own logs" ON public.agent_activity_logs;
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.agent_activity_logs;
DROP POLICY IF EXISTS "Users can update their own logs" ON public.agent_activity_logs;
DROP POLICY IF EXISTS "Users can view only their own logs" ON public.agent_activity_logs;
DROP POLICY IF EXISTS "Users can view their own logs" ON public.agent_activity_logs;

CREATE POLICY "Users can manage own logs" ON public.agent_activity_logs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ application_history ============
DROP POLICY IF EXISTS "Users can delete their own applications" ON public.application_history;
DROP POLICY IF EXISTS "Users can insert own applications" ON public.application_history;
DROP POLICY IF EXISTS "Users can update own applications" ON public.application_history;
DROP POLICY IF EXISTS "Users can view own applications" ON public.application_history;
DROP POLICY IF EXISTS "Users can view their application history" ON public.application_history;

CREATE POLICY "Users can manage own applications" ON public.application_history
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ candidate_profiles ============
DROP POLICY IF EXISTS "Users can delete their own candidate profile" ON public.candidate_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.candidate_profiles;
DROP POLICY IF EXISTS "Users can manage their candidate profile" ON public.candidate_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.candidate_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.candidate_profiles;

CREATE POLICY "Users can manage own profile" ON public.candidate_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ compliance_metrics ============
DROP POLICY IF EXISTS "Users can delete their own metrics" ON public.compliance_metrics;
DROP POLICY IF EXISTS "Users can insert own metrics" ON public.compliance_metrics;
DROP POLICY IF EXISTS "Users can update own metrics" ON public.compliance_metrics;
DROP POLICY IF EXISTS "Users can view own metrics" ON public.compliance_metrics;

CREATE POLICY "Users can manage own metrics" ON public.compliance_metrics
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ feedback_actions ============
DROP POLICY IF EXISTS "Users can delete their own feedback" ON public.feedback_actions;
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback_actions;
DROP POLICY IF EXISTS "Users can manage their feedback" ON public.feedback_actions;
DROP POLICY IF EXISTS "Users can update their own feedback" ON public.feedback_actions;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback_actions;

CREATE POLICY "Users can manage own feedback" ON public.feedback_actions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ job_listings ============
DROP POLICY IF EXISTS "Authenticated users can view job_listings" ON public.job_listings;
DROP POLICY IF EXISTS "Service role full access job_listings" ON public.job_listings;

CREATE POLICY "Authenticated users can view jobs" ON public.job_listings
  FOR SELECT TO authenticated USING (true);

-- ============ learning_weights ============
DROP POLICY IF EXISTS "Users can delete their own weights" ON public.learning_weights;
DROP POLICY IF EXISTS "Users can insert own weights" ON public.learning_weights;
DROP POLICY IF EXISTS "Users can manage their weights" ON public.learning_weights;
DROP POLICY IF EXISTS "Users can update own weights" ON public.learning_weights;
DROP POLICY IF EXISTS "Users can view own weights" ON public.learning_weights;

CREATE POLICY "Users can manage own weights" ON public.learning_weights
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ notification_preferences ============
DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;

CREATE POLICY "Users can manage own notification prefs" ON public.notification_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ profiles ============
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ rate_limit_buckets ============
DROP POLICY IF EXISTS "Service role full access rate_limit_buckets" ON public.rate_limit_buckets;
-- rate_limit_buckets should only be accessed by service_role (which bypasses RLS), no user policies needed

-- ============ rate_limits ============
DROP POLICY IF EXISTS "Users can view their own rate limits" ON public.rate_limits;

CREATE POLICY "Users can view own rate limits" ON public.rate_limits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ subscriptions ============
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;

CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ tailored_resumes ============
DROP POLICY IF EXISTS "Users can delete their own tailored resumes" ON public.tailored_resumes;
DROP POLICY IF EXISTS "Users can insert their own tailored resumes" ON public.tailored_resumes;
DROP POLICY IF EXISTS "Users can view their own tailored resumes" ON public.tailored_resumes;

CREATE POLICY "Users can manage own tailored resumes" ON public.tailored_resumes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ user_preferences ============
DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can manage their preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;

CREATE POLICY "Users can manage own preferences" ON public.user_preferences
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ users ============
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;

CREATE POLICY "Users can manage own user record" ON public.users
  FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
