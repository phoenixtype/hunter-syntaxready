-- Fix Supabase Security Issues
-- Run this in the Supabase SQL Editor

-- ==============================================================================
-- 1. FIX FUNCTION SEARCH PATH ISSUES
-- Set search_path to prevent security vulnerabilities
-- ==============================================================================

-- Fix handle_new_user_mirror function
CREATE OR REPLACE FUNCTION public.handle_new_user_mirror()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Fix check_rate_limit function
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
  v_count integer;
  v_window_start timestamp;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::interval;
  
  -- Count requests in window
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_buckets
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND created_at > v_window_start;
  
  -- If under limit, insert new record and allow
  IF v_count < p_max_requests THEN
    INSERT INTO public.rate_limit_buckets (user_id, function_name, created_at)
    VALUES (p_user_id, p_function_name, NOW());
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- ==============================================================================
-- 2. FIX RLS POLICIES - Drop ALL existing policies first, then create proper ones
-- ==============================================================================

-- First, let's see what policies exist (check output before proceeding)
-- SELECT schemaname, tablename, policyname FROM pg_policies 
-- WHERE tablename IN ('job_listings', 'rate_limit_buckets');

-- DROP ALL EXISTING POLICIES on job_listings
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'job_listings'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.job_listings', pol.policyname);
    END LOOP;
END $$;

-- DROP ALL EXISTING POLICIES on rate_limit_buckets
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'rate_limit_buckets'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.rate_limit_buckets', pol.policyname);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policies for job_listings
-- Authenticated users can read job listings
CREATE POLICY "Authenticated users can view job_listings"
  ON public.job_listings
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access job_listings"
  ON public.job_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create proper RLS policies for rate_limit_buckets
-- Only service role can access rate_limit_buckets (managed by Edge Functions)
CREATE POLICY "Service role full access rate_limit_buckets"
  ON public.rate_limit_buckets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 3. EXTENSION IN PUBLIC - This is informational only
-- pg_net in public schema is expected for Supabase, can be ignored
-- ==============================================================================

-- ==============================================================================
-- VERIFICATION - Check remaining policies
-- ==============================================================================
SELECT 'Policies after fix:' as status;
SELECT schemaname, tablename, policyname, roles FROM pg_policies 
WHERE tablename IN ('job_listings', 'rate_limit_buckets')
ORDER BY tablename, policyname;
