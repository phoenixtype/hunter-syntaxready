-- Enhance existing subscriptions table with advanced features
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS
feature_limits JSONB DEFAULT '{
  "job_applications": -1,
  "resume_generations": -1,
  "ai_interviews": -1,
  "cover_letters": -1,
  "job_matches": -1,
  "company_research": -1,
  "skill_assessments": -1
}';

-- Add unique constraint to handle ON CONFLICT properly (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'subscriptions_user_id_unique'
    ) THEN
        ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
    END IF;
END $$;

-- Create usage tracking table (linking to subscriptions, not user_subscriptions)
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, feature_name, period_start)
);

-- Migrate any pro users from user_subscriptions to subscriptions if needed
INSERT INTO subscriptions (user_id, tier, status, feature_limits, created_at, updated_at)
SELECT
  us.user_id,
  CASE
    WHEN sp.name = 'pro' THEN 'pro'
    WHEN sp.name = 'enterprise' THEN 'enterprise'
    ELSE 'free'
  END as tier,
  us.status,
  CASE
    WHEN sp.name = 'free' THEN '{
      "job_applications": 5,
      "resume_generations": 3,
      "ai_interviews": 2,
      "cover_letters": 5,
      "job_matches": 20,
      "company_research": 10,
      "skill_assessments": 1
    }'::jsonb
    WHEN sp.name = 'pro' THEN '{
      "job_applications": 100,
      "resume_generations": 50,
      "ai_interviews": 25,
      "cover_letters": 100,
      "job_matches": 500,
      "company_research": 200,
      "skill_assessments": 10
    }'::jsonb
    ELSE '{
      "job_applications": -1,
      "resume_generations": -1,
      "ai_interviews": -1,
      "cover_letters": -1,
      "job_matches": -1,
      "company_research": -1,
      "skill_assessments": -1
    }'::jsonb
  END as feature_limits,
  us.created_at,
  us.updated_at
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active'
ON CONFLICT (user_id) DO UPDATE SET
  tier = EXCLUDED.tier,
  status = EXCLUDED.status,
  feature_limits = EXCLUDED.feature_limits;

-- Update existing subscriptions with proper feature limits
UPDATE subscriptions SET feature_limits = '{
  "job_applications": 5,
  "resume_generations": 3,
  "ai_interviews": 2,
  "cover_letters": 5,
  "job_matches": 20,
  "company_research": 10,
  "skill_assessments": 1
}' WHERE tier = 'free' AND feature_limits = '{
  "job_applications": -1,
  "resume_generations": -1,
  "ai_interviews": -1,
  "cover_letters": -1,
  "job_matches": -1,
  "company_research": -1,
  "skill_assessments": -1
}';

UPDATE subscriptions SET feature_limits = '{
  "job_applications": 100,
  "resume_generations": 50,
  "ai_interviews": 25,
  "cover_letters": 100,
  "job_matches": 500,
  "company_research": 200,
  "skill_assessments": 10
}' WHERE tier = 'pro';

UPDATE subscriptions SET feature_limits = '{
  "job_applications": -1,
  "resume_generations": -1,
  "ai_interviews": -1,
  "cover_letters": -1,
  "job_matches": -1,
  "company_research": -1,
  "skill_assessments": -1
}' WHERE tier = 'enterprise';

-- Check and drop existing functions if they have different signatures
-- Note: We only drop the specific signatures we're about to create
-- to avoid conflicts with other existing functions
DROP FUNCTION IF EXISTS get_feature_usage(UUID, TEXT);

-- Create usage tracking functions
CREATE OR REPLACE FUNCTION get_feature_usage(
  p_user_id UUID,
  p_feature_name TEXT
) RETURNS INTEGER AS $$
DECLARE
  result_usage INTEGER := 0;
BEGIN
  SELECT COALESCE(su.usage_count, 0) INTO result_usage
  FROM subscription_usage su
  WHERE su.user_id = p_user_id
  AND su.feature_name = p_feature_name
  AND su.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE;

  -- Ensure we return 0 if no record found
  IF result_usage IS NULL THEN
    result_usage := 0;
  END IF;

  RETURN result_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_subscription_usage(
  p_user_id UUID,
  p_feature_name TEXT,
  p_count INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO subscription_usage (
    user_id,
    feature_name,
    usage_count,
    period_start,
    period_end
  ) VALUES (
    p_user_id,
    p_feature_name,
    p_count,
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
  )
  ON CONFLICT (user_id, feature_name, period_start)
  DO UPDATE SET
    usage_count = subscription_usage.usage_count + p_count,
    updated_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON subscription_usage
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert usage" ON subscription_usage
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_feature
  ON subscription_usage (user_id, feature_name);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_period
  ON subscription_usage (period_start);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON subscription_usage TO authenticated;
GRANT ALL ON subscription_usage TO service_role;