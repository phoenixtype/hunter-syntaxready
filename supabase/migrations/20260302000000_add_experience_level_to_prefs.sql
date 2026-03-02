-- Add experience_level column to user_preferences (was missing from original schema)
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'mid';
