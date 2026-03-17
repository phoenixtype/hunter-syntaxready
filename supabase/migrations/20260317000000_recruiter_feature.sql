-- ============================================================
-- Recruiter Feature: Job Posting, Pipeline & Auto-Match
-- ============================================================

-- 1. Add role column to profiles (candidate | recruiter | admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'candidate'
  CHECK (role IN ('candidate', 'recruiter', 'admin'));

-- 2. Add auto-apply fields to user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS auto_apply_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_apply_min_match_score INTEGER NOT NULL DEFAULT 80;

-- ============================================================
-- 3. recruiter_profiles — company info for hiring managers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recruiter_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name      TEXT NOT NULL,
  company_website   TEXT,
  company_logo_url  TEXT,
  company_size      TEXT CHECK (company_size IN ('1-10','11-50','51-200','201-500','501-1000','1001-5000','5000+')),
  industry          TEXT,
  headquarters      TEXT,
  about             TEXT,
  linkedin_url      TEXT,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters manage own company profile"
  ON public.recruiter_profiles FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view recruiter profiles"
  ON public.recruiter_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE OR REPLACE TRIGGER update_recruiter_profiles_updated_at
  BEFORE UPDATE ON public.recruiter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. recruiter_jobs — jobs posted by recruiters/hiring managers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recruiter_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- mirrored into job_listings when published
  job_listing_id      UUID REFERENCES public.job_listings(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  company             TEXT NOT NULL,
  location            TEXT,
  location_type       TEXT NOT NULL DEFAULT 'hybrid'
    CHECK (location_type IN ('remote','hybrid','onsite')),
  employment_type     TEXT NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('full_time','part_time','contract','internship','freelance')),
  salary_min          INTEGER CHECK (salary_min >= 0),
  salary_max          INTEGER CHECK (salary_max >= 0),
  salary_currency     TEXT NOT NULL DEFAULT 'USD',
  description         TEXT NOT NULL,
  requirements        TEXT,
  responsibilities    TEXT,
  benefits            TEXT,
  tech_stack          TEXT[],
  experience_level    TEXT CHECK (experience_level IN ('entry','junior','mid','senior','lead','principal','executive')),
  visa_sponsorship    BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','closed','filled')),
  application_deadline TIMESTAMPTZ,
  application_count   INTEGER NOT NULL DEFAULT 0,
  view_count          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recruiter_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recruiters manage own jobs"
  ON public.recruiter_jobs FOR ALL
  USING (auth.uid() = recruiter_id);

-- Candidates see active jobs only
CREATE POLICY "Candidates view active recruiter jobs"
  ON public.recruiter_jobs FOR SELECT
  USING (auth.role() = 'authenticated' AND status = 'active');

CREATE INDEX IF NOT EXISTS idx_recruiter_jobs_recruiter_id ON public.recruiter_jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_jobs_status ON public.recruiter_jobs(status);
CREATE INDEX IF NOT EXISTS idx_recruiter_jobs_created_at ON public.recruiter_jobs(created_at DESC);

CREATE OR REPLACE TRIGGER update_recruiter_jobs_updated_at
  BEFORE UPDATE ON public.recruiter_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. recruiter_job_applications — applications received per job
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recruiter_job_applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_job_id      UUID NOT NULL REFERENCES public.recruiter_jobs(id) ON DELETE CASCADE,
  candidate_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- link to candidate's own tracker
  application_history_id UUID REFERENCES public.application_history(id) ON DELETE SET NULL,
  match_score           NUMERIC(5,2) CHECK (match_score >= 0 AND match_score <= 100),
  cover_letter          TEXT,
  -- snapshot of candidate_profiles at time of application
  resume_snapshot       JSONB,
  status                TEXT NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied','screening','interview','offer','accepted','rejected','withdrawn')),
  recruiter_notes       TEXT,
  is_auto_applied       BOOLEAN NOT NULL DEFAULT false,
  applied_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recruiter_job_id, candidate_id)
);

ALTER TABLE public.recruiter_job_applications ENABLE ROW LEVEL SECURITY;

-- Candidates manage their own applications
CREATE POLICY "Candidates manage own recruiter applications"
  ON public.recruiter_job_applications FOR ALL
  USING (auth.uid() = candidate_id);

-- Recruiters can view/update applications on their jobs
CREATE POLICY "Recruiters view applications on their jobs"
  ON public.recruiter_job_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recruiter_jobs rj
      WHERE rj.id = recruiter_job_id AND rj.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "Recruiters update application status on their jobs"
  ON public.recruiter_job_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.recruiter_jobs rj
      WHERE rj.id = recruiter_job_id AND rj.recruiter_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_rja_recruiter_job_id ON public.recruiter_job_applications(recruiter_job_id);
CREATE INDEX IF NOT EXISTS idx_rja_candidate_id ON public.recruiter_job_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rja_status ON public.recruiter_job_applications(status);

CREATE OR REPLACE TRIGGER update_rja_updated_at
  BEFORE UPDATE ON public.recruiter_job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. Helper: increment application_count on recruiter_jobs
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_recruiter_job_application_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.recruiter_jobs
  SET application_count = application_count + 1
  WHERE id = NEW.recruiter_job_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_recruiter_application
  AFTER INSERT ON public.recruiter_job_applications
  FOR EACH ROW EXECUTE FUNCTION public.increment_recruiter_job_application_count();

-- ============================================================
-- 7. Handle new recruiter → auto-create recruiter_profile stub
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_recruiter_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- When a user's role is set to 'recruiter', create a stub recruiter_profile
  IF NEW.role = 'recruiter' AND (OLD.role IS NULL OR OLD.role <> 'recruiter') THEN
    INSERT INTO public.recruiter_profiles (user_id, company_name)
    VALUES (NEW.id, COALESCE(NEW.full_name, 'My Company'))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_recruiter_profile();
