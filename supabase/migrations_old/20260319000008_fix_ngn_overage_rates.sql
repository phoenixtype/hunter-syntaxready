-- Fix NGN overage rates and missing columns for Nigerian payments

-- Add missing columns to subscriptions table if they don't exist
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fix all NGN overage rates for all features
UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{job_applications_ngn}',
    '"3200.00"'::jsonb
) WHERE name = 'free';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{resume_generations_ngn}',
    '"8000.00"'::jsonb
) WHERE name = 'free';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{ai_interviews_ngn}',
    '"16000.00"'::jsonb
) WHERE name = 'free';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{cover_letters_ngn}',
    '"2400.00"'::jsonb
) WHERE name = 'free';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{job_matches_ngn}',
    '"800.00"'::jsonb
) WHERE name = 'free';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{company_research_ngn}',
    '"1600.00"'::jsonb
) WHERE name = 'free';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{skill_assessments_ngn}',
    '"24000.00"'::jsonb
) WHERE name = 'free';

-- Pro plan NGN rates (25% cheaper than free)
UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{job_applications_ngn}',
    '"2400.00"'::jsonb
) WHERE name = 'pro';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{resume_generations_ngn}',
    '"4800.00"'::jsonb
) WHERE name = 'pro';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{ai_interviews_ngn}',
    '"12000.00"'::jsonb
) WHERE name = 'pro';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{cover_letters_ngn}',
    '"1600.00"'::jsonb
) WHERE name = 'pro';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{job_matches_ngn}',
    '"400.00"'::jsonb
) WHERE name = 'pro';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{company_research_ngn}',
    '"1200.00"'::jsonb
) WHERE name = 'pro';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{skill_assessments_ngn}',
    '"16000.00"'::jsonb
) WHERE name = 'pro';

-- Enterprise plan NGN rates (50% cheaper than free)
UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{job_applications_ngn}',
    '"1600.00"'::jsonb
) WHERE name = 'enterprise';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{resume_generations_ngn}',
    '"3200.00"'::jsonb
) WHERE name = 'enterprise';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{ai_interviews_ngn}',
    '"8000.00"'::jsonb
) WHERE name = 'enterprise';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{cover_letters_ngn}',
    '"1200.00"'::jsonb
) WHERE name = 'enterprise';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{job_matches_ngn}',
    '"160.00"'::jsonb
) WHERE name = 'enterprise';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{company_research_ngn}',
    '"800.00"'::jsonb
) WHERE name = 'enterprise';

UPDATE subscription_plans SET overage_rates = jsonb_set(
    overage_rates,
    '{skill_assessments_ngn}',
    '"12000.00"'::jsonb
) WHERE name = 'enterprise';