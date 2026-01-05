-- ==========================================
-- HUNTER PLATFORM: COMPLETE INFRASTRUCTURE
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. RATE LIMITING SYSTEM
-- This table tracks request counts for Edge Functions
CREATE TABLE IF NOT EXISTS public.rate_limits (
    user_id UUID NOT NULL,
    function_name TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, function_name)
);

-- RPC for server-side rate limiting
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_function_name TEXT,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_count INTEGER;
BEGIN
    -- Cleanup old entries
    DELETE FROM public.rate_limits 
    WHERE window_start < (NOW() - (p_window_seconds || ' seconds')::INTERVAL);

    INSERT INTO public.rate_limits (user_id, function_name, request_count, window_start)
    VALUES (p_user_id, p_function_name, 1, NOW())
    ON CONFLICT (user_id, function_name) 
    DO UPDATE SET
        request_count = CASE 
            WHEN rate_limits.window_start < (NOW() - (p_window_seconds || ' seconds')::INTERVAL) THEN 1
            ELSE rate_limits.request_count + 1
        END,
        window_start = CASE
            WHEN rate_limits.window_start < (NOW() - (p_window_seconds || ' seconds')::INTERVAL) THEN NOW()
            ELSE rate_limits.window_start
        END
    RETURNING request_count INTO v_count;

    RETURN v_count <= p_max_requests;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CORE TABLES

-- Profiles (Mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    target_roles TEXT[] DEFAULT '{}',
    min_salary_usd INTEGER DEFAULT 100000,
    locations TEXT[] DEFAULT '{}',
    remote_policy TEXT DEFAULT 'any',
    aggressiveness INTEGER DEFAULT 5,
    safe_mode BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job Listings
CREATE TABLE IF NOT EXISTS public.job_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    salary_range TEXT,
    description TEXT,
    source TEXT,
    freshness_score FLOAT DEFAULT 0.5,
    credibility_score FLOAT DEFAULT 1.0,
    url TEXT UNIQUE,
    posted_at TEXT,
    tech_stack TEXT[] DEFAULT '{}',
    job_hash TEXT UNIQUE NOT NULL,
    raw_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidate Profiles (Parsed Resume Data)
CREATE TABLE IF NOT EXISTS public.candidate_profiles (
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    identity JSONB DEFAULT '{}',
    skills JSONB DEFAULT '[]',
    experience_atoms JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    raw_resume_text TEXT,
    resume_file_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application History
CREATE TABLE IF NOT EXISTS public.application_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES public.job_listings(id) ON DELETE SET NULL,
    job_title TEXT,
    company TEXT,
    job_url TEXT,
    status TEXT DEFAULT 'applied',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent Activity Logs
CREATE TABLE IF NOT EXISTS public.agent_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    agent TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    log_type TEXT DEFAULT 'info',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning Weights
CREATE TABLE IF NOT EXISTS public.learning_weights (
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    skill_weight FLOAT DEFAULT 0.6,
    culture_weight FLOAT DEFAULT 0.2,
    freshness_weight FLOAT DEFAULT 0.2,
    banned_companies TEXT[] DEFAULT '{}',
    preferred_skills TEXT[] DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feedback Actions
CREATE TABLE IF NOT EXISTS public.feedback_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    job_id TEXT,
    action TEXT NOT NULL,
    job_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.learning_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_logs ENABLE ROW LEVEL SECURITY;

-- Learning & Feedback Policies
DROP POLICY IF EXISTS "Users can manage their weights" ON public.learning_weights;
CREATE POLICY "Users can manage their weights" ON public.learning_weights FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their feedback" ON public.feedback_actions;
CREATE POLICY "Users can manage their feedback" ON public.feedback_actions FOR ALL USING (auth.uid() = user_id);

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Preferences Policies
DROP POLICY IF EXISTS "Users can manage their preferences" ON public.user_preferences;
CREATE POLICY "Users can manage their preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- Job Listings Policies (Public read for authenticated)
DROP POLICY IF EXISTS "Authenticated users can view jobs" ON public.job_listings;
CREATE POLICY "Authenticated users can view jobs" ON public.job_listings FOR SELECT TO authenticated USING (true);

-- Candidate Profiles Policies
DROP POLICY IF EXISTS "Users can manage their candidate profile" ON public.candidate_profiles;
CREATE POLICY "Users can manage their candidate profile" ON public.candidate_profiles FOR ALL USING (auth.uid() = user_id);

-- Application History Policies
DROP POLICY IF EXISTS "Users can view their application history" ON public.application_history;
CREATE POLICY "Users can view their application history" ON public.application_history FOR ALL USING (auth.uid() = user_id);

-- Activity Logs Policies
DROP POLICY IF EXISTS "Users can view their own logs" ON public.agent_activity_logs;
CREATE POLICY "Users can view their own logs" ON public.agent_activity_logs FOR SELECT USING (auth.uid() = user_id);

-- 5. AUTH TRIGGERS
-- Auto-sync auth.users to public.profiles and public.user_preferences
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  INSERT INTO public.user_preferences (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Authenticated users can upload resumes" ON storage.objects;
CREATE POLICY "Authenticated users can upload resumes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Authenticated users can view their own resumes" ON storage.objects;
CREATE POLICY "Authenticated users can view their own resumes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes' AND auth.uid() = owner);

-- 7. BACKFILL EXISTING USERS
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 8. AUTO-HUNT SCHEDULING (CRON)
-- IMPORTANT: Replace [PROJECT_REF] and [SERVICE_ROLE_KEY] with your actual values
-- This schedules the job to run every 6 hours
SELECT cron.schedule(
  'auto-hunt-crawl',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://[PROJECT_REF].supabase.co/functions/v1/crawl-jobs',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
      body:='{"sources": ["LinkedIn jobs", "Indeed jobs"], "keywords": ["remote", "hiring now"]}'::jsonb
    ) as request_id;
  $$
);

-- 9. PERFORMANCE INDEXES
-- Add indexes for frequently queried columns to improve performance

-- Index for job listings search
CREATE INDEX IF NOT EXISTS idx_job_listings_company ON public.job_listings(company);
CREATE INDEX IF NOT EXISTS idx_job_listings_created_at ON public.job_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_listings_tech_stack ON public.job_listings USING GIN(tech_stack);

-- Index for application history queries
CREATE INDEX IF NOT EXISTS idx_application_history_user_id ON public.application_history(user_id);
CREATE INDEX IF NOT EXISTS idx_application_history_status ON public.application_history(status);
CREATE INDEX IF NOT EXISTS idx_application_history_applied_at ON public.application_history(applied_at DESC);

-- Index for activity logs
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_user_id ON public.agent_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_logs_created_at ON public.agent_activity_logs(created_at DESC);

-- Index for feedback actions
CREATE INDEX IF NOT EXISTS idx_feedback_actions_user_id ON public.feedback_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_actions_created_at ON public.feedback_actions(created_at DESC);
