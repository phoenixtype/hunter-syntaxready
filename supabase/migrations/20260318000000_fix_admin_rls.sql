-- Fix: platform_admins_select policy was self-referential (queried platform_admins
-- from within its own USING clause), which is unreliable in PostgreSQL.
-- Replace with the SECURITY DEFINER helper that bypasses RLS correctly.
-- Also re-seed the root admin in case the original seed ran before the user existed.

-- 1. Drop the broken self-referential policy
DROP POLICY IF EXISTS "platform_admins_select" ON public.platform_admins;

-- 2. Recreate using the SECURITY DEFINER function (breaks the circular dependency)
CREATE POLICY "platform_admins_select" ON public.platform_admins
  FOR SELECT USING (public.is_platform_admin());

-- 3. Re-seed root admin (idempotent — ON CONFLICT upgrades to root if needed)
INSERT INTO public.platform_admins (user_id, role, notes)
SELECT id, 'root', 'Primary owner — seeded from migration'
FROM auth.users
WHERE email = 'samuelakuma130@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'root';
