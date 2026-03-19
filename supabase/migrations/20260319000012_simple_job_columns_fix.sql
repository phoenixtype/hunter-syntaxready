-- Simple fix for missing job_listings columns only
-- This addresses the immediate API error

-- Add missing columns to job_listings table
ALTER TABLE job_listings
ADD COLUMN IF NOT EXISTS experience_level TEXT,
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'full-time',
ADD COLUMN IF NOT EXISTS salary_min INTEGER,
ADD COLUMN IF NOT EXISTS salary_max INTEGER,
ADD COLUMN IF NOT EXISTS remote BOOLEAN DEFAULT FALSE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_listings_experience_level ON job_listings (experience_level);
CREATE INDEX IF NOT EXISTS idx_job_listings_job_type ON job_listings (job_type);
CREATE INDEX IF NOT EXISTS idx_job_listings_remote ON job_listings (remote);

-- Update existing records with default values based on existing data
UPDATE job_listings
SET experience_level = CASE
    WHEN LOWER(title) LIKE '%senior%' OR LOWER(title) LIKE '%lead%' OR LOWER(title) LIKE '%principal%' OR LOWER(title) LIKE '%staff%' THEN 'senior'
    WHEN LOWER(title) LIKE '%junior%' OR LOWER(title) LIKE '%intern%' OR LOWER(title) LIKE '%entry%' OR LOWER(title) LIKE '%graduate%' THEN 'entry'
    WHEN LOWER(title) LIKE '%mid%' OR LOWER(title) LIKE '%intermediate%' THEN 'mid'
    ELSE 'mid' -- Default to mid level
END
WHERE experience_level IS NULL;

-- Set remote flag based on location or description
UPDATE job_listings
SET remote = (
    LOWER(location) LIKE '%remote%' OR
    LOWER(COALESCE(description, '')) LIKE '%remote%' OR
    LOWER(COALESCE(description, '')) LIKE '%work from home%' OR
    LOWER(location) = 'remote'
)
WHERE remote IS NULL;

-- Parse salary_range into min/max if possible (simple parsing)
UPDATE job_listings
SET
    salary_min = CASE
        WHEN salary_range ~ '\$(\d+)k' THEN
            (regexp_match(salary_range, '\$(\d+)k'))[1]::INTEGER * 1000
        WHEN salary_range ~ '(\d+)k' THEN
            (regexp_match(salary_range, '(\d+)k'))[1]::INTEGER * 1000
        ELSE NULL
    END,
    salary_max = CASE
        WHEN salary_range ~ '\$(\d+)k.*\$(\d+)k' THEN
            (regexp_match(salary_range, '\$\d+k.*\$(\d+)k'))[1]::INTEGER * 1000
        WHEN salary_range ~ '(\d+)k.*(\d+)k' THEN
            (regexp_match(salary_range, '\d+k.*(\d+)k'))[1]::INTEGER * 1000
        ELSE NULL
    END
WHERE salary_min IS NULL AND salary_max IS NULL AND salary_range IS NOT NULL;