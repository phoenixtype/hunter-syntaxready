-- Insert recruiter plan rows
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, price_monthly_ngn, price_yearly_ngn, feature_limits, overage_rates)
VALUES
  ('starter', 'Recruiter Starter', 79.00, 790.00, 14999, 149990,
   '{"active_job_posts": 3, "candidate_views": 100}'::jsonb,
   '{"active_job_posts": 2.00, "candidate_views": 0.50}'::jsonb),
  ('growth', 'Recruiter Growth', 199.00, 1990.00, 34999, 349990,
   '{"active_job_posts": -1, "candidate_views": -1}'::jsonb,
   '{"active_job_posts": 0, "candidate_views": 0}'::jsonb);

-- Update existing Pro plan NGN prices (PPP-adjusted from 32000 to 4999)
UPDATE subscription_plans SET price_monthly_ngn = 4999, price_yearly_ngn = 49990
WHERE name = 'pro';

-- Update overage_rates JSONB with PPP-adjusted NGN values for all plans
UPDATE subscription_plans SET overage_rates = overage_rates || '{
  "job_applications_ngn": 500,
  "resume_generations_ngn": 1250,
  "ai_interviews_ngn": 2500,
  "cover_letters_ngn": 375,
  "job_matches_ngn": 125,
  "company_research_ngn": 250,
  "skill_assessments_ngn": 3750
}'::jsonb
WHERE name IN ('free', 'pro', 'enterprise', 'starter', 'growth');

-- Fix get_overage_rate function: replace 1600x fallback with PPP ratio (250x)
-- Must DROP first because we cannot change the parameter signature with CREATE OR REPLACE
DROP FUNCTION IF EXISTS get_overage_rate(UUID, TEXT);

CREATE FUNCTION get_overage_rate(
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

    -- Fallback: PPP ratio (250x) instead of old exchange rate (1600x)
    IF rate IS NULL AND user_currency = 'ngn' THEN
        SELECT (sp.overage_rates->>p_feature_name)::DECIMAL * 250 INTO rate
        FROM subscription_plans sp
        WHERE sp.name = user_tier;
    END IF;

    RETURN COALESCE(rate, 0);
END;
$$ LANGUAGE plpgsql STABLE;
