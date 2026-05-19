-- ─────────────────────────────────────────────────────────────────────────────
-- Recruiter outreach tracking
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recruiter_outreach (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id    uuid NOT NULL REFERENCES auth.users(id),
  recruiter_job_id uuid REFERENCES public.recruiter_jobs(id) ON DELETE SET NULL,
  outreach_type   text NOT NULL DEFAULT 'email' CHECK (outreach_type IN ('email', 'invite')),
  subject         text,
  message         text,
  status          text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'opened', 'replied')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recruiter_outreach ENABLE ROW LEVEL SECURITY;

-- Recruiters see their own outreach history
CREATE POLICY "recruiter_outreach_select" ON public.recruiter_outreach
  FOR SELECT USING (auth.uid() = recruiter_id);

CREATE POLICY "recruiter_outreach_insert" ON public.recruiter_outreach
  FOR INSERT WITH CHECK (auth.uid() = recruiter_id);

-- Candidates can see outreach sent to them
CREATE POLICY "candidate_view_inbound_outreach" ON public.recruiter_outreach
  FOR SELECT USING (auth.uid() = candidate_id);

-- Index for common lookups
CREATE INDEX IF NOT EXISTS idx_recruiter_outreach_recruiter ON public.recruiter_outreach(recruiter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recruiter_outreach_candidate ON public.recruiter_outreach(candidate_id);
