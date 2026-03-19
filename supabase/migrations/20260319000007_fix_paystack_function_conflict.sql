-- Fix function conflict when adding currency support
-- Drop and recreate the function with new return type

-- Drop existing function
DROP FUNCTION IF EXISTS check_feature_usage_limit(UUID, TEXT, INTEGER);

-- Recreate with currency-aware return type
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
    plan_limits RECORD;
    current_period_start DATE;
    user_usage INTEGER;
    feature_limit INTEGER;
    overage_credits INTEGER := 0;
    overage_rate DECIMAL;
BEGIN
    -- Get current billing period start (monthly)
    current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;

    -- Get user's subscription tier from simple subscriptions table
    SELECT s.tier, COALESCE(s.currency, 'usd') INTO user_tier, user_currency
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status = 'active';

    -- Default to free if no subscription found
    IF user_tier IS NULL THEN
        user_tier := 'free';
        user_currency := 'usd';
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

    -- Get currency-appropriate overage rate
    IF user_currency = 'ngn' THEN
        overage_rate := COALESCE(
            (plan_limits.overage_rates->>(p_feature_name || '_ngn'))::DECIMAL,
            (plan_limits.overage_rates->>p_feature_name)::DECIMAL * 1600
        );
    ELSE
        overage_rate := (plan_limits.overage_rates->>p_feature_name)::DECIMAL;
    END IF;

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
            overage_price DECIMAL := overage_req * overage_rate;
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