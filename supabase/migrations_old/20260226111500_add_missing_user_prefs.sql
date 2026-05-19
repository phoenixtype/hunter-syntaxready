-- Add missing columns to user_preferences for application defaults and alerts

ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS require_sponsorship boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_clearance boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notice_period_days integer DEFAULT 14,
ADD COLUMN IF NOT EXISTS email_alerts_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_alerts_enabled boolean DEFAULT false;

-- Drop and recreate handle_new_user to ensure we insert default values for user_preferences
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  INSERT INTO public.user_preferences (user_id, require_sponsorship, has_clearance, notice_period_days, email_alerts_enabled, sms_alerts_enabled)
  VALUES (new.id, false, false, 14, false, false);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
