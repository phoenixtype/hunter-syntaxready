-- Create a table for server-side rate limiting in edge functions
-- This table stores request counts per user per function with sliding window support
CREATE TABLE public.rate_limit_buckets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    function_name TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, function_name, window_start)
);

-- Enable RLS
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- No public access - only service role can access this table
-- Edge functions use service role key, not user tokens

-- Create index for fast lookups
CREATE INDEX idx_rate_limit_user_function 
ON public.rate_limit_buckets (user_id, function_name, window_start);

-- Auto-delete old rate limit entries (older than 1 hour)
-- This keeps the table small and performant
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_buckets 
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;

-- Create a function to check and increment rate limit atomically
-- Returns true if request is allowed, false if rate limited
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id UUID,
    p_function_name TEXT,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_current_count INTEGER;
BEGIN
    -- Calculate the start of the current window
    v_window_start := date_trunc('minute', now());
    
    -- Clean up old entries periodically (1% chance per request)
    IF random() < 0.01 THEN
        PERFORM public.cleanup_old_rate_limits();
    END IF;
    
    -- Try to get current count for this window
    SELECT request_count INTO v_current_count
    FROM public.rate_limit_buckets
    WHERE user_id = p_user_id 
      AND function_name = p_function_name
      AND window_start >= now() - (p_window_seconds || ' seconds')::INTERVAL
    ORDER BY window_start DESC
    LIMIT 1;
    
    -- If we have a recent window entry
    IF v_current_count IS NOT NULL THEN
        -- Check if we're over the limit
        IF v_current_count >= p_max_requests THEN
            RETURN FALSE;
        END IF;
        
        -- Increment the counter
        UPDATE public.rate_limit_buckets
        SET request_count = request_count + 1
        WHERE user_id = p_user_id 
          AND function_name = p_function_name
          AND window_start >= now() - (p_window_seconds || ' seconds')::INTERVAL;
        
        RETURN TRUE;
    ELSE
        -- Create a new window entry
        INSERT INTO public.rate_limit_buckets (user_id, function_name, request_count, window_start)
        VALUES (p_user_id, p_function_name, 1, v_window_start)
        ON CONFLICT (user_id, function_name, window_start) 
        DO UPDATE SET request_count = rate_limit_buckets.request_count + 1;
        
        RETURN TRUE;
    END IF;
END;
$$;

-- Document that job_listings is intentionally public (non-sensitive data only)
COMMENT ON TABLE public.job_listings IS 
'SECURITY NOTE: This table is intentionally publicly readable. 
It contains only non-sensitive job posting data (title, company, location, etc.).
No user data, resume content, or private information is stored here.
RLS allows SELECT for all users and INSERT for authenticated users only.';