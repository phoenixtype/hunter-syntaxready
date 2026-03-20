


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_feature_usage_limit"("p_user_id" "uuid", "p_feature_name" "text", "p_requested_count" integer DEFAULT 1) RETURNS TABLE("can_use" boolean, "current_usage" integer, "limit_amount" integer, "remaining_amount" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_tier TEXT;
    feature_limit INTEGER;
    current_usage_count INTEGER;
BEGIN
    -- Get user's subscription tier and limits from subscriptions table
    SELECT s.tier, (s.feature_limits->>p_feature_name)::INTEGER
    INTO user_tier, feature_limit
    FROM subscriptions s
    WHERE s.user_id = p_user_id AND s.status = 'active';

    -- Default to free tier if no subscription found
    IF user_tier IS NULL THEN
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

    -- Get current usage
    SELECT COALESCE(su.usage_count, 0) INTO current_usage_count
    FROM subscription_usage su
    WHERE su.user_id = p_user_id
    AND su.feature_name = p_feature_name
    AND su.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE;

    -- Return results
    RETURN QUERY SELECT
        CASE
            WHEN feature_limit = -1 THEN TRUE  -- Unlimited
            WHEN current_usage_count + p_requested_count <= feature_limit THEN TRUE
            ELSE FALSE
        END as can_use,
        current_usage_count as current_usage,
        feature_limit as limit_amount,
        CASE
            WHEN feature_limit = -1 THEN -1
            ELSE GREATEST(0, feature_limit - current_usage_count)
        END as remaining_amount;
END;
$$;


ALTER FUNCTION "public"."check_feature_usage_limit"("p_user_id" "uuid", "p_feature_name" "text", "p_requested_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_feature_usage_limit"("p_user_id" "uuid", "p_feature_name" "text", "p_requested_count" integer) IS 'Checks feature usage limits returning simplified table structure for frontend compatibility';



CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_function_name" "text", "p_max_requests" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_count INTEGER := 0;
    window_boundary TIMESTAMP WITH TIME ZONE;
    existing_record RECORD;
BEGIN
    -- Calculate window boundary (requests older than this are expired)
    window_boundary := NOW() - INTERVAL '1 second' * p_window_seconds;

    -- Get existing record for this user and function within the current window
    SELECT * INTO existing_record
    FROM rate_limits
    WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND window_start > window_boundary  -- Fixed: compare record timestamp to calculated boundary
    ORDER BY window_start DESC
    LIMIT 1;

    -- If no recent record or window has expired, start a new window
    IF existing_record IS NULL THEN
        INSERT INTO rate_limits (user_id, function_name, request_count, window_start)
        VALUES (p_user_id, p_function_name, 1, NOW())
        ON CONFLICT (user_id, function_name)
        DO UPDATE SET
            request_count = 1,
            window_start = NOW(),
            updated_at = NOW();

        RETURN TRUE;
    END IF;

    -- Check if under limit
    current_count := existing_record.request_count;

    IF current_count >= p_max_requests THEN
        RETURN FALSE;
    END IF;

    -- Increment counter
    UPDATE rate_limits
    SET request_count = request_count + 1,
        updated_at = NOW()
    WHERE id = existing_record.id;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and block request for safety
        RAISE LOG 'Rate limit check failed for user % function %: %', p_user_id, p_function_name, SQLERRM;
        RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_function_name" "text", "p_max_requests" integer, "p_window_seconds" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_function_name" "text", "p_max_requests" integer, "p_window_seconds" integer) IS 'Fixed rate limiting function for Edge Functions. Returns true if request is allowed, false if rate limited. Handles sliding window correctly.';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_rate_limits"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.rate_limit_buckets 
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_period_start" "date" DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_current_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_period_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feature_usage"("p_user_id" "uuid", "p_feature_name" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  usage_count INTEGER := 0;
BEGIN
  SELECT COALESCE(usage_count, 0) INTO usage_count
  FROM subscription_usage
  WHERE user_id = p_user_id
  AND feature_name = p_feature_name
  AND period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE;

  RETURN usage_count;
END;
$$;


ALTER FUNCTION "public"."get_feature_usage"("p_user_id" "uuid", "p_feature_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_overage_rate"("p_user_id" "uuid", "p_feature_name" "text") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_overage_rate"("p_user_id" "uuid", "p_feature_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_payment_provider_for_user"("p_user_id" "uuid", "p_user_country" "text" DEFAULT NULL::"text") RETURNS TABLE("provider" "text", "currency" "text", "monthly_price" numeric, "yearly_price" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_payment_provider_for_user"("p_user_id" "uuid", "p_user_country" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_analytics"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'total_applications', (SELECT count(*) FROM public.application_history),
    'total_resumes', (SELECT count(*) FROM public.candidate_profiles),
    'total_jobs', (SELECT count(*) FROM public.job_listings),
    'applications_by_status', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'count', cnt)), '[]'::jsonb)
      FROM (
        SELECT COALESCE(status, 'unknown') as status, count(*) as cnt
        FROM public.application_history
        GROUP BY status
      ) s
    )
  ) INTO result;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_platform_analytics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_recruiter_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- When a user's role is set to 'recruiter', create a stub recruiter_profile
  IF NEW.role = 'recruiter' AND (OLD.role IS NULL OR OLD.role <> 'recruiter') THEN
    INSERT INTO public.recruiter_profiles (user_id, company_name)
    VALUES (NEW.id, COALESCE(NEW.full_name, 'My Company'))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_recruiter_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'candidate')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    role  = CASE
              WHEN public.profiles.role IS NULL THEN EXCLUDED.role
              ELSE public.profiles.role
            END;

  INSERT INTO public.user_preferences (
    user_id,
    require_sponsorship,
    has_clearance,
    notice_period_days,
    email_alerts_enabled,
    sms_alerts_enabled
  )
  VALUES (new.id, false, false, 14, false, false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_mirror"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Insert into users table with correct columns
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, new.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_mirror"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, notification_email)
  VALUES (new.id, new.email)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user_notifications failed for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_recruiter_job_application_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.recruiter_jobs
  SET application_count = application_count + 1
  WHERE id = NEW.recruiter_job_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_recruiter_job_application_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_root_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND role = 'root'
  );
$$;


ALTER FUNCTION "public"."is_root_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_dei_preferences"("candidate_profile_id" "uuid", "job_listing_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    candidate_preferences JSONB;
    job_features RECORD;
    compatibility_score DECIMAL := 0;
    total_factors INTEGER := 0;
BEGIN
    -- Get candidate DEI preferences
    SELECT dei_preferences INTO candidate_preferences
    FROM candidate_profiles
    WHERE id = candidate_profile_id;

    -- Get job DEI features
    SELECT
        accessibility_support,
        inclusive_benefits,
        diversity_rating,
        pay_equity_certified,
        remote_work_accessibility,
        mentorship_programs
    INTO job_features
    FROM job_listings
    WHERE id = job_listing_id;

    -- Check accessibility support alignment
    IF candidate_preferences ? 'accessibility_needs' AND job_features.accessibility_support IS NOT NULL THEN
        total_factors := total_factors + 1;
        IF job_features.accessibility_support && ARRAY(SELECT jsonb_array_elements_text(candidate_preferences->'accessibility_needs')) THEN
            compatibility_score := compatibility_score + 1;
        END IF;
    END IF;

    -- Check inclusive benefits preference
    IF candidate_preferences ? 'values_inclusion' AND (candidate_preferences->>'values_inclusion')::BOOLEAN = TRUE THEN
        total_factors := total_factors + 1;
        IF job_features.inclusive_benefits IS NOT NULL AND array_length(job_features.inclusive_benefits, 1) > 0 THEN
            compatibility_score := compatibility_score + 1;
        END IF;
    END IF;

    -- Check diversity rating preference
    IF candidate_preferences ? 'min_diversity_rating' THEN
        total_factors := total_factors + 1;
        IF job_features.diversity_rating >= (candidate_preferences->>'min_diversity_rating')::DECIMAL THEN
            compatibility_score := compatibility_score + 1;
        END IF;
    END IF;

    -- Check remote work accessibility
    IF candidate_preferences ? 'requires_remote_accessibility' AND (candidate_preferences->>'requires_remote_accessibility')::BOOLEAN = TRUE THEN
        total_factors := total_factors + 1;
        IF job_features.remote_work_accessibility = TRUE THEN
            compatibility_score := compatibility_score + 1;
        END IF;
    END IF;

    -- Check mentorship preference
    IF candidate_preferences ? 'seeks_mentorship' AND (candidate_preferences->>'seeks_mentorship')::BOOLEAN = TRUE THEN
        total_factors := total_factors + 1;
        IF job_features.mentorship_programs = TRUE THEN
            compatibility_score := compatibility_score + 1;
        END IF;
    END IF;

    -- Return compatibility percentage
    IF total_factors > 0 THEN
        RETURN (compatibility_score / total_factors) * 100;
    ELSE
        RETURN 50; -- Neutral score when no DEI preferences specified
    END IF;
END;
$$;


ALTER FUNCTION "public"."match_dei_preferences"("candidate_profile_id" "uuid", "job_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_overage_credits"("p_user_id" "uuid", "p_feature_name" "text", "p_quantity" integer, "p_payment_intent_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."purchase_overage_credits"("p_user_id" "uuid", "p_feature_name" "text", "p_quantity" integer, "p_payment_intent_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."purchase_overage_credits"("p_user_id" "uuid", "p_feature_name" "text", "p_quantity" integer, "p_payment_intent_id" "text") IS 'Creates overage credit purchase record';



CREATE OR REPLACE FUNCTION "public"."record_feature_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_usage_count" integer DEFAULT 1, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO subscription_usage (
        user_id,
        feature_name,
        usage_count,
        period_start,
        period_end
    ) VALUES (
        p_user_id,
        p_feature_name,
        p_usage_count,
        DATE_TRUNC('month', CURRENT_DATE)::DATE,
        (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
    )
    ON CONFLICT (user_id, feature_name, period_start)
    DO UPDATE SET
        usage_count = subscription_usage.usage_count + p_usage_count,
        updated_at = NOW();

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."record_feature_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_usage_count" integer, "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_feature_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_usage_count" integer, "p_metadata" "jsonb") IS 'Records feature usage with correct parameter names (p_usage_count, p_metadata) to match frontend expectations';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accessibility_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "job_application_id" "uuid",
    "request_type" "text" NOT NULL,
    "accommodation_details" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "employer_response" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "accessibility_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'in_progress'::"text", 'completed'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."accessibility_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "agent" "text" NOT NULL,
    "action" "text" NOT NULL,
    "details" "text",
    "log_type" "text" DEFAULT 'info'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_activity_logs_log_type_check" CHECK (("log_type" = ANY (ARRAY['info'::"text", 'success'::"text", 'warning'::"text", 'error'::"text", 'action'::"text"])))
);


ALTER TABLE "public"."agent_activity_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_activity_logs" IS 'Activity logs with RLS. Users can only see their own logs. System logs (NULL user_id) are only accessible via service role for security.';



CREATE TABLE IF NOT EXISTS "public"."application_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "job_title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "job_url" "text",
    "status" "text" DEFAULT 'applied'::"text",
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "application_history_status_check" CHECK (("status" = ANY (ARRAY['applied'::"text", 'pending'::"text", 'screening'::"text", 'interview'::"text", 'offer'::"text", 'accepted'::"text", 'rejected'::"text", 'declined'::"text", 'withdrawn'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."application_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity" "jsonb" DEFAULT '{"name": "", "email": "", "links": []}'::"jsonb" NOT NULL,
    "skills" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "experience_atoms" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "education" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "raw_resume_text" "text",
    "resume_file_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "age" integer,
    "gender" "text",
    "ethnicity" "text"[],
    "pronouns" "text",
    "disability_status" "text",
    "accessibility_accommodations" "text"[],
    "veteran_status" boolean DEFAULT false,
    "first_generation_college" boolean DEFAULT false,
    "primary_language" "text" DEFAULT 'English'::"text",
    "visa_sponsorship_required" boolean DEFAULT false,
    "religious_accommodations" "text"[],
    "socioeconomic_background" "text",
    "dei_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "privacy_settings" "jsonb" DEFAULT '{"share_demographics": false, "share_veteran_status": false, "share_disability_status": false}'::"jsonb"
);


ALTER TABLE "public"."candidate_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."candidate_profiles"."ethnicity" IS 'Array of ethnic identities - supports multiple selections';



COMMENT ON COLUMN "public"."candidate_profiles"."accessibility_accommodations" IS 'Array of needed accommodations';



COMMENT ON COLUMN "public"."candidate_profiles"."dei_preferences" IS 'JSON object storing DEI-related preferences and settings';



COMMENT ON COLUMN "public"."candidate_profiles"."privacy_settings" IS 'JSON object controlling which demographic data to share';



CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "website" "text",
    "size_range" "text",
    "industry" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "hour_bucket" timestamp with time zone NOT NULL,
    "action_count" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "compliance_metrics_action_type_check" CHECK (("action_type" = ANY (ARRAY['APPLY'::"text", 'SCRAPE'::"text"])))
);


ALTER TABLE "public"."compliance_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diversity_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid",
    "metric_name" "text" NOT NULL,
    "metric_value" numeric,
    "metric_category" "text" NOT NULL,
    "reporting_period" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."diversity_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dropdown_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "option_value" "text" NOT NULL,
    "display_text" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dropdown_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "job_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_actions_action_check" CHECK (("action" = ANY (ARRAY['DISMISS'::"text", 'APPLY'::"text", 'VIEW'::"text", 'SAVE'::"text"])))
);


ALTER TABLE "public"."feedback_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "job_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "location" "text",
    "salary_range" "text",
    "description" "text",
    "source" "text" DEFAULT 'Firecrawl'::"text" NOT NULL,
    "freshness_score" numeric(3,2) DEFAULT 1.0,
    "credibility_score" numeric(3,2) DEFAULT 0.8,
    "url" "text" NOT NULL,
    "posted_at" "text",
    "tech_stack" "text"[],
    "job_hash" "text" NOT NULL,
    "raw_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dei_commitment" "text",
    "accessibility_support" "text"[],
    "inclusive_benefits" "text"[],
    "diversity_rating" numeric(2,1),
    "pay_equity_certified" boolean DEFAULT false,
    "remote_work_accessibility" boolean DEFAULT false,
    "mentorship_programs" boolean DEFAULT false,
    "eeo_statement" "text",
    "accommodation_statement" "text" DEFAULT 'We provide reasonable accommodations for qualified individuals with disabilities.'::"text",
    "preferred_pronouns_respected" boolean DEFAULT true,
    "experience_level" "text",
    "job_type" "text" DEFAULT 'full-time'::"text",
    "salary_min" integer,
    "salary_max" integer,
    "remote" boolean DEFAULT false,
    CONSTRAINT "job_listings_diversity_rating_check" CHECK ((("diversity_rating" >= 1.0) AND ("diversity_rating" <= 5.0)))
);


ALTER TABLE "public"."job_listings" OWNER TO "postgres";


COMMENT ON TABLE "public"."job_listings" IS 'Public job listings - intentionally readable by all users. Write access restricted to authenticated edge functions.';



COMMENT ON COLUMN "public"."job_listings"."accessibility_support" IS 'Array of accessibility features the company provides';



COMMENT ON COLUMN "public"."job_listings"."inclusive_benefits" IS 'Array of inclusive benefits offered';



COMMENT ON COLUMN "public"."job_listings"."diversity_rating" IS 'Company diversity rating from 1.0 to 5.0';



CREATE TABLE IF NOT EXISTS "public"."learning_weights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "skill_weight" numeric(3,2) DEFAULT 0.6,
    "culture_weight" numeric(3,2) DEFAULT 0.2,
    "freshness_weight" numeric(3,2) DEFAULT 0.2,
    "banned_companies" "text"[] DEFAULT '{}'::"text"[],
    "preferred_skills" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."learning_weights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_enabled" boolean DEFAULT true NOT NULL,
    "sms_enabled" boolean DEFAULT false NOT NULL,
    "phone_number" "text",
    "notification_email" "text",
    "job_alerts" boolean DEFAULT true NOT NULL,
    "application_updates" boolean DEFAULT true NOT NULL,
    "weekly_digest" boolean DEFAULT true NOT NULL,
    "alert_frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."overage_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_name" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "stripe_payment_intent_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "used_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "overage_purchases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'succeeded'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."overage_purchases" OWNER TO "postgres";


COMMENT ON TABLE "public"."overage_purchases" IS 'Tracks overage credit purchases and usage';



CREATE TABLE IF NOT EXISTS "public"."paystack_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "webhook_data" "jsonb" NOT NULL,
    "paystack_event_id" "text",
    "processed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."paystack_webhooks" OWNER TO "postgres";


COMMENT ON TABLE "public"."paystack_webhooks" IS 'Stores Paystack webhook events for processing';



CREATE TABLE IF NOT EXISTS "public"."platform_admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "platform_admins_role_check" CHECK (("role" = ANY (ARRAY['root'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."platform_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'candidate'::"text" NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['candidate'::"text", 'recruiter'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_buckets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "function_name" "text" NOT NULL,
    "request_count" integer DEFAULT 1 NOT NULL,
    "window_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limit_buckets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "user_id" "uuid" NOT NULL,
    "function_name" "text" NOT NULL,
    "request_count" integer DEFAULT 1,
    "window_start" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "company_website" "text",
    "job_title" "text" NOT NULL,
    "company_size" "text",
    "use_case" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recruiter_applications_company_size_check" CHECK (("company_size" = ANY (ARRAY['1-10'::"text", '11-50'::"text", '51-200'::"text", '201-500'::"text", '501-1000'::"text", '1000+'::"text"]))),
    CONSTRAINT "recruiter_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."recruiter_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_job_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "application_history_id" "uuid",
    "match_score" numeric(5,2),
    "cover_letter" "text",
    "resume_snapshot" "jsonb",
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "recruiter_notes" "text",
    "is_auto_applied" boolean DEFAULT false NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recruiter_job_applications_match_score_check" CHECK ((("match_score" >= (0)::numeric) AND ("match_score" <= (100)::numeric))),
    CONSTRAINT "recruiter_job_applications_status_check" CHECK (("status" = ANY (ARRAY['applied'::"text", 'screening'::"text", 'interview'::"text", 'offer'::"text", 'accepted'::"text", 'rejected'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."recruiter_job_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "job_listing_id" "uuid",
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "location" "text",
    "location_type" "text" DEFAULT 'hybrid'::"text" NOT NULL,
    "employment_type" "text" DEFAULT 'full_time'::"text" NOT NULL,
    "salary_min" integer,
    "salary_max" integer,
    "salary_currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "requirements" "text",
    "responsibilities" "text",
    "benefits" "text",
    "tech_stack" "text"[],
    "experience_level" "text",
    "visa_sponsorship" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "application_deadline" timestamp with time zone,
    "application_count" integer DEFAULT 0 NOT NULL,
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "max_applicants" integer,
    CONSTRAINT "recruiter_jobs_employment_type_check" CHECK (("employment_type" = ANY (ARRAY['full_time'::"text", 'part_time'::"text", 'contract'::"text", 'internship'::"text", 'freelance'::"text"]))),
    CONSTRAINT "recruiter_jobs_experience_level_check" CHECK (("experience_level" = ANY (ARRAY['entry'::"text", 'junior'::"text", 'mid'::"text", 'senior'::"text", 'lead'::"text", 'principal'::"text", 'executive'::"text"]))),
    CONSTRAINT "recruiter_jobs_location_type_check" CHECK (("location_type" = ANY (ARRAY['remote'::"text", 'hybrid'::"text", 'onsite'::"text"]))),
    CONSTRAINT "recruiter_jobs_max_applicants_check" CHECK ((("max_applicants" IS NULL) OR ("max_applicants" > 0))),
    CONSTRAINT "recruiter_jobs_salary_max_check" CHECK (("salary_max" >= 0)),
    CONSTRAINT "recruiter_jobs_salary_min_check" CHECK (("salary_min" >= 0)),
    CONSTRAINT "recruiter_jobs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'closed'::"text", 'filled'::"text"])))
);


ALTER TABLE "public"."recruiter_jobs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."recruiter_jobs"."max_applicants" IS 'Maximum number of applicants to shortlist. NULL means no cap. Auto-apply respects this limit by only inserting the top-scoring candidates.';



CREATE TABLE IF NOT EXISTS "public"."recruiter_outreach" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "recruiter_job_id" "uuid",
    "outreach_type" "text" DEFAULT 'email'::"text" NOT NULL,
    "subject" "text",
    "message" "text",
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recruiter_outreach_outreach_type_check" CHECK (("outreach_type" = ANY (ARRAY['email'::"text", 'invite'::"text"]))),
    CONSTRAINT "recruiter_outreach_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'opened'::"text", 'replied'::"text"])))
);


ALTER TABLE "public"."recruiter_outreach" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "company_website" "text",
    "company_logo_url" "text",
    "company_size" "text",
    "industry" "text",
    "headquarters" "text",
    "about" "text",
    "linkedin_url" "text",
    "is_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recruiter_profiles_company_size_check" CHECK (("company_size" = ANY (ARRAY['1-10'::"text", '11-50'::"text", '51-200'::"text", '201-500'::"text", '501-1000'::"text", '1001-5000'::"text", '5000+'::"text"])))
);


ALTER TABLE "public"."recruiter_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "price_monthly" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "price_yearly" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "stripe_price_id" "text",
    "stripe_price_id_yearly" "text",
    "feature_limits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "overage_rates" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "price_monthly_ngn" numeric(10,2) DEFAULT 0.00,
    "price_yearly_ngn" numeric(10,2) DEFAULT 0.00,
    "paystack_plan_code" "text",
    "paystack_plan_code_yearly" "text"
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_plans" IS 'Defines available subscription tiers and their feature limits';



COMMENT ON COLUMN "public"."subscription_plans"."price_monthly_ngn" IS 'Monthly price in Nigerian Naira';



COMMENT ON COLUMN "public"."subscription_plans"."price_yearly_ngn" IS 'Yearly price in Nigerian Naira';



CREATE TABLE IF NOT EXISTS "public"."subscription_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_name" "text" NOT NULL,
    "usage_count" integer DEFAULT 0,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_provider" "text" DEFAULT 'stripe'::"text",
    "currency" "text" DEFAULT 'usd'::"text",
    "paystack_subscription_code" "text",
    "paystack_customer_code" "text",
    "feature_limits" "jsonb" DEFAULT '{"job_matches": -1, "ai_interviews": -1, "cover_letters": -1, "company_research": -1, "job_applications": -1, "skill_assessments": -1, "resume_generations": -1}'::"jsonb",
    CONSTRAINT "subscriptions_currency_check" CHECK (("currency" = ANY (ARRAY['usd'::"text", 'ngn'::"text"]))),
    CONSTRAINT "subscriptions_payment_provider_check" CHECK (("payment_provider" = ANY (ARRAY['stripe'::"text", 'paystack'::"text"]))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'past_due'::"text", 'canceled'::"text", 'incomplete'::"text", 'incomplete_expired'::"text", 'unpaid'::"text", 'paused'::"text"]))),
    CONSTRAINT "subscriptions_tier_check" CHECK (("tier" = ANY (ARRAY['free'::"text", 'pro'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscriptions"."payment_provider" IS 'Payment processor used: stripe for international, paystack for Nigeria';



COMMENT ON COLUMN "public"."subscriptions"."currency" IS 'Subscription currency: usd for international, ngn for Nigeria';



CREATE TABLE IF NOT EXISTS "public"."subscriptions_backup" (
    "id" "uuid",
    "user_id" "uuid",
    "tier" "text",
    "status" "text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "payment_provider" "text",
    "currency" "text",
    "paystack_subscription_code" "text",
    "paystack_customer_code" "text"
);


ALTER TABLE "public"."subscriptions_backup" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscriptions_backup" IS 'Backup of subscriptions table before migration on 2026-03-20';



CREATE TABLE IF NOT EXISTS "public"."tailored_resumes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "job_url" "text",
    "cover_letter" "text" DEFAULT ''::"text" NOT NULL,
    "changes_summary" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "tailored_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tailored_resumes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_name" "text" NOT NULL,
    "alert_threshold" integer NOT NULL,
    "alert_type" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "acknowledged" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "usage_alerts_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['warning'::"text", 'limit_reached'::"text", 'overage'::"text"])))
);


ALTER TABLE "public"."usage_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_name" "text" NOT NULL,
    "usage_count" integer DEFAULT 1 NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usage_tracking" OWNER TO "postgres";


COMMENT ON TABLE "public"."usage_tracking" IS 'Records feature usage per user per billing period';



CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_roles" "text"[] DEFAULT '{}'::"text"[],
    "min_salary_usd" integer DEFAULT 100000,
    "locations" "text"[] DEFAULT '{}'::"text"[],
    "remote_policy" "text" DEFAULT 'any'::"text",
    "aggressiveness" integer DEFAULT 5,
    "safe_mode" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "experience_level" "text" DEFAULT 'mid'::"text",
    "search_intent" "text" DEFAULT 'active'::"text",
    "alert_frequency" "text" DEFAULT 'daily'::"text",
    "require_sponsorship" boolean DEFAULT false,
    "has_clearance" boolean DEFAULT false,
    "notice_period_days" integer DEFAULT 14,
    "email_alerts_enabled" boolean DEFAULT false,
    "sms_alerts_enabled" boolean DEFAULT false,
    "tracker_view" "text" DEFAULT 'list'::"text",
    "auto_apply_enabled" boolean DEFAULT false NOT NULL,
    "auto_apply_min_match_score" integer DEFAULT 80 NOT NULL,
    CONSTRAINT "user_preferences_aggressiveness_check" CHECK ((("aggressiveness" >= 1) AND ("aggressiveness" <= 10))),
    CONSTRAINT "user_preferences_alert_frequency_check" CHECK (("alert_frequency" = ANY (ARRAY['instant'::"text", 'daily'::"text", 'weekly'::"text", 'off'::"text"]))),
    CONSTRAINT "user_preferences_experience_level_check" CHECK (("experience_level" = ANY (ARRAY['entry'::"text", 'mid'::"text", 'senior'::"text", 'lead'::"text", 'executive'::"text"]))),
    CONSTRAINT "user_preferences_remote_policy_check" CHECK (("remote_policy" = ANY (ARRAY['remote'::"text", 'hybrid'::"text", 'onsite'::"text", 'any'::"text"]))),
    CONSTRAINT "user_preferences_search_intent_check" CHECK (("search_intent" = ANY (ARRAY['active'::"text", 'passive'::"text", 'exploring'::"text"]))),
    CONSTRAINT "user_preferences_tracker_view_check" CHECK (("tracker_view" = ANY (ARRAY['board'::"text", 'list'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "current_period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_customer_id" "text",
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'expired'::"text", 'past_due'::"text"])))
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_subscriptions" IS 'Tracks active user subscriptions';



CREATE TABLE IF NOT EXISTS "public"."user_subscriptions_backup" (
    "id" "uuid",
    "user_id" "uuid",
    "plan_id" "uuid",
    "status" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "stripe_subscription_id" "text",
    "stripe_customer_id" "text",
    "cancel_at_period_end" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."user_subscriptions_backup" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_subscriptions_backup" IS 'Backup of user_subscriptions table before migration on 2026-03-20';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accessibility_requests"
    ADD CONSTRAINT "accessibility_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_activity_logs"
    ADD CONSTRAINT "agent_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_history"
    ADD CONSTRAINT "application_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_metrics"
    ADD CONSTRAINT "compliance_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_metrics"
    ADD CONSTRAINT "compliance_metrics_user_id_action_type_hour_bucket_key" UNIQUE ("user_id", "action_type", "hour_bucket");



ALTER TABLE ONLY "public"."diversity_metrics"
    ADD CONSTRAINT "diversity_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dropdown_options"
    ADD CONSTRAINT "dropdown_options_category_option_value_key" UNIQUE ("category", "option_value");



ALTER TABLE ONLY "public"."dropdown_options"
    ADD CONSTRAINT "dropdown_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_actions"
    ADD CONSTRAINT "feedback_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_listings"
    ADD CONSTRAINT "job_listings_job_hash_key" UNIQUE ("job_hash");



ALTER TABLE ONLY "public"."job_listings"
    ADD CONSTRAINT "job_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_weights"
    ADD CONSTRAINT "learning_weights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_weights"
    ADD CONSTRAINT "learning_weights_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."overage_purchases"
    ADD CONSTRAINT "overage_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paystack_webhooks"
    ADD CONSTRAINT "paystack_webhooks_paystack_event_id_key" UNIQUE ("paystack_event_id");



ALTER TABLE ONLY "public"."paystack_webhooks"
    ADD CONSTRAINT "paystack_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."platform_logs"
    ADD CONSTRAINT "platform_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_buckets"
    ADD CONSTRAINT "rate_limit_buckets_user_id_function_name_window_start_key" UNIQUE ("user_id", "function_name", "window_start");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("user_id", "function_name");



ALTER TABLE ONLY "public"."recruiter_applications"
    ADD CONSTRAINT "recruiter_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_job_applications"
    ADD CONSTRAINT "recruiter_job_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_job_applications"
    ADD CONSTRAINT "recruiter_job_applications_recruiter_job_id_candidate_id_key" UNIQUE ("recruiter_job_id", "candidate_id");



ALTER TABLE ONLY "public"."recruiter_jobs"
    ADD CONSTRAINT "recruiter_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_outreach"
    ADD CONSTRAINT "recruiter_outreach_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_profiles"
    ADD CONSTRAINT "recruiter_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_profiles"
    ADD CONSTRAINT "recruiter_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_usage"
    ADD CONSTRAINT "subscription_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_usage"
    ADD CONSTRAINT "subscription_usage_user_id_feature_name_period_start_key" UNIQUE ("user_id", "feature_name", "period_start");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."tailored_resumes"
    ADD CONSTRAINT "tailored_resumes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_alerts"
    ADD CONSTRAINT "usage_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_tracking"
    ADD CONSTRAINT "usage_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_tracking"
    ADD CONSTRAINT "usage_tracking_user_id_feature_name_period_start_key" UNIQUE ("user_id", "feature_name", "period_start");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accessibility_requests_candidate" ON "public"."accessibility_requests" USING "btree" ("candidate_id");



CREATE INDEX "idx_activity_logs_created" ON "public"."agent_activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_logs_user" ON "public"."agent_activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_agent_activity_logs_created_at" ON "public"."agent_activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_agent_activity_logs_user_id" ON "public"."agent_activity_logs" USING "btree" ("user_id");



CREATE INDEX "idx_application_history_applied_at" ON "public"."application_history" USING "btree" ("applied_at" DESC);



CREATE INDEX "idx_application_history_status" ON "public"."application_history" USING "btree" ("status");



CREATE INDEX "idx_application_history_user_id" ON "public"."application_history" USING "btree" ("user_id");



CREATE INDEX "idx_applications_date" ON "public"."application_history" USING "btree" ("applied_at" DESC);



CREATE INDEX "idx_applications_user" ON "public"."application_history" USING "btree" ("user_id");



CREATE INDEX "idx_candidate_profiles_accessibility" ON "public"."candidate_profiles" USING "gin" ("accessibility_accommodations");



CREATE INDEX "idx_candidate_profiles_dei_preferences" ON "public"."candidate_profiles" USING "gin" ("dei_preferences");



CREATE INDEX "idx_candidate_profiles_ethnicity" ON "public"."candidate_profiles" USING "gin" ("ethnicity");



CREATE INDEX "idx_compliance_user_hour" ON "public"."compliance_metrics" USING "btree" ("user_id", "hour_bucket" DESC);



CREATE INDEX "idx_diversity_metrics_company_period" ON "public"."diversity_metrics" USING "btree" ("company_id", "reporting_period");



CREATE INDEX "idx_feedback_actions_created_at" ON "public"."feedback_actions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_actions_user_id" ON "public"."feedback_actions" USING "btree" ("user_id");



CREATE INDEX "idx_feedback_created" ON "public"."feedback_actions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_user" ON "public"."feedback_actions" USING "btree" ("user_id");



CREATE INDEX "idx_job_listings_accessibility_support" ON "public"."job_listings" USING "gin" ("accessibility_support");



CREATE INDEX "idx_job_listings_company" ON "public"."job_listings" USING "btree" ("company");



CREATE INDEX "idx_job_listings_created_at" ON "public"."job_listings" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_job_listings_diversity_rating" ON "public"."job_listings" USING "btree" ("diversity_rating");



CREATE INDEX "idx_job_listings_experience_level" ON "public"."job_listings" USING "btree" ("experience_level");



CREATE INDEX "idx_job_listings_freshness" ON "public"."job_listings" USING "btree" ("freshness_score" DESC);



CREATE INDEX "idx_job_listings_hash" ON "public"."job_listings" USING "btree" ("job_hash");



CREATE INDEX "idx_job_listings_inclusive_benefits" ON "public"."job_listings" USING "gin" ("inclusive_benefits");



CREATE INDEX "idx_job_listings_job_type" ON "public"."job_listings" USING "btree" ("job_type");



CREATE INDEX "idx_job_listings_remote" ON "public"."job_listings" USING "btree" ("remote");



CREATE INDEX "idx_job_listings_search" ON "public"."job_listings" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("company", ''::"text")) || ' '::"text") || COALESCE("description", ''::"text"))));



CREATE INDEX "idx_job_listings_source" ON "public"."job_listings" USING "btree" ("source");



CREATE INDEX "idx_job_listings_tech_stack" ON "public"."job_listings" USING "gin" ("tech_stack");



CREATE INDEX "idx_job_listings_title" ON "public"."job_listings" USING "btree" ("title");



CREATE INDEX "idx_overage_purchases_status" ON "public"."overage_purchases" USING "btree" ("status");



CREATE INDEX "idx_overage_purchases_user_feature" ON "public"."overage_purchases" USING "btree" ("user_id", "feature_name");



CREATE INDEX "idx_rate_limit_user_function" ON "public"."rate_limit_buckets" USING "btree" ("user_id", "function_name", "window_start");



CREATE INDEX "idx_rate_limits_user_function" ON "public"."rate_limits" USING "btree" ("user_id", "function_name");



CREATE UNIQUE INDEX "idx_rate_limits_user_function_unique" ON "public"."rate_limits" USING "btree" ("user_id", "function_name");



CREATE INDEX "idx_rate_limits_window_start" ON "public"."rate_limits" USING "btree" ("window_start");



CREATE INDEX "idx_recruiter_jobs_created_at" ON "public"."recruiter_jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_recruiter_jobs_recruiter_id" ON "public"."recruiter_jobs" USING "btree" ("recruiter_id");



CREATE INDEX "idx_recruiter_jobs_status" ON "public"."recruiter_jobs" USING "btree" ("status");



CREATE INDEX "idx_recruiter_outreach_candidate" ON "public"."recruiter_outreach" USING "btree" ("candidate_id");



CREATE INDEX "idx_recruiter_outreach_recruiter" ON "public"."recruiter_outreach" USING "btree" ("recruiter_id", "created_at" DESC);



CREATE INDEX "idx_rja_candidate_id" ON "public"."recruiter_job_applications" USING "btree" ("candidate_id");



CREATE INDEX "idx_rja_recruiter_job_id" ON "public"."recruiter_job_applications" USING "btree" ("recruiter_job_id");



CREATE INDEX "idx_rja_status" ON "public"."recruiter_job_applications" USING "btree" ("status");



CREATE INDEX "idx_subscription_usage_period" ON "public"."subscription_usage" USING "btree" ("period_start");



CREATE INDEX "idx_subscription_usage_user_feature" ON "public"."subscription_usage" USING "btree" ("user_id", "feature_name");



CREATE INDEX "idx_subscriptions_currency" ON "public"."subscriptions" USING "btree" ("currency");



CREATE INDEX "idx_subscriptions_payment_provider" ON "public"."subscriptions" USING "btree" ("payment_provider");



CREATE INDEX "idx_subscriptions_paystack_customer" ON "public"."subscriptions" USING "btree" ("paystack_customer_code");



CREATE INDEX "idx_subscriptions_stripe_customer_id" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_stripe_subscription_id" ON "public"."subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_tailored_resumes_created_at" ON "public"."tailored_resumes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_tailored_resumes_user_id" ON "public"."tailored_resumes" USING "btree" ("user_id");



CREATE INDEX "idx_usage_alerts_user_id" ON "public"."usage_alerts" USING "btree" ("user_id");



CREATE INDEX "idx_usage_tracking_period_start" ON "public"."usage_tracking" USING "btree" ("period_start");



CREATE INDEX "idx_usage_tracking_user_feature_period" ON "public"."usage_tracking" USING "btree" ("user_id", "feature_name", "period_start");



CREATE INDEX "idx_user_subscriptions_status" ON "public"."user_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "recruiter_outreach_candidate_id_idx" ON "public"."recruiter_outreach" USING "btree" ("candidate_id");



CREATE OR REPLACE TRIGGER "on_new_recruiter_application" AFTER INSERT ON "public"."recruiter_job_applications" FOR EACH ROW EXECUTE FUNCTION "public"."increment_recruiter_job_application_count"();



CREATE OR REPLACE TRIGGER "on_profile_role_change" AFTER UPDATE OF "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_recruiter_profile"();



CREATE OR REPLACE TRIGGER "recruiter_applications_updated_at" BEFORE UPDATE ON "public"."recruiter_applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_candidate_profiles_updated_at" BEFORE UPDATE ON "public"."candidate_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_job_listings_updated_at" BEFORE UPDATE ON "public"."job_listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_learning_weights_updated_at" BEFORE UPDATE ON "public"."learning_weights" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recruiter_jobs_updated_at" BEFORE UPDATE ON "public"."recruiter_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recruiter_profiles_updated_at" BEFORE UPDATE ON "public"."recruiter_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rja_updated_at" BEFORE UPDATE ON "public"."recruiter_job_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agent_activity_logs"
    ADD CONSTRAINT "agent_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_history"
    ADD CONSTRAINT "application_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."job_listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_history"
    ADD CONSTRAINT "application_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_metrics"
    ADD CONSTRAINT "compliance_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diversity_metrics"
    ADD CONSTRAINT "diversity_metrics_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."feedback_actions"
    ADD CONSTRAINT "feedback_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_weights"
    ADD CONSTRAINT "learning_weights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."overage_purchases"
    ADD CONSTRAINT "overage_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_admins"
    ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_logs"
    ADD CONSTRAINT "platform_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_applications"
    ADD CONSTRAINT "recruiter_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recruiter_applications"
    ADD CONSTRAINT "recruiter_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recruiter_job_applications"
    ADD CONSTRAINT "recruiter_job_applications_application_history_id_fkey" FOREIGN KEY ("application_history_id") REFERENCES "public"."application_history"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recruiter_job_applications"
    ADD CONSTRAINT "recruiter_job_applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_job_applications"
    ADD CONSTRAINT "recruiter_job_applications_recruiter_job_id_fkey" FOREIGN KEY ("recruiter_job_id") REFERENCES "public"."recruiter_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_jobs"
    ADD CONSTRAINT "recruiter_jobs_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "public"."job_listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recruiter_jobs"
    ADD CONSTRAINT "recruiter_jobs_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_outreach"
    ADD CONSTRAINT "recruiter_outreach_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recruiter_outreach"
    ADD CONSTRAINT "recruiter_outreach_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_outreach"
    ADD CONSTRAINT "recruiter_outreach_recruiter_job_id_fkey" FOREIGN KEY ("recruiter_job_id") REFERENCES "public"."recruiter_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recruiter_profiles"
    ADD CONSTRAINT "recruiter_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_usage"
    ADD CONSTRAINT "subscription_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_alerts"
    ADD CONSTRAINT "usage_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_tracking"
    ADD CONSTRAINT "usage_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view subscription plans" ON "public"."subscription_plans" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Authenticated users can view jobs" ON "public"."job_listings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view recruiter profiles" ON "public"."recruiter_profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Candidates manage own recruiter applications" ON "public"."recruiter_job_applications" USING (("auth"."uid"() = "candidate_id"));



CREATE POLICY "Candidates view active recruiter jobs" ON "public"."recruiter_jobs" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ("status" = 'active'::"text")));



CREATE POLICY "Companies can view own diversity metrics" ON "public"."diversity_metrics" FOR SELECT USING (("company_id" IN ( SELECT "diversity_metrics"."company_id"
   FROM "public"."recruiter_profiles"
  WHERE ("recruiter_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Platform admins can update any profile" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."user_id" = "auth"."uid"()))));



CREATE POLICY "Platform admins can update any subscription" ON "public"."subscriptions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."user_id" = "auth"."uid"()))));



CREATE POLICY "Platform admins can view all subscriptions" ON "public"."subscriptions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins"
  WHERE ("platform_admins"."user_id" = "auth"."uid"()))));



CREATE POLICY "Recruiters manage own company profile" ON "public"."recruiter_profiles" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Recruiters manage own jobs" ON "public"."recruiter_jobs" USING (("auth"."uid"() = "recruiter_id"));



CREATE POLICY "Recruiters update application status on their jobs" ON "public"."recruiter_job_applications" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."recruiter_jobs" "rj"
  WHERE (("rj"."id" = "recruiter_job_applications"."recruiter_job_id") AND ("rj"."recruiter_id" = "auth"."uid"())))));



CREATE POLICY "Recruiters view applications on their jobs" ON "public"."recruiter_job_applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."recruiter_jobs" "rj"
  WHERE (("rj"."id" = "recruiter_job_applications"."recruiter_job_id") AND ("rj"."recruiter_id" = "auth"."uid"())))));



CREATE POLICY "Service role can manage paystack webhooks" ON "public"."paystack_webhooks" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "System can insert overage purchases" ON "public"."overage_purchases" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "System can insert usage" ON "public"."subscription_usage" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "System can insert usage records" ON "public"."usage_tracking" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "System can update overage purchases" ON "public"."overage_purchases" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create own accessibility requests" ON "public"."accessibility_requests" FOR INSERT WITH CHECK (("candidate_id" = ( SELECT "candidate_profiles"."id"
   FROM "public"."candidate_profiles"
  WHERE ("candidate_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage own applications" ON "public"."application_history" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own candidate profile" ON "public"."candidate_profiles" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own feedback" ON "public"."feedback_actions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own logs" ON "public"."agent_activity_logs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own metrics" ON "public"."compliance_metrics" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own notification prefs" ON "public"."notification_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own preferences" ON "public"."user_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own profile" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own tailored resumes" ON "public"."tailored_resumes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own usage records" ON "public"."subscription_usage" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own user record" ON "public"."users" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage own weights" ON "public"."learning_weights" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only see their own rate limits" ON "public"."rate_limits" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own accessibility requests" ON "public"."accessibility_requests" FOR SELECT USING (("candidate_id" = ( SELECT "candidate_profiles"."id"
   FROM "public"."candidate_profiles"
  WHERE ("candidate_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own overage purchases" ON "public"."overage_purchases" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own rate limit buckets" ON "public"."rate_limit_buckets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own rate limits" ON "public"."rate_limits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."user_subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own usage" ON "public"."subscription_usage" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own usage" ON "public"."usage_tracking" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own usage alerts" ON "public"."usage_alerts" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."accessibility_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_view_inbound_outreach" ON "public"."recruiter_outreach" FOR SELECT USING (("auth"."uid"() = "candidate_id"));



ALTER TABLE "public"."compliance_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diversity_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_weights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."overage_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."paystack_webhooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_admins_delete" ON "public"."platform_admins" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."role" = 'root'::"text")))));



CREATE POLICY "platform_admins_insert" ON "public"."platform_admins" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."platform_admins" "pa"
  WHERE (("pa"."user_id" = "auth"."uid"()) AND ("pa"."role" = 'root'::"text")))));



CREATE POLICY "platform_admins_select" ON "public"."platform_admins" FOR SELECT USING ("public"."is_platform_admin"());



CREATE POLICY "platform_admins_view_all_profiles" ON "public"."profiles" FOR SELECT USING (("public"."is_platform_admin"() OR ("id" = "auth"."uid"())));



CREATE POLICY "platform_admins_view_all_subscriptions" ON "public"."subscriptions" FOR SELECT USING (("public"."is_platform_admin"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "platform_admins_view_recruiter_applications" ON "public"."recruiter_applications" FOR SELECT USING (("public"."is_platform_admin"() OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."platform_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_logs_insert" ON "public"."platform_logs" FOR INSERT WITH CHECK (("public"."is_platform_admin"() OR true));



CREATE POLICY "platform_logs_select" ON "public"."platform_logs" FOR SELECT USING ("public"."is_platform_admin"());



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_applications_insert" ON "public"."recruiter_applications" FOR INSERT WITH CHECK (true);



CREATE POLICY "recruiter_applications_select_own" ON "public"."recruiter_applications" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "recruiter_applications_update" ON "public"."recruiter_applications" FOR UPDATE USING ("public"."is_platform_admin"());



ALTER TABLE "public"."recruiter_job_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_outreach" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_outreach_insert" ON "public"."recruiter_outreach" FOR INSERT WITH CHECK (("auth"."uid"() = "recruiter_id"));



CREATE POLICY "recruiter_outreach_select" ON "public"."recruiter_outreach" FOR SELECT USING (("auth"."uid"() = "recruiter_id"));



ALTER TABLE "public"."recruiter_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tailored_resumes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."check_feature_usage_limit"("p_user_id" "uuid", "p_feature_name" "text", "p_requested_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_feature_usage_limit"("p_user_id" "uuid", "p_feature_name" "text", "p_requested_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_feature_usage_limit"("p_user_id" "uuid", "p_feature_name" "text", "p_requested_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_function_name" "text", "p_max_requests" integer, "p_window_seconds" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_function_name" "text", "p_max_requests" integer, "p_window_seconds" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_function_name" "text", "p_max_requests" integer, "p_window_seconds" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_period_start" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_period_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_period_start" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feature_usage"("p_user_id" "uuid", "p_feature_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feature_usage"("p_user_id" "uuid", "p_feature_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feature_usage"("p_user_id" "uuid", "p_feature_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_overage_rate"("p_user_id" "uuid", "p_feature_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_overage_rate"("p_user_id" "uuid", "p_feature_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_overage_rate"("p_user_id" "uuid", "p_feature_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_payment_provider_for_user"("p_user_id" "uuid", "p_user_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_payment_provider_for_user"("p_user_id" "uuid", "p_user_country" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_payment_provider_for_user"("p_user_id" "uuid", "p_user_country" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_platform_analytics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_platform_analytics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_analytics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_recruiter_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_recruiter_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_recruiter_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_mirror"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_mirror"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_mirror"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_recruiter_job_application_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_recruiter_job_application_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_recruiter_job_application_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_root_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_root_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_root_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_dei_preferences"("candidate_profile_id" "uuid", "job_listing_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_dei_preferences"("candidate_profile_id" "uuid", "job_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_dei_preferences"("candidate_profile_id" "uuid", "job_listing_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."purchase_overage_credits"("p_user_id" "uuid", "p_feature_name" "text", "p_quantity" integer, "p_payment_intent_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."purchase_overage_credits"("p_user_id" "uuid", "p_feature_name" "text", "p_quantity" integer, "p_payment_intent_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."purchase_overage_credits"("p_user_id" "uuid", "p_feature_name" "text", "p_quantity" integer, "p_payment_intent_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_feature_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_usage_count" integer, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."record_feature_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_usage_count" integer, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_feature_usage"("p_user_id" "uuid", "p_feature_name" "text", "p_usage_count" integer, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."accessibility_requests" TO "anon";
GRANT ALL ON TABLE "public"."accessibility_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."accessibility_requests" TO "service_role";



GRANT ALL ON TABLE "public"."agent_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."agent_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."application_history" TO "anon";
GRANT ALL ON TABLE "public"."application_history" TO "authenticated";
GRANT ALL ON TABLE "public"."application_history" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_profiles" TO "anon";
GRANT ALL ON TABLE "public"."candidate_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_metrics" TO "anon";
GRANT ALL ON TABLE "public"."compliance_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."diversity_metrics" TO "anon";
GRANT ALL ON TABLE "public"."diversity_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."diversity_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."dropdown_options" TO "anon";
GRANT ALL ON TABLE "public"."dropdown_options" TO "authenticated";
GRANT ALL ON TABLE "public"."dropdown_options" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_actions" TO "anon";
GRANT ALL ON TABLE "public"."feedback_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_actions" TO "service_role";



GRANT ALL ON TABLE "public"."job_applications" TO "anon";
GRANT ALL ON TABLE "public"."job_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."job_applications" TO "service_role";



GRANT ALL ON TABLE "public"."job_listings" TO "anon";
GRANT ALL ON TABLE "public"."job_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."job_listings" TO "service_role";



GRANT ALL ON TABLE "public"."learning_weights" TO "anon";
GRANT ALL ON TABLE "public"."learning_weights" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_weights" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."overage_purchases" TO "anon";
GRANT ALL ON TABLE "public"."overage_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."overage_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."paystack_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."paystack_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."paystack_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."platform_admins" TO "anon";
GRANT ALL ON TABLE "public"."platform_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_admins" TO "service_role";



GRANT ALL ON TABLE "public"."platform_logs" TO "anon";
GRANT ALL ON TABLE "public"."platform_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_logs" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_buckets" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_applications" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_applications" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_job_applications" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_job_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_job_applications" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_jobs" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_outreach" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_outreach" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_outreach" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_profiles" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_usage" TO "anon";
GRANT ALL ON TABLE "public"."subscription_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_usage" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions_backup" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions_backup" TO "service_role";



GRANT ALL ON TABLE "public"."tailored_resumes" TO "anon";
GRANT ALL ON TABLE "public"."tailored_resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."tailored_resumes" TO "service_role";



GRANT ALL ON TABLE "public"."usage_alerts" TO "anon";
GRANT ALL ON TABLE "public"."usage_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."usage_tracking" TO "anon";
GRANT ALL ON TABLE "public"."usage_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions_backup" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions_backup" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































