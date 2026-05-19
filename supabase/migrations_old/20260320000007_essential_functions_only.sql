-- Essential functions for payment value delivery system

-- Create check_feature_access function (core requirement)
DROP FUNCTION IF EXISTS check_feature_access(UUID, TEXT);

CREATE OR REPLACE FUNCTION check_feature_access(
  p_user_id UUID,
  p_feature_name TEXT
)
RETURNS TABLE(
  can_use BOOLEAN,
  current_usage INTEGER,
  limit_amount INTEGER,
  remaining_amount INTEGER,
  overage_needed INTEGER,
  overage_cost NUMERIC,
  subscription_plan TEXT,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription RECORD;
  v_usage INTEGER := 0;
  v_limit INTEGER := 0;
  v_remaining INTEGER;
BEGIN
  -- Get user's active subscription
  SELECT s.tier, s.feature_limits, s.currency, s.current_period_start
  INTO v_subscription
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
  LIMIT 1;

  -- Default to free tier if no subscription found
  IF v_subscription IS NULL THEN
    v_subscription.tier := 'free';
    v_subscription.feature_limits := '{"job_applications": 3, "resume_generations": 1, "ai_interviews": 0, "cover_letters": 1, "job_matches": 5, "company_research": 2, "skill_assessments": 0}';
    v_subscription.currency := 'usd';
    v_subscription.current_period_start := DATE_TRUNC('month', NOW());
  END IF;

  -- Get current usage for this billing period
  SELECT COALESCE(SUM(usage_count), 0)
  INTO v_usage
  FROM subscription_usage
  WHERE user_id = p_user_id
    AND feature_name = p_feature_name
    AND period_start >= COALESCE(v_subscription.current_period_start, DATE_TRUNC('month', NOW()));

  -- Get feature limit from subscription
  v_limit := COALESCE((v_subscription.feature_limits ->> p_feature_name)::INTEGER, 0);

  -- Calculate remaining usage
  v_remaining := GREATEST(0, v_limit - v_usage);

  RETURN QUERY SELECT
    v_remaining > 0 OR v_limit = -1, -- can_use
    v_usage, -- current_usage
    CASE WHEN v_limit = -1 THEN 999999 ELSE v_limit END, -- limit_amount
    CASE WHEN v_limit = -1 THEN 999999 ELSE v_remaining END, -- remaining_amount
    CASE WHEN v_remaining <= 0 AND v_limit != -1 THEN 1 ELSE 0 END, -- overage_needed
    0::NUMERIC, -- overage_cost (simplified)
    v_subscription.tier, -- subscription_plan
    COALESCE(v_subscription.currency, 'usd') -- currency
  ;
END;
$$;

-- Create get_usage_overview function (for dashboard)
DROP FUNCTION IF EXISTS get_usage_overview(UUID);

CREATE OR REPLACE FUNCTION get_usage_overview(p_user_id UUID)
RETURNS TABLE(
  plan_name TEXT,
  plan_display_name TEXT,
  feature_name TEXT,
  display_name TEXT,
  current_usage INTEGER,
  limit_amount INTEGER,
  remaining_amount INTEGER,
  usage_percentage NUMERIC,
  overage_credits INTEGER,
  can_use BOOLEAN,
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription RECORD;
  v_feature TEXT;
  v_features TEXT[] := ARRAY['job_applications', 'resume_generations', 'ai_interviews', 'cover_letters', 'job_matches', 'company_research', 'skill_assessments'];
  v_display_names JSONB := '{"job_applications": "Job Applications", "resume_generations": "Resume Generations", "ai_interviews": "AI Interview Practice", "cover_letters": "Cover Letters", "job_matches": "Job Matches", "company_research": "Company Research", "skill_assessments": "Skill Assessments"}';
BEGIN
  -- Get user's subscription info
  SELECT s.tier as plan_name,
         CASE s.tier
           WHEN 'free' THEN 'Hunter Free'
           WHEN 'pro' THEN 'Hunter Pro'
           WHEN 'enterprise' THEN 'Hunter Enterprise'
           ELSE 'Unknown'
         END as plan_display_name,
         s.feature_limits,
         s.current_period_start,
         CASE
           WHEN s.current_period_end IS NOT NULL THEN s.current_period_end
           ELSE s.current_period_start + INTERVAL '1 month'
         END as current_period_end
  INTO v_subscription
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
  LIMIT 1;

  -- Default to free plan if no subscription
  IF v_subscription IS NULL THEN
    v_subscription.plan_name := 'free';
    v_subscription.plan_display_name := 'Hunter Free';
    v_subscription.feature_limits := '{"job_applications": 3, "resume_generations": 1, "ai_interviews": 0, "cover_letters": 1, "job_matches": 5, "company_research": 2, "skill_assessments": 0}';
    v_subscription.current_period_start := DATE_TRUNC('month', NOW());
    v_subscription.current_period_end := DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
  END IF;

  -- Return overview for each feature
  FOREACH v_feature IN ARRAY v_features LOOP
    DECLARE
      v_usage INTEGER := 0;
      v_limit INTEGER;
    BEGIN
      -- Get current usage
      SELECT COALESCE(SUM(usage_count), 0)
      INTO v_usage
      FROM subscription_usage
      WHERE user_id = p_user_id
        AND feature_name = v_feature
        AND period_start >= v_subscription.current_period_start;

      -- Get limit
      v_limit := COALESCE((v_subscription.feature_limits ->> v_feature)::INTEGER, 0);

      RETURN QUERY SELECT
        v_subscription.plan_name,
        v_subscription.plan_display_name,
        v_feature,
        (v_display_names ->> v_feature)::TEXT,
        v_usage,
        CASE WHEN v_limit = -1 THEN 999999 ELSE v_limit END,
        CASE WHEN v_limit = -1 THEN 999999 ELSE GREATEST(0, v_limit - v_usage) END,
        CASE
          WHEN v_limit = -1 THEN 0
          WHEN v_limit = 0 THEN 0
          ELSE ROUND((v_usage::NUMERIC / v_limit::NUMERIC) * 100, 1)
        END,
        0, -- overage_credits (simplified)
        GREATEST(0, v_limit - v_usage) > 0 OR v_limit = -1,
        v_subscription.current_period_start,
        v_subscription.current_period_end;
    END;
  END LOOP;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION check_feature_access(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_usage_overview(UUID) TO anon, authenticated, service_role;

-- Add comments for tracking
COMMENT ON FUNCTION check_feature_access IS 'Payment value delivery system - essential feature access control';
COMMENT ON FUNCTION get_usage_overview IS 'Payment value delivery system - essential usage overview';