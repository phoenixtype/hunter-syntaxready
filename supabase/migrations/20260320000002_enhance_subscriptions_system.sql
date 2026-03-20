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

-- Drop existing functions to replace with new implementations that use subscription_usage table
DROP FUNCTION IF EXISTS check_feature_usage_limit(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS record_feature_usage(UUID, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS get_current_usage(UUID, TEXT, DATE);

-- Create helper function to get current usage from subscription_usage table
CREATE OR REPLACE FUNCTION get_current_usage(
    p_user_id UUID,
    p_feature_name TEXT,
    p_period_start DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
    total_usage INTEGER := 0;
BEGIN
    SELECT COALESCE(su.usage_count, 0)
    INTO total_usage
    FROM subscription_usage su
    WHERE su.user_id = p_user_id
    AND su.feature_name = p_feature_name
    AND su.period_start = DATE_TRUNC('month', p_period_start)::DATE;

    RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate check_feature_usage_limit with exact frontend signature, using new subscriptions.feature_limits
CREATE OR REPLACE FUNCTION check_feature_usage_limit(
    p_user_id UUID,
    p_feature_name TEXT,
    p_requested_count INTEGER DEFAULT 1
) RETURNS TABLE(
    can_use BOOLEAN,
    current_usage INTEGER,
    limit_amount INTEGER,
    remaining_amount INTEGER,
    overage_needed INTEGER,
    overage_cost DECIMAL,
    subscription_plan TEXT,
    currency TEXT
) AS $$
DECLARE
    user_tier TEXT;
    user_currency TEXT;
    current_period_start DATE;
    user_usage INTEGER;
    feature_limit INTEGER;
    overage_credits INTEGER := 0;
    overage_rate DECIMAL := 0;
BEGIN
    -- Get current billing period start (monthly)
    current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;

    -- Get user's subscription tier and feature limits from subscriptions table
    SELECT s.tier,
           COALESCE(s.currency, 'usd'),
           (s.feature_limits->>p_feature_name)::INTEGER
    INTO user_tier, user_currency, feature_limit
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status = 'active';

    -- Default to free tier if no subscription found
    IF user_tier IS NULL THEN
        user_tier := 'free';
        user_currency := 'usd';
        -- Set free tier limits
        feature_limit := CASE p_feature_name
            WHEN 'job_applications' THEN 5
            WHEN 'resume_generations' THEN 3
            WHEN 'ai_interviews' THEN 2
            WHEN 'cover_letters' THEN 5
            WHEN 'job_matches' THEN 20
            WHEN 'company_research' THEN 10
            WHEN 'skill_assessments' THEN 1
            ELSE 0
        END;
    END IF;

    -- Get current usage from subscription_usage table
    user_usage := get_current_usage(p_user_id, p_feature_name, current_period_start);

    -- Get available overage credits (if overage_purchases table exists)
    SELECT COALESCE(SUM(op.quantity - op.used_count), 0)
    INTO overage_credits
    FROM overage_purchases op
    WHERE op.user_id = p_user_id
    AND op.feature_name = p_feature_name
    AND op.status = 'succeeded'
    AND (op.expires_at IS NULL OR op.expires_at > NOW())
    AND op.used_count < op.quantity;

    -- Get overage rate from subscription_plans table
    SELECT CASE
        WHEN user_currency = 'ngn' THEN
            COALESCE(
                (sp.overage_rates->>(p_feature_name || '_ngn'))::DECIMAL,
                (sp.overage_rates->>p_feature_name)::DECIMAL * 1600
            )
        ELSE
            (sp.overage_rates->>p_feature_name)::DECIMAL
    END
    INTO overage_rate
    FROM subscription_plans sp
    WHERE sp.name = user_tier;

    -- Calculate results
    IF feature_limit = -1 THEN
        -- Unlimited plan
        RETURN QUERY SELECT
            TRUE::BOOLEAN,
            user_usage,
            -1,
            -1,
            0,
            0.00::DECIMAL,
            user_tier,
            user_currency;
    ELSE
        DECLARE
            total_available INTEGER := feature_limit + overage_credits;
            can_proceed BOOLEAN := (user_usage + p_requested_count) <= total_available;
            remaining INTEGER := GREATEST(0, total_available - user_usage);
            overage_req INTEGER := GREATEST(0, (user_usage + p_requested_count) - total_available);
            overage_price DECIMAL := overage_req * COALESCE(overage_rate, 0);
        BEGIN
            RETURN QUERY SELECT
                can_proceed,
                user_usage,
                feature_limit,
                remaining,
                overage_req,
                overage_price,
                user_tier,
                user_currency;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate record_feature_usage with exact frontend signature, using subscription_usage table
CREATE OR REPLACE FUNCTION record_feature_usage(
    p_user_id UUID,
    p_feature_name TEXT,
    p_usage_count INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    current_period_start DATE;
    current_period_end DATE;
    overage_to_consume INTEGER;
    feature_limit INTEGER;
    total_usage INTEGER;
BEGIN
    -- Calculate current billing period
    current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    current_period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Insert or update usage tracking in subscription_usage table
    INSERT INTO subscription_usage (
        user_id,
        feature_name,
        usage_count,
        period_start,
        period_end
    )
    VALUES (
        p_user_id,
        p_feature_name,
        p_usage_count,
        current_period_start,
        current_period_end
    )
    ON CONFLICT (user_id, feature_name, period_start)
    DO UPDATE SET
        usage_count = subscription_usage.usage_count + p_usage_count,
        updated_at = NOW();

    -- Get the user's plan limit from subscriptions table
    SELECT (s.feature_limits->>p_feature_name)::INTEGER
    INTO feature_limit
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status = 'active';

    -- Default to free plan if no subscription
    IF feature_limit IS NULL THEN
        feature_limit := CASE p_feature_name
            WHEN 'job_applications' THEN 5
            WHEN 'resume_generations' THEN 3
            WHEN 'ai_interviews' THEN 2
            WHEN 'cover_letters' THEN 5
            WHEN 'job_matches' THEN 20
            WHEN 'company_research' THEN 10
            WHEN 'skill_assessments' THEN 1
            ELSE 0
        END;
    END IF;

    -- Get total usage for this period
    total_usage := get_current_usage(p_user_id, p_feature_name, current_period_start);

    -- If usage exceeds plan limit, consume overage credits (if overage_purchases table exists)
    IF feature_limit != -1 AND total_usage > feature_limit THEN
        overage_to_consume := total_usage - feature_limit;

        -- Update overage purchases to mark credits as used
        WITH consumed_credits AS (
            SELECT op.id,
                   op.quantity,
                   op.used_count,
                   LEAST(op.quantity - op.used_count, overage_to_consume) as to_consume
            FROM overage_purchases op
            WHERE op.user_id = p_user_id
            AND op.feature_name = p_feature_name
            AND op.status = 'succeeded'
            AND (op.expires_at IS NULL OR op.expires_at > NOW())
            AND op.used_count < op.quantity
            ORDER BY op.created_at ASC
        )
        UPDATE overage_purchases
        SET used_count = overage_purchases.used_count + consumed_credits.to_consume,
            updated_at = NOW()
        FROM consumed_credits
        WHERE overage_purchases.id = consumed_credits.id
        AND consumed_credits.to_consume > 0;
    END IF;

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