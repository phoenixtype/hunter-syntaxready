-- Fix the rate limiting function bug that causes "TypeError: K is not a function"
-- The original function had a logical error: window_start > window_start (always false)

-- Create unique constraint for proper conflict resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_user_function_unique
ON rate_limits(user_id, function_name);

-- Fix the rate limit function with correct logic
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
    window_boundary TIMESTAMP WITH TIME ZONE;
    existing_record RECORD;
BEGIN
    -- Calculate window boundary (requests older than this are expired)
    window_boundary := NOW() - INTERVAL '1 second' * p_window_seconds;

    -- Get existing record for this user and function within the current window
    SELECT * INTO existing_record
    FROM rate_limits
    WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND window_start > window_boundary  -- Fixed: compare record timestamp to calculated boundary
    ORDER BY window_start DESC
    LIMIT 1;

    -- If no recent record or window has expired, start a new window
    IF existing_record IS NULL THEN
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
    WHERE id = existing_record.id;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and block request for safety
        RAISE LOG 'Rate limit check failed for user % function %: %', p_user_id, p_function_name, SQLERRM;
        RETURN FALSE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;

-- Add improved comment
COMMENT ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, INTEGER) IS
'Fixed rate limiting function for Edge Functions. Returns true if request is allowed, false if rate limited. Handles sliding window correctly.';