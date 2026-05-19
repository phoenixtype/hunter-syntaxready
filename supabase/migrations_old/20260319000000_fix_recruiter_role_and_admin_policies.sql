-- ============================================================
-- 1. Fix handle_new_user to populate email + role from metadata
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================
-- 2. Backfill email for all existing profiles from auth.users
-- ============================================================
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- ============================================================
-- 3. Backfill role='recruiter' for approved recruiter applications
-- ============================================================
UPDATE public.profiles p
SET role = 'recruiter'
FROM auth.users u
JOIN public.recruiter_applications ra ON lower(ra.email) = lower(u.email)
WHERE p.id = u.id
  AND ra.status = 'approved'
  AND (p.role IS NULL OR p.role = 'candidate');

-- ============================================================
-- 4. Add admin RLS policy: platform_admins can view all subscriptions
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Platform admins can view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. Add admin RLS policy: platform_admins can update any profile
--    (needed for role + plan changes from admin panel)
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can update any profile" ON public.profiles;
CREATE POLICY "Platform admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Add admin RLS policy: platform_admins can update any subscription
-- ============================================================
DROP POLICY IF EXISTS "Platform admins can update any subscription" ON public.subscriptions;
CREATE POLICY "Platform admins can update any subscription"
  ON public.subscriptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  );
