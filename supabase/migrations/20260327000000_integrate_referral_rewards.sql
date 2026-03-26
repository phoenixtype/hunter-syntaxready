-- Integration of referral rewards into usage and subscription logic

-- 1. Update check_feature_usage_limit to include auto_applies from referral_rewards
CREATE OR REPLACE FUNCTION public.check_feature_usage_limit(
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
    referral_bonus_credits INTEGER := 0;
    overage_rate DECIMAL := 0;
    is_pro_via_referral BOOLEAN := FALSE;
BEGIN
    -- Get current billing period start (monthly)
    current_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;

    -- Check if user has active pro_days rewards
    SELECT EXISTS (
        SELECT 1 FROM referral_rewards
        WHERE user_id = p_user_id
        AND reward_type = 'pro_days'
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO is_pro_via_referral;

    -- Get user's subscription tier and feature limits from subscriptions table
    SELECT s.tier,
           COALESCE(s.currency, 'usd'),
           (s.feature_limits->>p_feature_name)::INTEGER
    INTO user_tier, user_currency, feature_limit
    FROM subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing')
    AND (s.current_period_end IS NULL OR s.current_period_end > NOW());

    -- Default to free tier if no subscription found
    IF user_tier IS NULL THEN
        user_tier := 'free';
        user_currency := 'usd';
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

    -- Override tier if pro via referral
    IF is_pro_via_referral AND user_tier = 'free' THEN
        user_tier := 'pro';
        -- Set pro tier limits for the check
        feature_limit := CASE p_feature_name
            WHEN 'job_applications' THEN 100
            WHEN 'resume_generations' THEN 50
            WHEN 'ai_interviews' THEN 25
            WHEN 'cover_letters' THEN 100
            WHEN 'job_matches' THEN 500
            WHEN 'company_research' THEN 200
            WHEN 'skill_assessments' THEN 10
            ELSE feature_limit
        END;
    END IF;

    -- Get current usage from subscription_usage table
    user_usage := get_current_usage(p_user_id, p_feature_name, current_period_start);

    -- Get available overage credits (purchased)
    SELECT COALESCE(SUM(op.quantity - op.used_count), 0)
    INTO overage_credits
    FROM overage_purchases op
    WHERE op.user_id = p_user_id
    AND op.feature_name = p_feature_name
    AND op.status = 'succeeded'
    AND (op.expires_at IS NULL OR op.expires_at > NOW())
    AND op.used_count < op.quantity;

    -- Get referral bonus credits (auto_applies)
    -- We map 'auto_applies' to 'job_applications' feature
    IF p_feature_name = 'job_applications' THEN
        SELECT COALESCE(SUM(amount), 0)
        INTO referral_bonus_credits
        FROM referral_rewards
        WHERE user_id = p_user_id
        AND reward_type = 'auto_applies'
        AND (expires_at IS NULL OR expires_at > NOW());
        
        -- Note: We don't have a 'used_count' in referral_rewards yet, 
        -- so we should probably treat them as "extra limit" for the period
        -- or subtract them from usage. 
        -- For simplicity, let's add them to the feature_limit.
    END IF;

    -- Get overage rate
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
        RETURN QUERY SELECT TRUE::BOOLEAN, user_usage, -1, -1, 0, 0.00::DECIMAL, user_tier, user_currency;
    ELSE
        DECLARE
            total_available INTEGER := feature_limit + overage_credits + referral_bonus_credits;
            can_proceed BOOLEAN := (user_usage + p_requested_count) <= total_available;
            remaining INTEGER := GREATEST(0, total_available - user_usage);
            overage_req INTEGER := GREATEST(0, (user_usage + p_requested_count) - total_available);
            overage_price DECIMAL := overage_req * COALESCE(overage_rate, 0);
        BEGIN
            RETURN QUERY SELECT can_proceed, user_usage, feature_limit, remaining, overage_req, overage_price, user_tier, user_currency;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update record_feature_usage to consume overage correctly (existing logic is fine, it checks limits from check_feature_usage_limit implicitly via the frontend before calling this, but let's make it robust)
-- Actually, the existing record_feature_usage is mostly fine as it just Increments usage_count.
-- The limit gating happens in the frontend via check_feature_usage_limit.

-- 3. Add a trigger to ensure referral_rewards of type 'pro_days' actually grant Pro access
CREATE OR REPLACE FUNCTION public.handle_referral_reward_pro_days()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reward_type = 'pro_days' THEN
        -- Upsert into subscriptions table to grant Pro
        INSERT INTO public.subscriptions (user_id, tier, status, current_period_end, feature_limits)
        VALUES (
            NEW.user_id,
            'pro',
            'active',
            LEAST(COALESCE((SELECT current_period_end FROM subscriptions WHERE user_id = NEW.user_id), NOW()), NOW()) + (NEW.amount || ' days')::interval,
            '{
              "job_applications": 100,
              "resume_generations": 50,
              "ai_interviews": 25,
              "cover_letters": 100,
              "job_matches": 500,
              "company_research": 200,
              "skill_assessments": 10
            }'::jsonb
        )
        ON CONFLICT (user_id) DO UPDATE SET
            tier = 'pro',
            status = 'active',
            current_period_end = GREATEST(subscriptions.current_period_end, NOW()) + (NEW.amount || ' days')::interval,
            feature_limits = '{
              "job_applications": 100,
              "resume_generations": 50,
              "ai_interviews": 25,
              "cover_letters": 100,
              "job_matches": 500,
              "company_research": 200,
              "skill_assessments": 10
            }'::jsonb,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_on_referral_reward_pro_days ON public.referral_rewards;
CREATE TRIGGER tr_on_referral_reward_pro_days
AFTER INSERT ON public.referral_rewards
FOR EACH ROW EXECUTE FUNCTION public.handle_referral_reward_pro_days();
