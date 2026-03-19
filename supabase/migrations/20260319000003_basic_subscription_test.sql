-- Basic subscription system for testing
-- This migration focuses only on the core subscription functionality

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    stripe_price_id TEXT,
    stripe_price_id_yearly TEXT,
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
    user_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    feature_name TEXT NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 1,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, feature_name, period_start)
);

-- Create overage purchases table
CREATE TABLE IF NOT EXISTS overage_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    feature_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    stripe_payment_intent_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    expires_at TIMESTAMP WITH TIME ZONE,
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    'price_test_pro',
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
)
ON CONFLICT (name) DO NOTHING;

-- Function to get user's current usage for a feature
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

-- Function to check if user can use a feature
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

-- Function to record usage
CREATE OR REPLACE FUNCTION record_feature_usage(
    p_user_id UUID,
    p_feature_name TEXT,
    p_usage_count INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    current_period_start DATE;
    current_period_end DATE;
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

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to purchase overage credits
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
        NOW() + INTERVAL '1 year'
    )
    RETURNING id INTO purchase_id;

    RETURN purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_feature_period ON usage_tracking (user_id, feature_name, period_start);
CREATE INDEX IF NOT EXISTS idx_overage_purchases_user_feature ON overage_purchases (user_id, feature_name);