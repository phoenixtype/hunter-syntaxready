-- Fix: signup triggers were crashing because handle_new_user() was missing
-- ON CONFLICT clauses and had no exception handling.
-- Also clean up the duplicate notification trigger names introduced across
-- several migrations.

-- ============================================================
-- 1. Robust handle_new_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

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
  -- Never let a trigger crash a signup
  RAISE WARNING 'handle_new_user failed for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

-- ============================================================
-- 2. Robust handle_new_user_notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================
-- 3. Drop ALL existing signup trigger variants so we start clean
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created              ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_profile      ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_mirror               ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_mirror       ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_notifications        ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_notifications ON auth.users;

-- ============================================================
-- 4. Re-create clean, uniquely-named triggers
-- ============================================================
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_mirror
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_mirror();

CREATE TRIGGER on_auth_user_created_notifications
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_notifications();
