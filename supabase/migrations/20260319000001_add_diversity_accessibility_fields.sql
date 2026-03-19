-- ==========================================
-- DIVERSITY, EQUITY & INCLUSION FEATURES
-- ==========================================

-- Add demographic and accessibility columns to candidate_profiles
ALTER TABLE candidate_profiles
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS ethnicity TEXT[],
ADD COLUMN IF NOT EXISTS pronouns TEXT,
ADD COLUMN IF NOT EXISTS disability_status TEXT,
ADD COLUMN IF NOT EXISTS accessibility_accommodations TEXT[],
ADD COLUMN IF NOT EXISTS veteran_status BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS first_generation_college BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS primary_language TEXT DEFAULT 'English',
ADD COLUMN IF NOT EXISTS visa_sponsorship_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS religious_accommodations TEXT[],
ADD COLUMN IF NOT EXISTS socioeconomic_background TEXT,
ADD COLUMN IF NOT EXISTS dei_preferences JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{
  "share_demographics": false,
  "share_disability_status": false,
  "share_veteran_status": false
}'::jsonb;

-- Add DEI-related columns to job_listings
ALTER TABLE job_listings
ADD COLUMN IF NOT EXISTS dei_commitment TEXT,
ADD COLUMN IF NOT EXISTS accessibility_support TEXT[],
ADD COLUMN IF NOT EXISTS inclusive_benefits TEXT[],
ADD COLUMN IF NOT EXISTS diversity_rating DECIMAL(2,1) CHECK (diversity_rating >= 1.0 AND diversity_rating <= 5.0),
ADD COLUMN IF NOT EXISTS pay_equity_certified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS remote_work_accessibility BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mentorship_programs BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS eeo_statement TEXT,
ADD COLUMN IF NOT EXISTS accommodation_statement TEXT DEFAULT 'We provide reasonable accommodations for qualified individuals with disabilities.',
ADD COLUMN IF NOT EXISTS preferred_pronouns_respected BOOLEAN DEFAULT TRUE;

-- Create companies table if it doesn't exist
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    website TEXT,
    size_range TEXT,
    industry TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create diversity metrics tracking table
CREATE TABLE IF NOT EXISTS diversity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    metric_name TEXT NOT NULL,
    metric_value DECIMAL,
    metric_category TEXT NOT NULL, -- 'gender', 'ethnicity', 'age', 'disability', etc.
    reporting_period DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create candidate_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS candidate_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create job_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID,
    job_id UUID,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create accessibility requests table
CREATE TABLE IF NOT EXISTS accessibility_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID, -- Remove foreign key constraint for now
    job_application_id UUID, -- Remove foreign key constraint for now
    request_type TEXT NOT NULL, -- 'interview', 'workplace', 'application_process'
    accommodation_details TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'denied')),
    employer_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create DEI job matching function
CREATE OR REPLACE FUNCTION match_dei_preferences(
    candidate_profile_id UUID,
    job_listing_id UUID
) RETURNS DECIMAL AS $$
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
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_dei_preferences ON candidate_profiles USING GIN (dei_preferences);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_ethnicity ON candidate_profiles USING GIN (ethnicity);
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_accessibility ON candidate_profiles USING GIN (accessibility_accommodations);
CREATE INDEX IF NOT EXISTS idx_job_listings_accessibility_support ON job_listings USING GIN (accessibility_support);
CREATE INDEX IF NOT EXISTS idx_job_listings_inclusive_benefits ON job_listings USING GIN (inclusive_benefits);
CREATE INDEX IF NOT EXISTS idx_job_listings_diversity_rating ON job_listings (diversity_rating);
CREATE INDEX IF NOT EXISTS idx_diversity_metrics_company_period ON diversity_metrics (company_id, reporting_period);
CREATE INDEX IF NOT EXISTS idx_accessibility_requests_candidate ON accessibility_requests (candidate_id);

-- Add RLS policies for privacy protection
ALTER TABLE diversity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own accessibility requests
CREATE POLICY "Users can view own accessibility requests" ON accessibility_requests
    FOR SELECT USING (
        candidate_id = (SELECT id FROM candidate_profiles WHERE user_id = auth.uid())
    );

-- Policy: Users can create their own accessibility requests
CREATE POLICY "Users can create own accessibility requests" ON accessibility_requests
    FOR INSERT WITH CHECK (
        candidate_id = (SELECT id FROM candidate_profiles WHERE user_id = auth.uid())
    );

-- Policy: Companies can view diversity metrics for their organization
CREATE POLICY "Companies can view own diversity metrics" ON diversity_metrics
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM recruiter_profiles
            WHERE user_id = auth.uid()
        )
    );

-- Add comments for documentation
COMMENT ON COLUMN candidate_profiles.ethnicity IS 'Array of ethnic identities - supports multiple selections';
COMMENT ON COLUMN candidate_profiles.accessibility_accommodations IS 'Array of needed accommodations';
COMMENT ON COLUMN candidate_profiles.dei_preferences IS 'JSON object storing DEI-related preferences and settings';
COMMENT ON COLUMN candidate_profiles.privacy_settings IS 'JSON object controlling which demographic data to share';
COMMENT ON COLUMN job_listings.accessibility_support IS 'Array of accessibility features the company provides';
COMMENT ON COLUMN job_listings.inclusive_benefits IS 'Array of inclusive benefits offered';
COMMENT ON COLUMN job_listings.diversity_rating IS 'Company diversity rating from 1.0 to 5.0';

-- Create dropdown_options table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.dropdown_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    option_value TEXT NOT NULL,
    display_text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category, option_value)
);

-- Insert seed data for common accommodations and benefits
INSERT INTO public.dropdown_options (category, option_value, display_text, sort_order) VALUES
-- Accessibility accommodations
('accessibility_accommodations', 'screen_reader', 'Screen reader compatibility', 1),
('accessibility_accommodations', 'keyboard_navigation', 'Keyboard-only navigation', 2),
('accessibility_accommodations', 'high_contrast', 'High contrast displays', 3),
('accessibility_accommodations', 'flexible_hours', 'Flexible work hours', 4),
('accessibility_accommodations', 'remote_work', 'Remote work options', 5),
('accessibility_accommodations', 'ergonomic_equipment', 'Ergonomic equipment', 6),
('accessibility_accommodations', 'quiet_workspace', 'Quiet workspace', 7),
('accessibility_accommodations', 'break_schedule', 'Flexible break schedule', 8),
('accessibility_accommodations', 'sign_language', 'Sign language interpreter', 9),
('accessibility_accommodations', 'mobility_assistance', 'Mobility assistance', 10),

-- Inclusive benefits
('inclusive_benefits', 'parental_leave', 'Comprehensive parental leave', 1),
('inclusive_benefits', 'mental_health', 'Mental health support', 2),
('inclusive_benefits', 'gender_affirming_care', 'Gender-affirming healthcare', 3),
('inclusive_benefits', 'fertility_support', 'Fertility and family planning', 4),
('inclusive_benefits', 'religious_holidays', 'Religious holiday flexibility', 5),
('inclusive_benefits', 'cultural_celebrations', 'Cultural celebration support', 6),
('inclusive_benefits', 'accessibility_fund', 'Accessibility equipment fund', 7),
('inclusive_benefits', 'education_assistance', 'Education and training assistance', 8),
('inclusive_benefits', 'employee_resource_groups', 'Employee resource groups', 9),
('inclusive_benefits', 'bias_training', 'Anti-bias training programs', 10),

-- Ethnicity options
('ethnicity', 'american_indian', 'American Indian / Alaska Native', 1),
('ethnicity', 'asian', 'Asian', 2),
('ethnicity', 'black_african', 'Black or African American', 3),
('ethnicity', 'hispanic_latino', 'Hispanic or Latino', 4),
('ethnicity', 'native_hawaiian', 'Native Hawaiian / Pacific Islander', 5),
('ethnicity', 'white', 'White', 6),
('ethnicity', 'middle_eastern', 'Middle Eastern / North African', 7),
('ethnicity', 'mixed_race', 'Two or more races', 8),
('ethnicity', 'prefer_not_to_say', 'Prefer not to say', 9),

-- Gender options
('gender', 'male', 'Male', 1),
('gender', 'female', 'Female', 2),
('gender', 'prefer_not_to_say', 'Prefer not to say', 3),

-- Pronouns
('pronouns', 'he_him', 'he/him', 1),
('pronouns', 'she_her', 'she/her', 2)

ON CONFLICT (category, option_value) DO NOTHING;