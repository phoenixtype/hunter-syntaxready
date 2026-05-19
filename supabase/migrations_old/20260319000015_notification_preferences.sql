-- Add notification settings to user preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS
notification_settings JSONB DEFAULT '{
  "job_matches": {
    "enabled": true,
    "frequency": "daily",
    "time": "09:00",
    "timezone": "UTC"
  },
  "auto_applications": {
    "enabled": true,
    "frequency": "immediate"
  },
  "weekly_digest": {
    "enabled": true,
    "frequency": "weekly",
    "day": "sunday",
    "time": "09:00"
  },
  "payment_updates": {
    "enabled": true,
    "frequency": "immediate"
  },
  "usage_warnings": {
    "enabled": true,
    "threshold": 80
  }
}';

-- Create notification queue table
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'payment', 'job_alert', 'usage_warning', 'weekly_digest'
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data JSONB NOT NULL DEFAULT '{}',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create processed notifications log
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  email_subject TEXT,
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_scheduled
  ON notification_queue (user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_scheduled
  ON notification_queue (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_type
  ON notification_history (user_id, type);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at
  ON notification_history (sent_at);

-- RLS policies
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notification_queue
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own notification history" ON notification_history
  FOR SELECT USING (user_id = auth.uid());

-- Service role can manage all notifications
CREATE POLICY "Service role can manage notifications" ON notification_queue
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage notification history" ON notification_history
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON notification_queue TO authenticated;
GRANT SELECT ON notification_history TO authenticated;
GRANT ALL ON notification_queue TO service_role;
GRANT ALL ON notification_history TO service_role;

-- Function to schedule notification
CREATE OR REPLACE FUNCTION schedule_notification(
  p_user_id UUID,
  p_type TEXT,
  p_priority TEXT DEFAULT 'medium',
  p_data JSONB DEFAULT '{}',
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notification_queue (
    user_id,
    type,
    priority,
    data,
    scheduled_for
  ) VALUES (
    p_user_id,
    p_type,
    p_priority,
    p_data,
    p_scheduled_for
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user notification preferences
CREATE OR REPLACE FUNCTION get_notification_preferences(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  prefs JSONB;
BEGIN
  SELECT notification_settings INTO prefs
  FROM user_preferences
  WHERE user_id = p_user_id;

  -- Return default preferences if none set
  IF prefs IS NULL THEN
    prefs := '{
      "job_matches": {"enabled": true, "frequency": "daily", "time": "09:00", "timezone": "UTC"},
      "auto_applications": {"enabled": true, "frequency": "immediate"},
      "weekly_digest": {"enabled": true, "frequency": "weekly", "day": "sunday", "time": "09:00"},
      "payment_updates": {"enabled": true, "frequency": "immediate"},
      "usage_warnings": {"enabled": true, "threshold": 80}
    }'::JSONB;
  END IF;

  RETURN prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;