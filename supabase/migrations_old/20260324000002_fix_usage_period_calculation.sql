-- Fix usage period calculation: use subscription's actual billing period
-- instead of calendar month truncation (DATE_TRUNC('month')).
--
-- Problem: A user subscribing on March 15 had their usage tracked against
-- the March 1-31 calendar month, not their actual March 15 - April 15 billing period.
-- This caused usage counts to reset mid-billing cycle or not reset at renewal.

-- 1. Fix get_current_usage to accept actual period start
CREATE OR REPLACE FUNCTION get_current_usage(
    p_user_id UUID,
    p_feature_name TEXT,
    p_period_start DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
    total_usage INTEGER := 0;
    actual_period_start DATE;
BEGIN
    -- Try to get the subscription's actual period start
    SELECT s.current_period_start::DATE
    INTO actual_period_start
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing');

    -- Fall back to calendar month if no subscription
    IF actual_period_start IS NULL THEN
        actual_period_start := DATE_TRUNC('month', p_period_start)::DATE;
    END IF;

    SELECT COALESCE(su.usage_count, 0)
    INTO total_usage
    FROM subscription_usage su
    WHERE su.user_id = p_user_id
    AND su.feature_name = p_feature_name
    AND su.period_start = actual_period_start;

    RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix check_feature_usage_limit to use actual billing period
-- Must drop first because the return type signature may differ
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
    -- Get subscription billing period start (actual, not calendar month)
    SELECT s.tier,
           COALESCE(s.currency, 'usd'),
           (s.feature_limits->>p_feature_name)::INTEGER,
           COALESCE(s.current_period_start::DATE, DATE_TRUNC('month', CURRENT_DATE)::DATE)
    INTO user_tier, user_currency, feature_limit, current_period_start
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing');

    -- Default to free tier if no subscription found
    IF user_tier IS NULL THEN
        user_tier := 'free';
        user_currency := 'usd';
        current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
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

    -- Get current usage from subscription_usage table (using actual period)
    user_usage := get_current_usage(p_user_id, p_feature_name, current_period_start);

    -- Get available overage credits
    SELECT COALESCE(SUM(op.quantity - op.used_count), 0)
    INTO overage_credits
    FROM overage_purchases op
    WHERE op.user_id = p_user_id
    AND op.feature_name = p_feature_name
    AND op.status = 'succeeded'
    AND op.expires_at > NOW();

    -- Handle unlimited features (-1 = unlimited)
    IF feature_limit = -1 THEN
        RETURN QUERY SELECT
            TRUE,
            user_usage,
            -1,
            -1,
            0,
            0::DECIMAL,
            user_tier,
            user_currency;
        RETURN;
    END IF;

    -- Calculate remaining and overage
    RETURN QUERY SELECT
        (user_usage + p_requested_count) <= (COALESCE(feature_limit, 0) + overage_credits),
        user_usage,
        COALESCE(feature_limit, 0),
        GREATEST(0, COALESCE(feature_limit, 0) - user_usage + overage_credits),
        GREATEST(0, (user_usage + p_requested_count) - COALESCE(feature_limit, 0) - overage_credits),
        overage_rate,
        user_tier,
        user_currency;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix record_feature_usage to use actual billing period
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
    -- Get actual billing period from subscription (not calendar month)
    SELECT COALESCE(s.current_period_start::DATE, DATE_TRUNC('month', CURRENT_DATE)::DATE),
           COALESCE(s.current_period_end::DATE, (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE)
    INTO current_period_start, current_period_end
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing');

    -- Default to calendar month for free users
    IF current_period_start IS NULL THEN
        current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
        current_period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;

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
    AND s.status IN ('active', 'trialing');

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

    -- If usage exceeds plan limit, consume overage credits
    total_usage := get_current_usage(p_user_id, p_feature_name, current_period_start);

    IF feature_limit >= 0 AND total_usage > feature_limit THEN
        overage_to_consume := LEAST(p_usage_count, total_usage - feature_limit);

        IF overage_to_consume > 0 THEN
            WITH consumed_credits AS (
                SELECT op.id, LEAST(op.quantity - op.used_count, overage_to_consume) AS to_consume
                FROM overage_purchases op
                WHERE op.user_id = p_user_id
                AND op.feature_name = p_feature_name
                AND op.status = 'succeeded'
                AND op.expires_at > NOW()
                AND op.used_count < op.quantity
                ORDER BY op.expires_at ASC
                LIMIT overage_to_consume
            )
            UPDATE overage_purchases
            SET used_count = overage_purchases.used_count + consumed_credits.to_consume,
                updated_at = NOW()
            FROM consumed_credits
            WHERE overage_purchases.id = consumed_credits.id
            AND consumed_credits.to_consume > 0;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
