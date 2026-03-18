-- DB bug fixes from audit
--
-- 1. Missing index on recruiter_outreach.candidate_id
--    Without this, candidate-side outreach lookups (inbound messages) do full table scans.
CREATE INDEX IF NOT EXISTS recruiter_outreach_candidate_id_idx
  ON public.recruiter_outreach (candidate_id);

-- 2. platform_admins.created_by had no ON DELETE clause (defaulted to RESTRICT).
--    If the user who created an admin record is deleted, that admin row becomes
--    un-deletable. Fix: drop the constraint and re-add with ON DELETE SET NULL.
ALTER TABLE public.platform_admins
  DROP CONSTRAINT IF EXISTS platform_admins_created_by_fkey;

ALTER TABLE public.platform_admins
  ADD CONSTRAINT platform_admins_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
