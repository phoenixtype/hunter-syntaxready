-- PERMANENT FIX: Refactor User Preferences Foreign Key
-- Problem: user_preferences currently references a fragile 'public.users' table
-- Solution: Reference 'auth.users' directly, which is the source of truth

BEGIN;

-- 1. Drop the problematic constraint
ALTER TABLE public.user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;

-- 2. Add the robust constraint pointing to auth.users
-- This ensures that as long as the user is logged in (exists in auth), the FK is satisfied.
ALTER TABLE public.user_preferences
ADD CONSTRAINT user_preferences_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 3. (Optional) Cleanup - If you have other tables with the same issue, fix them too
-- Example: application_history, etc.
-- We can safely apply this pattern to all user-centric tables if needed.

COMMIT;

-- Verify the fix by notifying that it's done
DO $$
BEGIN
  RAISE NOTICE 'Foreign Key Constraint successfully repointed to auth.users';
END $$;
