-- Fix critical database integration issues
-- This migration ensures the database functions match frontend expectations exactly

-- 1. Fix record_feature_usage function signature to match frontend expectations
-- Drop the old function and create the correct one
DROP FUNCTION IF EXISTS public.record_feature_usage(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.record_feature_usage(
    p_user_id UUID,
    p_feature_name TEXT,
    p_usage_count INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'::JSONB
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
        p_usage_count,
        DATE_TRUNC('month', CURRENT_DATE)::DATE,
        (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
    )
    ON CONFLICT (user_id, feature_name, period_start)
    DO UPDATE SET
        usage_count = subscription_usage.usage_count + p_usage_count,
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure check_feature_usage_limit function exists with correct signature
-- Drop any existing version first
DROP FUNCTION IF EXISTS public.check_feature_usage_limit(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.check_feature_usage_limit(
    p_user_id UUID,
    p_feature_name TEXT,
    p_requested_count INTEGER DEFAULT 1
) RETURNS TABLE (
    can_use BOOLEAN,
    current_usage INTEGER,
    limit_amount INTEGER,
    remaining_amount INTEGER
) AS $$
DECLARE
    user_tier TEXT;
    feature_limit INTEGER;
    current_usage_count INTEGER;
BEGIN
    -- Get user's subscription tier and limits from subscriptions table
    SELECT s.tier, (s.feature_limits->>p_feature_name)::INTEGER
    INTO user_tier, feature_limit
    FROM subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active';

    -- Default to free tier if no subscription found
    IF user_tier IS NULL THEN
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

    -- Get current usage
    SELECT COALESCE(su.usage_count, 0) INTO current_usage_count
    FROM subscription_usage su
    WHERE su.user_id = p_user_id
    AND su.feature_name = p_feature_name
    AND su.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE;

    -- Return results
    RETURN QUERY SELECT
        CASE
            WHEN feature_limit = -1 THEN TRUE  -- Unlimited
            WHEN current_usage_count + p_requested_count <= feature_limit THEN TRUE
            ELSE FALSE
        END as can_use,
        current_usage_count as current_usage,
        feature_limit as limit_amount,
        CASE
            WHEN feature_limit = -1 THEN -1
            ELSE GREATEST(0, feature_limit - current_usage_count)
        END as remaining_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure feature_limits column exists on subscriptions table
-- This should already exist from previous migrations, but let's be safe
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS feature_limits JSONB DEFAULT '{
  "job_applications": -1,
  "resume_generations": -1,
  "ai_interviews": -1,
  "cover_letters": -1,
  "job_matches": -1,
  "company_research": -1,
  "skill_assessments": -1
}'::JSONB;

-- 4. Ensure RLS policies allow function access
-- Enable RLS if not already enabled
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

-- Create policy for usage functions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'subscription_usage'
        AND policyname = 'Users can manage own usage records'
    ) THEN
        CREATE POLICY "Users can manage own usage records"
        ON public.subscription_usage
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_feature_usage TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_feature_usage_limit TO authenticated;

-- Comment to describe the fix
COMMENT ON FUNCTION public.record_feature_usage IS 'Records feature usage with correct parameter names (p_usage_count, p_metadata) to match frontend expectations';
COMMENT ON FUNCTION public.check_feature_usage_limit IS 'Checks feature usage limits returning simplified table structure for frontend compatibility';