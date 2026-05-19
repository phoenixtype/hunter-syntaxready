-- Add applicant cap to recruiter_jobs
-- Null = no cap; positive integer = maximum number of shortlisted applicants
ALTER TABLE public.recruiter_jobs
  ADD COLUMN IF NOT EXISTS max_applicants integer CHECK (max_applicants IS NULL OR max_applicants > 0);

COMMENT ON COLUMN public.recruiter_jobs.max_applicants IS
  'Maximum number of applicants to shortlist. NULL means no cap. Auto-apply respects this limit by only inserting the top-scoring candidates.';
