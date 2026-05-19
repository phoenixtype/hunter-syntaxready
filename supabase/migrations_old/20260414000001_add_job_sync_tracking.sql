-- Add job sync tracking to profiles table for auto-discovery
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_job_sync timestamptz DEFAULT NULL;

-- Create index for efficient auto-discovery queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_job_sync ON profiles(last_job_sync);

-- Add job discovery statistics table
CREATE TABLE IF NOT EXISTS job_discovery_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  total_users_processed integer DEFAULT 0,
  total_jobs_found integer DEFAULT 0,
  success_rate numeric(5,2) DEFAULT 0,
  average_jobs_per_user numeric(8,2) DEFAULT 0,
  execution_time_ms integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE job_discovery_stats ENABLE ROW LEVEL SECURITY;

-- Only admins can view discovery stats
CREATE POLICY "Admin access to job discovery stats" ON job_discovery_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid()
    )
  );

-- Add job freshness index for better performance
CREATE INDEX IF NOT EXISTS idx_job_listings_freshness ON job_listings(freshness_score DESC, created_at DESC) WHERE freshness_score > 0.3;

-- Add compound index for user job matching (without time predicate to avoid immutability issues)
CREATE INDEX IF NOT EXISTS idx_job_listings_matching ON job_listings(company, title, location, created_at);