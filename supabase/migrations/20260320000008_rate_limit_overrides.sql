-- Rate Limit Overrides System
CREATE TABLE IF NOT EXISTS rate_limit_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_test_mode_enabled BOOLEAN DEFAULT false,
  global_test_mode_multiplier NUMERIC(4,1) DEFAULT 10.0,
  global_test_mode_expires_at TIMESTAMPTZ,
  global_test_mode_enabled_by UUID REFERENCES auth.users(id),
  global_test_mode_enabled_at TIMESTAMPTZ,
  function_overrides JSONB DEFAULT '{}',
  exempted_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rate_limit_overrides DEFAULT VALUES;
ALTER TABLE rate_limit_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access only" ON rate_limit_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_rate_limit_overrides_test_mode
ON rate_limit_overrides(global_test_mode_enabled, global_test_mode_expires_at);

-- Database functions for configuration management
CREATE OR REPLACE FUNCTION toggle_test_mode(
  p_enabled BOOLEAN,
  p_multiplier NUMERIC DEFAULT 10.0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expires_at TIMESTAMPTZ;
BEGIN
  -- Only allow admins
  IF NOT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  expires_at := CASE WHEN p_enabled THEN NOW() + INTERVAL '6 hours' ELSE NULL END;

  UPDATE rate_limit_overrides SET
    global_test_mode_enabled = p_enabled,
    global_test_mode_multiplier = p_multiplier,
    global_test_mode_expires_at = expires_at,
    global_test_mode_enabled_by = auth.uid(),
    global_test_mode_enabled_at = CASE WHEN p_enabled THEN NOW() ELSE NULL END,
    updated_at = NOW();

  INSERT INTO platform_logs (actor_id, action, entity_type, metadata)
  VALUES (auth.uid(), CASE WHEN p_enabled THEN 'test_mode_enabled' ELSE 'test_mode_disabled' END, 'rate_limit_config', jsonb_build_object('multiplier', p_multiplier, 'expires_at', expires_at));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION update_function_override(
  p_function_name TEXT,
  p_limits JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_overrides JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT function_overrides INTO current_overrides FROM rate_limit_overrides;

  IF p_limits IS NULL THEN
    current_overrides := current_overrides - p_function_name;
  ELSE
    current_overrides := current_overrides || jsonb_build_object(p_function_name, p_limits);
  END IF;

  UPDATE rate_limit_overrides SET function_overrides = current_overrides, updated_at = NOW();

  INSERT INTO platform_logs (actor_id, action, entity_type, metadata)
  VALUES (auth.uid(), 'function_override_updated', 'rate_limit_config', jsonb_build_object('function_name', p_function_name));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_exemptions(
  p_exempted_users UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE rate_limit_overrides SET exempted_users = p_exempted_users, updated_at = NOW();

  INSERT INTO platform_logs (actor_id, action, entity_type, metadata)
  VALUES (auth.uid(), 'user_exemptions_updated', 'rate_limit_config', jsonb_build_object('count', array_length(p_exempted_users, 1)));

  RETURN true;
END;
$$;