-- Purge job listings older than 90 days
-- posted_at is stored as text, so we use an explicit cast to avoid
-- implicit cast errors on malformed values aborting the whole DELETE.

CREATE OR REPLACE FUNCTION public.purge_old_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.job_listings
  WHERE posted_at IS NOT NULL
    AND posted_at::timestamptz < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Schedule daily purge at 03:00 UTC (pg_cron already installed)
SELECT cron.schedule(
  'purge-expired-jobs',
  '0 3 * * *',
  $$SELECT public.purge_old_jobs()$$
);
