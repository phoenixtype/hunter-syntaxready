-- Create rate limiting function and table for edge functions
-- Fixes critical production error "TypeError: K is not a function"

-- Create rate_limits table if it doesn't exist
CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    function_name TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_function
ON rate_limits(user_id, function_name);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start
ON rate_limits(window_start);

-- Create or replace the check_rate_limit RPC function
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_function_name TEXT,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_count INTEGER := 0;
    window_start TIMESTAMP WITH TIME ZONE;
    existing_record RECORD;
BEGIN
    -- Calculate window start time
    window_start := NOW() - INTERVAL '1 second' * p_window_seconds;

    -- Get existing record for this user and function
    SELECT * INTO existing_record
    FROM rate_limits
    WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND window_start > window_start
    ORDER BY window_start DESC
    LIMIT 1;

    -- If no recent record or window has expired, create new one
    IF existing_record IS NULL OR existing_record.window_start < window_start THEN
        INSERT INTO rate_limits (user_id, function_name, request_count, window_start)
        VALUES (p_user_id, p_function_name, 1, NOW())
        ON CONFLICT (user_id, function_name)
        DO UPDATE SET
            request_count = 1,
            window_start = NOW(),
            updated_at = NOW();

        RETURN TRUE;
    END IF;

    -- Check if under limit
    current_count := existing_record.request_count;

    IF current_count >= p_max_requests THEN
        RETURN FALSE;
    END IF;

    -- Increment counter
    UPDATE rate_limits
    SET request_count = request_count + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND id = existing_record.id;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and block request for safety
        RAISE LOG 'Rate limit check failed for user % function %: %', p_user_id, p_function_name, SQLERRM;
        RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- Enable RLS on rate_limits table
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can only see their own rate limits" ON rate_limits
    FOR ALL USING (auth.uid() = user_id);

-- Add comment
COMMENT ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) IS
'Rate limiting function for Supabase Edge Functions. Returns true if request is allowed, false if rate limited.';