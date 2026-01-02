-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job to run every 6 hours
-- schedule: 0 */6 * * * (At minute 0 past hour 0, 6, 12, and 18)
SELECT cron.schedule(
  'crawl-jobs-every-6-hours',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
      url:='https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/functions/v1/crawl-jobs',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer [YOUR_SERVICE_ROLE_KEY]"}'::jsonb,
      body:='{"sources": ["Y Combinator", "LinkedIn", "RemoteOK"], "keywords": ["software engineer", "full stack", "react", "typescript"]}'::jsonb
  ) as request_id;
  $$
);

-- Note for User:
-- Replace [YOUR_SUPABASE_PROJECT_REF] with your actual project ID (from dashboard url)
-- Replace [YOUR_SERVICE_ROLE_KEY] with your actual Service Role Secret (not anon key)
-- You can run this in the Supabase SQL Editor.

-- To check status:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
