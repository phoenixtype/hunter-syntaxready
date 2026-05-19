-- Daily Job Discovery System - Database Schema
-- Creates tables for distributed crawl orchestration, job deduplication, and daily digest queue

-- Daily crawl wave orchestration
CREATE TABLE daily_crawl_waves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wave_time timestamp with time zone NOT NULL,
  wave_type text NOT NULL CHECK (wave_type IN ('morning', 'midday', 'evening', 'midnight')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  users_processed integer DEFAULT 0,
  jobs_discovered integer DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  errors text[],
  created_at timestamp with time zone DEFAULT now()
);

-- Job deduplication tracking using SHA-256 fingerprints
CREATE TABLE job_fingerprints (
  fingerprint_hash text PRIMARY KEY,
  first_seen_at timestamp with time zone DEFAULT now(),
  last_seen_at timestamp with time zone DEFAULT now(),
  source_count integer DEFAULT 1,
  sources text[],
  created_at timestamp with time zone DEFAULT now()
);

-- Fresh job queue for daily digest delivery
CREATE TABLE daily_job_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  match_score decimal(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  match_reasons text[],
  queued_at timestamp with time zone DEFAULT now(),
  wave_id uuid REFERENCES daily_crawl_waves(id),
  sent_at timestamp with time zone,
  digest_date date DEFAULT current_date,
  created_at timestamp with time zone DEFAULT now(),

  -- Prevent duplicate job-user pairs per day
  CONSTRAINT unique_user_job_per_day UNIQUE (user_id, job_id, digest_date)
);

-- Performance indexes for daily job discovery operations
CREATE INDEX idx_daily_crawl_waves_wave_time ON daily_crawl_waves(wave_time);
CREATE INDEX idx_daily_crawl_waves_status ON daily_crawl_waves(status);
CREATE INDEX idx_job_fingerprints_last_seen ON job_fingerprints(last_seen_at);
CREATE INDEX idx_daily_job_queue_user_digest ON daily_job_queue(user_id, digest_date);
CREATE INDEX idx_daily_job_queue_sent_at ON daily_job_queue(sent_at) WHERE sent_at IS NULL;
CREATE INDEX idx_daily_job_queue_match_score ON daily_job_queue(match_score DESC);
CREATE INDEX idx_daily_job_queue_wave_id ON daily_job_queue(wave_id);

-- Add fresh job tracking to user preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS fresh_job_digest_time time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS fresh_job_digest_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS fresh_job_digest_timezone text DEFAULT 'UTC';

-- Add crawl priority to profiles for Pro-first processing
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_crawl_wave timestamp with time zone,
ADD COLUMN IF NOT EXISTS crawl_priority integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS pro_user boolean DEFAULT false;

-- RLS policies for daily job discovery tables
ALTER TABLE daily_crawl_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_job_queue ENABLE ROW LEVEL SECURITY;

-- Admins can view all crawl wave data
CREATE POLICY "Admins can manage crawl waves" ON daily_crawl_waves
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid()
    )
  );

-- Job fingerprints are system-level (no user access needed)
CREATE POLICY "System access only" ON job_fingerprints
  FOR ALL USING (false);

-- Users can only see their own job queue entries
CREATE POLICY "Users see own job queue" ON daily_job_queue
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can see all job queue entries
CREATE POLICY "Admins see all job queues" ON daily_job_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE daily_crawl_waves IS 'Tracks daily crawl wave orchestration and progress';
COMMENT ON TABLE job_fingerprints IS 'SHA-256 deduplication tracking for job listings';
COMMENT ON TABLE daily_job_queue IS 'Queue of fresh job matches for daily digest delivery';
COMMENT ON COLUMN daily_job_queue.match_score IS 'Profile match score (0-100), minimum 70 for inclusion';
COMMENT ON COLUMN profiles.crawl_priority IS 'Crawl priority: 1=free users, 2=pro users for Pro-first processing';