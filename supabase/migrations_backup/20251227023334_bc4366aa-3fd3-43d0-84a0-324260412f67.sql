-- ============================================
-- HUNTER AI - MEMORY ENGINE DATABASE SCHEMA
-- ============================================

-- 1. USER PREFERENCES TABLE
-- Stores user job search preferences from onboarding
CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_roles TEXT[] DEFAULT '{}',
  min_salary_usd INTEGER DEFAULT 100000,
  locations TEXT[] DEFAULT '{}',
  remote_policy TEXT DEFAULT 'any' CHECK (remote_policy IN ('remote', 'hybrid', 'onsite', 'any')),
  aggressiveness INTEGER DEFAULT 5 CHECK (aggressiveness >= 1 AND aggressiveness <= 10),
  safe_mode BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
ON public.user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
ON public.user_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. CANDIDATE PROFILES TABLE
-- Stores parsed resume data
CREATE TABLE public.candidate_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identity JSONB NOT NULL DEFAULT '{"name": "", "email": "", "links": []}',
  skills JSONB NOT NULL DEFAULT '[]',
  experience_atoms JSONB NOT NULL DEFAULT '[]',
  education JSONB NOT NULL DEFAULT '[]',
  raw_resume_text TEXT,
  resume_file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON public.candidate_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.candidate_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.candidate_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_candidate_profiles_updated_at
BEFORE UPDATE ON public.candidate_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. AGENT ACTIVITY LOGS TABLE
-- Stores all agent activity for the activity feed
CREATE TABLE public.agent_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  log_type TEXT DEFAULT 'info' CHECK (log_type IN ('info', 'success', 'warning', 'error', 'action')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs"
ON public.agent_activity_logs FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own logs"
ON public.agent_activity_logs FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX idx_activity_logs_user ON public.agent_activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON public.agent_activity_logs(created_at DESC);

-- 4. LEARNING WEIGHTS TABLE
-- Stores user feedback and learned preferences
CREATE TABLE public.learning_weights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_weight NUMERIC(3,2) DEFAULT 0.6,
  culture_weight NUMERIC(3,2) DEFAULT 0.2,
  freshness_weight NUMERIC(3,2) DEFAULT 0.2,
  banned_companies TEXT[] DEFAULT '{}',
  preferred_skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.learning_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weights"
ON public.learning_weights FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weights"
ON public.learning_weights FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weights"
ON public.learning_weights FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_learning_weights_updated_at
BEFORE UPDATE ON public.learning_weights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. FEEDBACK ACTIONS TABLE
-- Stores individual feedback events for learning
CREATE TABLE public.feedback_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('DISMISS', 'APPLY', 'VIEW', 'SAVE')),
  job_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
ON public.feedback_actions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
ON public.feedback_actions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_feedback_user ON public.feedback_actions(user_id);
CREATE INDEX idx_feedback_created ON public.feedback_actions(created_at DESC);

-- 6. COMPLIANCE METRICS TABLE
-- Stores rate limiting and compliance data
CREATE TABLE public.compliance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('APPLY', 'SCRAPE')),
  hour_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
  action_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, action_type, hour_bucket)
);

ALTER TABLE public.compliance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
ON public.compliance_metrics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics"
ON public.compliance_metrics FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics"
ON public.compliance_metrics FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_compliance_user_hour ON public.compliance_metrics(user_id, hour_bucket DESC);

-- 7. APPLICATION HISTORY TABLE
-- Tracks all job applications
CREATE TABLE public.application_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.job_listings(id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_url TEXT,
  status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'pending', 'failed', 'interview', 'rejected', 'offer')),
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications"
ON public.application_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
ON public.application_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
ON public.application_history FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_applications_user ON public.application_history(user_id);
CREATE INDEX idx_applications_date ON public.application_history(applied_at DESC);