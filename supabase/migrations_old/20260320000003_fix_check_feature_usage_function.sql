-- Fix check_feature_usage_limit function to use subscriptions.feature_limits instead of subscription_plans
-- This ensures compatibility with the new enhanced subscriptions system

-- Drop and recreate the function with the correct implementation
DROP FUNCTION IF EXISTS check_feature_usage_limit(UUID, TEXT, INTEGER);

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