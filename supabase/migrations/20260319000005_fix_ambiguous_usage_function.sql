-- Fix ambiguous column reference in usage functions
-- The issue was that variable names matched column names, causing ambiguity

-- Drop existing function and recreate with proper column qualification
DROP FUNCTION IF EXISTS get_current_usage(UUID, TEXT, DATE);

CREATE OR REPLACE FUNCTION get_current_usage(
    p_user_id UUID,
    p_feature_name TEXT,
    p_period_start DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
    total_usage INTEGER := 0;
BEGIN
    SELECT COALESCE(SUM(ut.usage_count), 0)
    INTO total_usage
    FROM usage_tracking ut
    WHERE ut.user_id = p_user_id
    AND ut.feature_name = p_feature_name
    AND ut.period_start >= DATE_TRUNC('month', p_period_start)::DATE
    AND ut.period_start < (DATE_TRUNC('month', p_period_start) + INTERVAL '1 month')::DATE;

    RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the record_feature_usage function with similar issue
DROP FUNCTION IF EXISTS record_feature_usage(UUID, TEXT, INTEGER, JSONB);

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

    -- Insert or update usage tracking
    INSERT INTO usage_tracking (
        user_id,
        feature_name,
        usage_count,
        period_start,
        period_end,
        metadata
    )
    VALUES (
        p_user_id,
        p_feature_name,
        p_usage_count,
        current_period_start,
        current_period_end,
        p_metadata
    )
    ON CONFLICT (user_id, feature_name, period_start)
    DO UPDATE SET
        usage_count = usage_tracking.usage_count + p_usage_count,
        metadata = usage_tracking.metadata || p_metadata,
        updated_at = NOW();

    -- Get the user's plan limit from the simple subscriptions table
    SELECT (sp.feature_limits->>p_feature_name)::INTEGER
    INTO feature_limit
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.name = s.tier
    WHERE s.user_id = p_user_id
    AND s.status = 'active';

    -- Default to free plan if no subscription
    IF feature_limit IS NULL THEN
        SELECT (feature_limits->>p_feature_name)::INTEGER
        INTO feature_limit
        FROM subscription_plans
        WHERE name = 'free';
    END IF;

    -- Get total usage for this period
    total_usage := get_current_usage(p_user_id, p_feature_name, current_period_start);

    -- If usage exceeds plan limit, consume overage credits
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

-- Fix check_feature_usage_limit to work with simple subscriptions table
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
    subscription_plan TEXT
) AS $$
DECLARE
    user_tier TEXT;
    plan_limits RECORD;
    current_period_start DATE;
    user_usage INTEGER;
    feature_limit INTEGER;
    overage_credits INTEGER := 0;
BEGIN
    -- Get current billing period start (monthly)
    current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;

    -- Get user's subscription tier from simple subscriptions table
    SELECT s.tier INTO user_tier
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status = 'active';

    -- Default to free if no subscription found
    IF user_tier IS NULL THEN
        user_tier := 'free';
    END IF;

    -- Get plan limits from subscription_plans table
    SELECT sp.feature_limits, sp.overage_rates
    INTO plan_limits
    FROM subscription_plans sp
    WHERE sp.name = user_tier;

    -- Get current usage for this feature
    user_usage := get_current_usage(p_user_id, p_feature_name, current_period_start);

    -- Get feature limit (-1 means unlimited)
    feature_limit := (plan_limits.feature_limits->>p_feature_name)::INTEGER;

    -- Get available overage credits
    SELECT COALESCE(SUM(op.quantity - op.used_count), 0)
    INTO overage_credits
    FROM overage_purchases op
    WHERE op.user_id = p_user_id
    AND op.feature_name = p_feature_name
    AND op.status = 'succeeded'
    AND (op.expires_at IS NULL OR op.expires_at > NOW())
    AND op.used_count < op.quantity;

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
            user_tier;
    ELSE
        DECLARE
            total_available INTEGER := feature_limit + overage_credits;
            can_proceed BOOLEAN := (user_usage + p_requested_count) <= total_available;
            remaining INTEGER := GREATEST(0, total_available - user_usage);
            overage_req INTEGER := GREATEST(0, (user_usage + p_requested_count) - total_available);
            overage_price DECIMAL := overage_req * (plan_limits.overage_rates->>p_feature_name)::DECIMAL;
        BEGIN
            RETURN QUERY SELECT
                can_proceed,
                user_usage,
                feature_limit,
                remaining,
                overage_req,
                overage_price,
                user_tier;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;