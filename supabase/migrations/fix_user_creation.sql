-- FIX USER CREATION ERROR
-- Run this in Supabase SQL Editor to restore the trigger functions with correct columns

-- ==============================================================================
-- 1. FIX handle_new_user function (for profiles + user_preferences)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles with correct columns
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert into user_preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$$;

-- ==============================================================================
-- 2. FIX handle_new_user_mirror function (for users table)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_mirror()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into users table with correct columns
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, new.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- ==============================================================================
-- 3. FIX check_rate_limit function (uses rate_limits table, not rate_limit_buckets)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_function_name text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_count INTEGER;
BEGIN
    -- Cleanup old entries
    DELETE FROM public.rate_limits 
    WHERE window_start < (NOW() - (p_window_seconds || ' seconds')::INTERVAL);

    INSERT INTO public.rate_limits (user_id, function_name, request_count, window_start)
    VALUES (p_user_id, p_function_name, 1, NOW())
    ON CONFLICT (user_id, function_name) 
    DO UPDATE SET
        request_count = CASE 
            WHEN rate_limits.window_start < (NOW() - (p_window_seconds || ' seconds')::INTERVAL) THEN 1
            ELSE rate_limits.request_count + 1
        END,
        window_start = CASE
            WHEN rate_limits.window_start < (NOW() - (p_window_seconds || ' seconds')::INTERVAL) THEN NOW()
            ELSE rate_limits.window_start
        END
    RETURNING request_count INTO v_count;

    RETURN v_count <= p_max_requests;
END;
$$;

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================
SELECT 'Trigger functions restored successfully!' as status;
