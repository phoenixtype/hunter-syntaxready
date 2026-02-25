
-- Table to persist tailored/optimized resumes
CREATE TABLE public.tailored_resumes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  job_url TEXT,
  cover_letter TEXT NOT NULL DEFAULT '',
  changes_summary TEXT[] NOT NULL DEFAULT '{}',
  tailored_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tailored_resumes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own tailored resumes"
ON public.tailored_resumes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tailored resumes"
ON public.tailored_resumes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tailored resumes"
ON public.tailored_resumes FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_tailored_resumes_user_id ON public.tailored_resumes(user_id);
CREATE INDEX idx_tailored_resumes_created_at ON public.tailored_resumes(created_at DESC);
