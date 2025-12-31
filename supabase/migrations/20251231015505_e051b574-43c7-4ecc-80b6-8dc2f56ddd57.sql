-- SECURITY FIX: Restrict NULL user_id logs to prevent business intelligence exposure
-- Drop the existing overly permissive policies
DROP POLICY IF EXISTS "Users can view own logs" ON public.agent_activity_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.agent_activity_logs;

-- Create new SELECT policy: Users can ONLY view their own logs (not NULL user_id system logs)
-- System logs should only be accessible via service role, not to authenticated users
CREATE POLICY "Users can view only their own logs" 
ON public.agent_activity_logs 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Create new INSERT policy: Users can insert logs for themselves OR system logs (NULL user_id)
-- This allows the application to create system-level logs without user context
CREATE POLICY "Users can insert their own logs" 
ON public.agent_activity_logs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Add comment explaining the security decision
COMMENT ON TABLE public.agent_activity_logs IS 'Activity logs with RLS. Users can only see their own logs. System logs (NULL user_id) are only accessible via service role for security.';