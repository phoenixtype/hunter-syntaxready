
-- Schedule auto-job-discovery to run every 2 hours
-- This keeps the job feed fresh by automatically crawling new jobs based on user preferences

-- Remove any existing schedule first to keep the migration idempotent
SELECT cron.unschedule('auto-job-discovery-every-2-hours')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-job-discovery-every-2-hours');

SELECT cron.schedule(
  'auto-job-discovery-every-2-hours',
  '0 */2 * * *', -- Every 2 hours on the hour
  $$
  SELECT net.http_post(
    url := 'https://ffjsgjsiemtxqbhimvhb.supabase.co/functions/v1/auto-job-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmanNnanNpZW10eHFiaGltdmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0Mjc4NzAsImV4cCI6MjA4MjAwMzg3MH0.h6ld2FmBGzpdtuxL42eHHXMrqgh2HRZMWEa3z2TUax0'
    ),
    body := jsonb_build_object('triggered_by', 'cron', 'time', now()::text)
  ) AS request_id;
  $$
);
