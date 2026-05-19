-- ==========================================
-- USAGE LIMITS & OVERAGE PAYMENT SYSTEM
-- ==========================================

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stripe_price_id TEXT, -- Stripe price ID for monthly billing
    stripe_price_id_yearly TEXT, -- Stripe price ID for yearly billing
    feature_limits JSONB NOT NULL DEFAULT '{}',
    overage_rates JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id) -- One active subscription per user
);

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL, -- 'job_applications', 'resume_generations', 'ai_interviews', etc.
    usage_count INTEGER NOT NULL DEFAULT 1,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metadata JSONB DEFAULT '{}', -- Additional context about the usage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, feature_name, period_start) -- One record per user/feature/period
);

-- Create overage purchases table
CREATE TABLE IF NOT EXISTS overage_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    stripe_payment_intent_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    expires_at TIMESTAMP WITH TIME ZONE, -- When the overage credits expire
    used_count INTEGER DEFAULT 0, -- How many overage credits have been used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create usage alerts table
CREATE TABLE IF NOT EXISTS usage_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    alert_threshold INTEGER NOT NULL, -- Percentage (e.g., 80 for 80%)
    alert_type TEXT NOT NULL CHECK (alert_type IN ('warning', 'limit_reached', 'overage')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, stripe_price_id, stripe_price_id_yearly, feature_limits, overage_rates, sort_order) VALUES
(
    'free',
    'Free Tier',
    'Perfect for exploring Hunter AI',
    0.00,
    0.00,
    NULL,
    NULL,
    '{
        "job_applications": 5,
        "resume_generations": 3,
        "ai_interviews": 2,
        "cover_letters": 5,
        "job_matches": 20,
        "company_research": 10,
        "skill_assessments": 1
    }',
    '{
        "job_applications": 2.00,
        "resume_generations": 5.00,
        "ai_interviews": 10.00,
        "cover_letters": 1.50,
        "job_matches": 0.50,
        "company_research": 1.00,
        "skill_assessments": 15.00
    }',
    1
),
(
    'pro',
    'Pro Plan',
    'For serious job seekers',
    19.99,
    199.99,
    'price_test_pro', -- Test Stripe price ID
    'price_test_pro_yearly',
    '{
        "job_applications": 100,
        "resume_generations": 50,
        "ai_interviews": 25,
        "cover_letters": 100,
        "job_matches": 500,
        "company_research": 200,
        "skill_assessments": 10
    }',
    '{
        "job_applications": 1.50,
        "resume_generations": 3.00,
        "ai_interviews": 7.50,
        "cover_letters": 1.00,
        "job_matches": 0.25,
        "company_research": 0.75,
        "skill_assessments": 10.00
    }',
    2
),
(
    'enterprise',
    'Enterprise Plan',
    'For teams and organizations',
    99.99,
    999.99,
    'price_test_enterprise',
    'price_test_enterprise_yearly',
    '{
        "job_applications": -1,
        "resume_generations": -1,
        "ai_interviews": -1,
        "cover_letters": -1,
        "job_matches": -1,
        "company_research": -1,
        "skill_assessments": -1
    }',
    '{
        "job_applications": 1.00,
        "resume_generations": 2.00,
        "ai_interviews": 5.00,
        "cover_letters": 0.75,
        "job_matches": 0.10,
        "company_research": 0.50,
        "skill_assessments": 7.50
    }',
    3
);

-- Create function to get user's current usage for a feature
CREATE OR REPLACE FUNCTION get_current_usage(
    p_user_id UUID,
    p_feature_name TEXT,
    p_period_start DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
    usage_count INTEGER := 0;
BEGIN
    SELECT COALESCE(SUM(usage_count), 0)
    INTO usage_count
    FROM usage_tracking
    WHERE user_id = p_user_id
    AND feature_name = p_feature_name
    AND period_start >= DATE_TRUNC('month', p_period_start)::DATE
    AND period_start < (DATE_TRUNC('month', p_period_start) + INTERVAL '1 month')::DATE;

    RETURN usage_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can use a feature
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
    user_plan RECORD;
    current_period_start DATE;
    user_usage INTEGER;
    feature_limit INTEGER;
    overage_credits INTEGER := 0;
BEGIN
    -- Get current billing period start (monthly)
    current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;

    -- Get user's subscription and plan details
    SELECT
        sp.name as plan_name,
        sp.feature_limits,
        sp.overage_rates,
        us.current_period_start::DATE as period_start
    INTO user_plan
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND us.current_period_end > NOW();

    -- If no active subscription, default to free plan
    IF user_plan IS NULL THEN
        SELECT
            name as plan_name,
            feature_limits,
            overage_rates
        INTO user_plan
        FROM subscription_plans
        WHERE name = 'free';
        current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    ELSE
        current_period_start := user_plan.period_start;
    END IF;

    -- Get current usage for this feature
    user_usage := get_current_usage(p_user_id, p_feature_name, current_period_start);

    -- Get feature limit (-1 means unlimited)
    feature_limit := (user_plan.feature_limits->>p_feature_name)::INTEGER;

    -- Get available overage credits
    SELECT COALESCE(SUM(quantity - used_count), 0)
    INTO overage_credits
    FROM overage_purchases
    WHERE user_id = p_user_id
    AND feature_name = p_feature_name
    AND status = 'succeeded'
    AND (expires_at IS NULL OR expires_at > NOW())
    AND used_count < quantity;

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
            user_plan.plan_name;
    ELSE
        DECLARE
            total_available INTEGER := feature_limit + overage_credits;
            can_proceed BOOLEAN := (user_usage + p_requested_count) <= total_available;
            remaining INTEGER := GREATEST(0, total_available - user_usage);
            overage_req INTEGER := GREATEST(0, (user_usage + p_requested_count) - total_available);
            overage_price DECIMAL := overage_req * (user_plan.overage_rates->>p_feature_name)::DECIMAL;
        BEGIN
            RETURN QUERY SELECT
                can_proceed,
                user_usage,
                feature_limit,
                remaining,
                overage_req,
                overage_price,
                user_plan.plan_name;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to record usage
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

    -- Consume overage credits if needed
    -- Get the user's plan limit
    DECLARE
        feature_limit INTEGER;
        total_usage INTEGER;
    BEGIN
        SELECT (sp.feature_limits->>p_feature_name)::INTEGER
        INTO feature_limit
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.user_id = p_user_id
        AND us.status = 'active';

        IF feature_limit IS NULL THEN
            SELECT (feature_limits->>'job_applications')::INTEGER
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
                SELECT id,
                       quantity,
                       used_count,
                       LEAST(quantity - used_count, overage_to_consume) as to_consume
                FROM overage_purchases
                WHERE user_id = p_user_id
                AND feature_name = p_feature_name
                AND status = 'succeeded'
                AND (expires_at IS NULL OR expires_at > NOW())
                AND used_count < quantity
                ORDER BY created_at ASC
            )
            UPDATE overage_purchases
            SET used_count = used_count + consumed_credits.to_consume,
                updated_at = NOW()
            FROM consumed_credits
            WHERE overage_purchases.id = consumed_credits.id
            AND consumed_credits.to_consume > 0;
        END IF;
    END;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to purchase overage credits
CREATE OR REPLACE FUNCTION purchase_overage_credits(
    p_user_id UUID,
    p_feature_name TEXT,
    p_quantity INTEGER,
    p_payment_intent_id TEXT
) RETURNS UUID AS $$
DECLARE
    plan_overage_rate DECIMAL;
    total_cost DECIMAL;
    purchase_id UUID;
BEGIN
    -- Get overage rate for user's plan
    SELECT (sp.overage_rates->>p_feature_name)::DECIMAL
    INTO plan_overage_rate
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id
    AND us.status = 'active';

    -- Default to free plan rates if no subscription
    IF plan_overage_rate IS NULL THEN
        SELECT (overage_rates->>p_feature_name)::DECIMAL
        INTO plan_overage_rate
        FROM subscription_plans
        WHERE name = 'free';
    END IF;

    total_cost := p_quantity * plan_overage_rate;

    -- Insert overage purchase record
    INSERT INTO overage_purchases (
        user_id,
        feature_name,
        quantity,
        unit_price,
        total_amount,
        stripe_payment_intent_id,
        status,
        expires_at
    )
    VALUES (
        p_user_id,
        p_feature_name,
        p_quantity,
        plan_overage_rate,
        total_cost,
        p_payment_intent_id,
        'pending',
        NOW() + INTERVAL '1 year' -- Credits expire in 1 year
    )
    RETURNING id INTO purchase_id;

    RETURN purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_feature_period ON usage_tracking (user_id, feature_name, period_start);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period_start ON usage_tracking (period_start);
CREATE INDEX IF NOT EXISTS idx_overage_purchases_user_feature ON overage_purchases (user_id, feature_name);
CREATE INDEX IF NOT EXISTS idx_overage_purchases_status ON overage_purchases (status);
CREATE INDEX IF NOT EXISTS idx_usage_alerts_user_id ON usage_alerts (user_id);

-- Add RLS policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE overage_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_alerts ENABLE ROW LEVEL SECURITY;

-- Subscription plans are public (everyone can view)
CREATE POLICY "Anyone can view subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Users can only see their own subscription
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (user_id = auth.uid());

-- Users can only see their own usage
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT USING (user_id = auth.uid());

-- Users can only see their own overage purchases
CREATE POLICY "Users can view own overage purchases" ON overage_purchases
    FOR SELECT USING (user_id = auth.uid());

-- Users can only see their own alerts
CREATE POLICY "Users can view own usage alerts" ON usage_alerts
    FOR SELECT USING (user_id = auth.uid());

-- Allow system to insert usage records
CREATE POLICY "System can insert usage records" ON usage_tracking
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow system to insert overage purchases
CREATE POLICY "System can insert overage purchases" ON overage_purchases
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow system to update overage purchase status
CREATE POLICY "System can update overage purchases" ON overage_purchases
    FOR UPDATE USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE subscription_plans IS 'Defines available subscription tiers and their feature limits';
COMMENT ON TABLE user_subscriptions IS 'Tracks active user subscriptions';
COMMENT ON TABLE usage_tracking IS 'Records feature usage per user per billing period';
COMMENT ON TABLE overage_purchases IS 'Tracks overage credit purchases and usage';
COMMENT ON FUNCTION check_feature_usage_limit IS 'Checks if user can use a feature and calculates overage costs';
COMMENT ON FUNCTION record_feature_usage IS 'Records feature usage and consumes overage credits automatically';
COMMENT ON FUNCTION purchase_overage_credits IS 'Creates overage credit purchase record';