-- Quick fix for missing database columns and tables
-- Run this directly in Supabase SQL editor

-- 1. Add missing columns to job_listings
ALTER TABLE job_listings
ADD COLUMN IF NOT EXISTS experience_level TEXT,
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'full-time',
ADD COLUMN IF NOT EXISTS salary_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_max INTEGER,
ADD COLUMN IF NOT EXISTS remote BOOLEAN DEFAULT FALSE;

-- 2. Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    price_usd NUMERIC(10,2) DEFAULT 0,
    price_ngn NUMERIC(10,2) DEFAULT 0,
    price_usd_yearly NUMERIC(10,2) DEFAULT 0,
    price_ngn_yearly NUMERIC(10,2) DEFAULT 0,
    features JSONB DEFAULT '{}',
    limits JSONB DEFAULT '{}',
    overage_rates JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, price_usd, price_ngn, price_usd_yearly, price_ngn_yearly, features, limits, overage_rates, is_active, sort_order)
VALUES
('free', 'Free Plan', 0, 0, 0, 0, '{"job_applications": true, "resume_builder": true}', '{"job_applications": 20, "resume_generations": 5}', '{}', true, 1),
('pro', 'Pro Plan', 19.99, 32000, 199.99, 320000, '{"job_applications": true, "resume_builder": true, "priority_support": true}', '{"job_applications": 200, "resume_generations": 50}', '{}', true, 2),
('enterprise', 'Enterprise Plan', 99.99, 160000, 999.99, 1600000, '{"unlimited": true}', '{"job_applications": 10000, "resume_generations": 10000}', '{}', true, 3)
ON CONFLICT (name) DO NOTHING;

-- 4. Update existing job_listings with experience levels
UPDATE job_listings
SET experience_level = CASE
    WHEN LOWER(title) LIKE '%senior%' OR LOWER(title) LIKE '%lead%' OR LOWER(title) LIKE '%principal%' THEN 'senior'
    WHEN LOWER(title) LIKE '%junior%' OR LOWER(title) LIKE '%intern%' OR LOWER(title) LIKE '%entry%' THEN 'entry'
    ELSE 'mid'
END
WHERE experience_level IS NULL;

-- 5. Set remote flag based on location
UPDATE job_listings
SET remote = (LOWER(location) LIKE '%remote%' OR location = 'Remote')
WHERE remote IS NULL;

-- 6. Enable RLS and create policies
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscription plans are publicly readable" ON subscription_plans
    FOR SELECT USING (TRUE);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_listings_experience_level ON job_listings (experience_level);
CREATE INDEX IF NOT EXISTS idx_job_listings_remote ON job_listings (remote);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans (is_active, sort_order);

-- 8. Grant permissions
GRANT ALL ON TABLE subscription_plans TO authenticated;
GRANT ALL ON TABLE subscription_plans TO anon;
GRANT ALL ON TABLE subscription_plans TO service_role;