-- Fix users table RLS policies
-- Add INSERT policy for users table
CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Add UPDATE policy for users table  
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add DELETE policy for profiles table
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- Add DELETE policy for candidate_profiles table
CREATE POLICY "Users can delete their own candidate profile"
ON public.candidate_profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Fix rate_limits table - restrict to service role only by removing public access
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;

-- Rate limits should not have public SELECT - only service role should access
-- Since RLS policies can't directly reference service role, we use a different approach:
-- Make rate_limits only accessible when no public access is needed
CREATE POLICY "Users can view their own rate limits"
ON public.rate_limits
FOR SELECT
USING (auth.uid() = user_id);

-- Add DELETE policy for application_history
CREATE POLICY "Users can delete their own applications"
ON public.application_history
FOR DELETE
USING (auth.uid() = user_id);

-- Add DELETE policy for compliance_metrics
CREATE POLICY "Users can delete their own metrics"
ON public.compliance_metrics
FOR DELETE
USING (auth.uid() = user_id);

-- Add UPDATE and DELETE policies for feedback_actions
CREATE POLICY "Users can update their own feedback"
ON public.feedback_actions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
ON public.feedback_actions
FOR DELETE
USING (auth.uid() = user_id);

-- Add DELETE policy for learning_weights
CREATE POLICY "Users can delete their own weights"
ON public.learning_weights
FOR DELETE
USING (auth.uid() = user_id);

-- Add DELETE policy for user_preferences
CREATE POLICY "Users can delete their own preferences"
ON public.user_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Add UPDATE and DELETE policies for agent_activity_logs (users can only manage their own logs)
CREATE POLICY "Users can update their own logs"
ON public.agent_activity_logs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
ON public.agent_activity_logs
FOR DELETE
USING (auth.uid() = user_id);

-- Fix the agent_activity_logs INSERT policy to require user_id
DROP POLICY IF EXISTS "Users can insert their own logs" ON public.agent_activity_logs;

CREATE POLICY "Users can insert their own logs"
ON public.agent_activity_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);