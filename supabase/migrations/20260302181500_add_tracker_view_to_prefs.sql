-- Add tracker_view column to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS tracker_view text DEFAULT 'list' CHECK (tracker_view IN ('board', 'list'));

-- Update existing records to have 'list' as default if not set
UPDATE public.user_preferences SET tracker_view = 'list' WHERE tracker_view IS NULL;
