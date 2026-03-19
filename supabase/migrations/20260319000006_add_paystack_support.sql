-- Add support for Paystack payments and Nigerian Naira (NGN)
-- This enables dual payment processing: Stripe for international, Paystack for Nigeria

-- Add payment provider and currency columns to subscriptions
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe' CHECK (payment_provider IN ('stripe', 'paystack')),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd' CHECK (currency IN ('usd', 'ngn')),
ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT,
ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;

-- Add NGN pricing to subscription plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS price_monthly_ngn DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS price_yearly_ngn DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS paystack_plan_code TEXT,
ADD COLUMN IF NOT EXISTS paystack_plan_code_yearly TEXT;

-- Update existing plans with NGN pricing (using approximate 1600 NGN = 1 USD rate)
UPDATE subscription_plans SET
    price_monthly_ngn = CASE
        WHEN name = 'free' THEN 0.00
        WHEN name = 'pro' THEN 32000.00    -- $19.99 * 1600
        WHEN name = 'enterprise' THEN 160000.00  -- $99.99 * 1600
    END,
    price_yearly_ngn = CASE
        WHEN name = 'free' THEN 0.00
        WHEN name = 'pro' THEN 320000.00   -- $199.99 * 1600
        WHEN name = 'enterprise' THEN 1600000.00 -- $999.99 * 1600
    END,
    paystack_plan_code = CASE
        WHEN name = 'pro' THEN 'PLN_pro_monthly_ngn'
        WHEN name = 'enterprise' THEN 'PLN_enterprise_monthly_ngn'
        ELSE NULL
    END,
    paystack_plan_code_yearly = CASE
        WHEN name = 'pro' THEN 'PLN_pro_yearly_ngn'
        WHEN name = 'enterprise' THEN 'PLN_enterprise_yearly_ngn'
        ELSE NULL
    END;

-- Add NGN overage rates (converting USD rates to NGN)
UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{job_applications_ngn}',
    (CASE
        WHEN name = 'free' THEN '"3200.00"'::jsonb     -- $2.00 * 1600
        WHEN name = 'pro' THEN '"2400.00"'::jsonb      -- $1.50 * 1600
        WHEN name = 'enterprise' THEN '"1600.00"'::jsonb -- $1.00 * 1600
    END)
);

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{resume_generations_ngn}',
    (CASE
        WHEN name = 'free' THEN '"8000.00"'::jsonb     -- $5.00 * 1600
        WHEN name = 'pro' THEN '"4800.00"'::jsonb      -- $3.00 * 1600
        WHEN name = 'enterprise' THEN '"3200.00"'::jsonb -- $2.00 * 1600
    END)
);

-- Create currency-aware function to get overage rate
CREATE OR REPLACE FUNCTION get_overage_rate(
    p_user_id UUID,
    p_feature_name TEXT
) RETURNS DECIMAL AS $$
DECLARE
    user_tier TEXT;
    user_currency TEXT;
    overage_key TEXT;
    rate DECIMAL;
BEGIN
    -- Get user's subscription info
    SELECT s.tier, s.currency INTO user_tier, user_currency
    FROM subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active';

    -- Default to free plan and USD if no subscription
    IF user_tier IS NULL THEN
        user_tier := 'free';
        user_currency := 'usd';
    END IF;

    -- Determine the overage rate key based on currency
    overage_key := CASE
        WHEN user_currency = 'ngn' THEN p_feature_name || '_ngn'
        ELSE p_feature_name
    END;

    -- Get the overage rate
    SELECT (sp.overage_rates->>overage_key)::DECIMAL INTO rate
    FROM subscription_plans sp
    WHERE sp.name = user_tier;

    -- Fallback to USD rate if NGN rate not found
    IF rate IS NULL AND user_currency = 'ngn' THEN
        SELECT (sp.overage_rates->>p_feature_name)::DECIMAL * 1600 INTO rate
        FROM subscription_plans sp
        WHERE sp.name = user_tier;
    END IF;

    RETURN COALESCE(rate, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function will be updated in next migration to avoid conflicts

-- Create function to detect user location and suggest payment provider
CREATE OR REPLACE FUNCTION get_payment_provider_for_user(
    p_user_id UUID,
    p_user_country TEXT DEFAULT NULL
) RETURNS TABLE(
    provider TEXT,
    currency TEXT,
    monthly_price DECIMAL,
    yearly_price DECIMAL
) AS $$
DECLARE
    user_tier TEXT;
    plan_data RECORD;
BEGIN
    -- Get user's current tier
    SELECT s.tier INTO user_tier
    FROM subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active';

    -- Default to free plan
    IF user_tier IS NULL THEN
        user_tier := 'free';
    END IF;

    -- Get plan pricing
    SELECT * INTO plan_data
    FROM subscription_plans sp
    WHERE sp.name = user_tier;

    -- Determine provider based on country
    IF p_user_country = 'NG' OR p_user_country = 'Nigeria' THEN
        RETURN QUERY SELECT
            'paystack'::TEXT,
            'ngn'::TEXT,
            plan_data.price_monthly_ngn,
            plan_data.price_yearly_ngn;
    ELSE
        RETURN QUERY SELECT
            'stripe'::TEXT,
            'usd'::TEXT,
            plan_data.price_monthly,
            plan_data.price_yearly;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_provider ON subscriptions (payment_provider);
CREATE INDEX IF NOT EXISTS idx_subscriptions_currency ON subscriptions (currency);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paystack_customer ON subscriptions (paystack_customer_code);

-- Create Paystack webhook events table
CREATE TABLE IF NOT EXISTS paystack_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    webhook_data JSONB NOT NULL,
    paystack_event_id TEXT UNIQUE,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on new table
ALTER TABLE paystack_webhooks ENABLE ROW LEVEL SECURITY;

-- Only service role can manage webhook events
CREATE POLICY "Service role can manage paystack webhooks" ON paystack_webhooks
    FOR ALL USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON COLUMN subscriptions.payment_provider IS 'Payment processor used: stripe for international, paystack for Nigeria';
COMMENT ON COLUMN subscriptions.currency IS 'Subscription currency: usd for international, ngn for Nigeria';
COMMENT ON COLUMN subscription_plans.price_monthly_ngn IS 'Monthly price in Nigerian Naira';
COMMENT ON COLUMN subscription_plans.price_yearly_ngn IS 'Yearly price in Nigerian Naira';
COMMENT ON TABLE paystack_webhooks IS 'Stores Paystack webhook events for processing';

-- Insert Nigerian payment method information
INSERT INTO public.dropdown_options (category, option_value, display_text, sort_order) VALUES
('payment_methods', 'card_ngn', 'Debit/Credit Card (NGN)', 1),
('payment_methods', 'bank_transfer_ngn', 'Bank Transfer (NGN)', 2),
('payment_methods', 'ussd_ngn', 'USSD (NGN)', 3),
('payment_methods', 'mobile_money_ngn', 'Mobile Money (NGN)', 4),
('currencies', 'ngn', 'Nigerian Naira (₦)', 1),
('currencies', 'usd', 'US Dollar ($)', 2)
ON CONFLICT (category, option_value) DO NOTHING;