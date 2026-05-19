-- ─────────────────────────────────────────────────────────────────────────────
-- Admin system + Recruiter application approval flow
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Platform admins table
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'admin' CHECK (role IN ('root', 'admin')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id),
  UNIQUE (user_id)
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read this table
CREATE POLICY "platform_admins_select" ON public.platform_admins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );

-- Only root admins can insert/update/delete
CREATE POLICY "platform_admins_insert" ON public.platform_admins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.role = 'root'
    )
  );

CREATE POLICY "platform_admins_delete" ON public.platform_admins
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins pa
      WHERE pa.user_id = auth.uid() AND pa.role = 'root'
    )
  );

-- Helper function
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_root_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND role = 'root'
  );
$$;

-- 2. Recruiter applications (separate from recruiter_profiles — this is the pre-approval stage)
CREATE TABLE IF NOT EXISTS public.recruiter_applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Applicant info (collected before they have an account)
  full_name       text NOT NULL,
  email           text NOT NULL,
  company_name    text NOT NULL,
  company_website text,
  job_title       text NOT NULL,
  company_size    text CHECK (company_size IN ('1-10','11-50','51-200','201-500','501-1000','1000+')),
  use_case        text,            -- "How will you use Hunter?"
  -- Status flow
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     uuid REFERENCES auth.users(id),
  reviewed_at     timestamptz,
  rejection_reason text,
  -- If they already have a Hunter account, link it
  user_id         uuid REFERENCES auth.users(id),
  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recruiter_applications ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (anyone can apply)
CREATE POLICY "recruiter_applications_insert" ON public.recruiter_applications
  FOR INSERT WITH CHECK (true);

-- Applicant can view their own application (by email match after login)
CREATE POLICY "recruiter_applications_select_own" ON public.recruiter_applications
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_platform_admin()
  );

-- Only admins can update (approve/reject)
CREATE POLICY "recruiter_applications_update" ON public.recruiter_applications
  FOR UPDATE USING (public.is_platform_admin());

-- 3. Platform audit log
CREATE TABLE IF NOT EXISTS public.platform_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES auth.users(id),
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_logs_select" ON public.platform_logs
  FOR SELECT USING (public.is_platform_admin());

CREATE POLICY "platform_logs_insert" ON public.platform_logs
  FOR INSERT WITH CHECK (public.is_platform_admin() OR true); -- edge functions write too

-- 4. Allow platform admins to read all relevant tables
CREATE POLICY "platform_admins_view_all_profiles" ON public.profiles
  FOR SELECT USING (public.is_platform_admin() OR id = auth.uid());

CREATE POLICY "platform_admins_view_all_subscriptions" ON public.subscriptions
  FOR SELECT USING (public.is_platform_admin() OR user_id = auth.uid());

CREATE POLICY "platform_admins_view_recruiter_applications" ON public.recruiter_applications
  FOR SELECT USING (public.is_platform_admin() OR user_id = auth.uid());

-- 5. updated_at trigger for recruiter_applications
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER recruiter_applications_updated_at
  BEFORE UPDATE ON public.recruiter_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Seed root admin — samuelakuma130@gmail.com
-- Inserts after user exists; safe to run multiple times
INSERT INTO public.platform_admins (user_id, role, notes)
SELECT id, 'root', 'Primary owner — seeded from migration'
FROM auth.users
WHERE email = 'samuelakuma130@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'root';
