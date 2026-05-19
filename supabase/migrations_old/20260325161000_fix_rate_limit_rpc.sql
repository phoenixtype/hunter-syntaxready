-- 1. Clean up duplicate rows (keep only the newest record for each user/function pair)
DELETE FROM rate_limits
WHERE ctid NOT IN (
    SELECT DISTINCT ON (user_id, function_name) ctid
    FROM rate_limits
    ORDER BY user_id, function_name, window_start DESC
);

-- 2. Establish a hard UNIQUE constraint
ALTER TABLE rate_limits DROP CONSTRAINT IF EXISTS rate_limits_user_function_key;
DROP INDEX IF EXISTS idx_rate_limits_user_function_unique;
ALTER TABLE rate_limits ADD CONSTRAINT rate_limits_user_function_key UNIQUE (user_id, function_name);

-- 3. Replace the RPC function
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
    window_boundary := NOW() - INTERVAL '1 second' * p_window_seconds;

    SELECT * INTO existing_record
    FROM rate_limits
    WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND window_start > window_boundary
    ORDER BY window_start DESC
    LIMIT 1;

    IF existing_record IS NULL THEN
        INSERT INTO rate_limits (user_id, function_name, request_count, window_start)
        VALUES (p_user_id, p_function_name, 1, NOW())
        ON CONFLICT (user_id, function_name)
        DO UPDATE SET
            request_count = 1,
            window_start = NOW();

        RETURN TRUE;
    END IF;

    current_count := existing_record.request_count;

    IF current_count >= p_max_requests THEN
        RETURN FALSE;
    END IF;

    UPDATE rate_limits
    SET request_count = request_count + 1
    WHERE user_id = p_user_id AND function_name = p_function_name;

    RETURN TRUE;

EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Rate limit database check failed for user % function %: %', p_user_id, p_function_name, SQLERRM;
        RETURN TRUE;
END;
$$;
