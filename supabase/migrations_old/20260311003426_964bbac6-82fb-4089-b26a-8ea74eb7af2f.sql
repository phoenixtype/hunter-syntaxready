
-- Create a security definer function for admin analytics
-- This returns platform-wide aggregate counts without exposing individual records
CREATE OR REPLACE FUNCTION public.get_platform_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'total_applications', (SELECT count(*) FROM public.application_history),
    'total_resumes', (SELECT count(*) FROM public.candidate_profiles),
    'total_jobs', (SELECT count(*) FROM public.job_listings),
    'applications_by_status', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'count', cnt)), '[]'::jsonb)
      FROM (
        SELECT COALESCE(status, 'unknown') as status, count(*) as cnt
        FROM public.application_history
        GROUP BY status
      ) s
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
