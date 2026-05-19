/*
  # Default Admin Promotion
  
  Ensures samuelakuma130@gmail.com is always granted 'root' admin privileges.
*/

-- 1. Create specialized promotion function
CREATE OR REPLACE FUNCTION public.handle_admin_promotion()
RETURNS trigger AS $$
BEGIN
  IF (NEW.email = 'samuelakuma130@gmail.com') THEN
    INSERT INTO public.platform_admins (user_id, role, notes)
    VALUES (NEW.id, 'root', 'Auto-promoted default admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'root';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to auth.users (ensure it doesn't already exist)
DROP TRIGGER IF EXISTS on_auth_user_promotion ON auth.users;
CREATE TRIGGER on_auth_user_promotion
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_promotion();

-- 3. Update RLS helper functions to allow bypass for the default email
-- This handles cases where the platform_admins table record might be missing
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  ) OR (auth.jwt() ->> 'email' = 'samuelakuma130@gmail.com');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_root_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND role = 'root'
  ) OR (auth.jwt() ->> 'email' = 'samuelakuma130@gmail.com');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Manual backfill for existing user
INSERT INTO public.platform_admins (user_id, role, notes)
SELECT id, 'root', 'Manual backfill for default admin'
FROM auth.users
WHERE email = 'samuelakuma130@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'root';
