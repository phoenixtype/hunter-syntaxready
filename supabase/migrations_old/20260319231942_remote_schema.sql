-- Drop constraints if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_unique') THEN
        alter table "public"."subscriptions" drop constraint "subscriptions_user_id_unique";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_fkey') THEN
        alter table "public"."subscriptions" drop constraint "subscriptions_user_id_fkey";
    END IF;
END $$;

drop index if exists "public"."subscriptions_user_id_unique";

alter table "public"."subscriptions" add column "cancel_at_period_end" boolean default false;

alter table "public"."subscriptions" add column "stripe_price_id" text;

alter table "public"."subscriptions" alter column "created_at" set not null;

alter table "public"."subscriptions" alter column "current_period_start" drop default;

alter table "public"."subscriptions" alter column "updated_at" set not null;

-- Add columns to backup table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions_backup') THEN
        alter table "public"."subscriptions_backup" add column "cancel_at_period_end" boolean;
        alter table "public"."subscriptions_backup" add column "stripe_price_id" text;
    END IF;
END $$;

alter table "public"."user_preferences" add column "alert_frequency" text default 'daily'::text;

alter table "public"."user_preferences" add column "search_intent" text default 'active'::text;

CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions USING btree (stripe_customer_id);

CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions USING btree (stripe_subscription_id);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);

CREATE UNIQUE INDEX subscriptions_user_id_key ON public.subscriptions USING btree (user_id);

alter table "public"."subscriptions" add constraint "subscriptions_tier_check" CHECK ((tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text]))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_tier_check";

alter table "public"."subscriptions" add constraint "subscriptions_user_id_key" UNIQUE using index "subscriptions_user_id_key";

alter table "public"."user_preferences" add constraint "user_preferences_alert_frequency_check" CHECK ((alert_frequency = ANY (ARRAY['instant'::text, 'daily'::text, 'weekly'::text, 'off'::text]))) not valid;

alter table "public"."user_preferences" validate constraint "user_preferences_alert_frequency_check";

alter table "public"."user_preferences" add constraint "user_preferences_experience_level_check" CHECK ((experience_level = ANY (ARRAY['entry'::text, 'mid'::text, 'senior'::text, 'lead'::text, 'executive'::text]))) not valid;

alter table "public"."user_preferences" validate constraint "user_preferences_experience_level_check";

alter table "public"."user_preferences" add constraint "user_preferences_search_intent_check" CHECK ((search_intent = ANY (ARRAY['active'::text, 'passive'::text, 'exploring'::text]))) not valid;

alter table "public"."user_preferences" validate constraint "user_preferences_search_intent_check";

alter table "public"."subscriptions" add constraint "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_feature_usage(p_user_id uuid, p_feature_name text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.record_feature_usage(p_user_id uuid, p_feature_name text, p_count integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    p_count,
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
  )
  ON CONFLICT (user_id, feature_name, period_start)
  DO UPDATE SET
    usage_count = subscription_usage.usage_count + p_count,
    updated_at = NOW();

  RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_usage(p_user_id uuid, p_feature_name text, p_period_start date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.record_feature_usage(p_user_id uuid, p_feature_name text, p_usage_count integer DEFAULT 1, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


