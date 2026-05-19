-- Function to manually grant/extend a subscription from the admin panel
CREATE OR REPLACE FUNCTION public.manual_grant_subscription(
    p_user_id UUID,
    p_tier TEXT,
    p_months INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_feature_limits JSONB;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Calculate end date (extend if already active, otherwise start from now)
    SELECT CASE 
        WHEN status = 'active' AND current_period_end > NOW() THEN current_period_end + (p_months || ' month')::interval
        ELSE NOW() + (p_months || ' month')::interval
    END INTO v_end_date
    FROM public.subscriptions
    WHERE user_id = p_user_id;

    -- Default if no existing subscription
    IF v_end_date IS NULL THEN
        v_end_date := NOW() + (p_months || ' month')::interval;
    END IF;

    -- Define feature limits based on tier
    IF p_tier = 'pro' THEN
        v_feature_limits := '{
          "job_applications": 100,
          "resume_generations": 50,
          "ai_interviews": 25,
          "cover_letters": 100,
          "job_matches": 500,
          "company_research": 200,
          "skill_assessments": 10
        }'::jsonb;
    ELSIF p_tier = 'enterprise' THEN
        v_feature_limits := '{
          "job_applications": -1,
          "resume_generations": -1,
          "ai_interviews": -1,
          "cover_letters": -1,
          "job_matches": -1,
          "company_research": -1,
          "skill_assessments": -1
        }'::jsonb;
    ELSE
        -- Default to free limits if tier is recognized but not pro/enterprise
        v_feature_limits := '{
          "job_applications": 5,
          "resume_generations": 3,
          "ai_interviews": 2,
          "cover_letters": 5,
          "job_matches": 20,
          "company_research": 10,
          "skill_assessments": 1
        }'::jsonb;
    END IF;

    -- Upsert subscription
    INSERT INTO public.subscriptions (
        user_id,
        tier,
        status,
        current_period_end,
        feature_limits,
        updated_at
    )
    VALUES (
        p_user_id,
        p_tier,
        'active',
        v_end_date,
        v_feature_limits,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        tier = EXCLUDED.tier,
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        feature_limits = EXCLUDED.feature_limits,
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to authenticated (but admin check should be in app)
GRANT EXECUTE ON FUNCTION public.manual_grant_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.manual_grant_subscription TO service_role;
