-- Test Notification Processor
-- This script creates test notifications and shows how to process them

-- First, let's see current notification queue status
SELECT
  status,
  COUNT(*) as count
FROM notification_queue
GROUP BY status;

-- Create a test payment confirmation notification
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Get a test user (first authenticated user)
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    -- Schedule a payment confirmation notification
    PERFORM schedule_notification(
      test_user_id,
      'payment',
      'high',
      '{
        "paymentConfirmation": {
          "tier": "pro",
          "amount": 19.99,
          "currency": "usd",
          "paymentProvider": "stripe",
          "userName": "Test User"
        }
      }'::JSONB
    );

    -- Schedule a usage warning notification
    PERFORM schedule_notification(
      test_user_id,
      'usage_warning',
      'medium',
      '{
        "usageWarning": {
          "userName": "Test User",
          "featureName": "Job Applications",
          "usagePercent": 85,
          "remaining": 15,
          "limit": 100,
          "resetDate": "April 1, 2026"
        }
      }'::JSONB
    );

    -- Schedule a job alert notification
    PERFORM schedule_notification(
      test_user_id,
      'job_alert',
      'low',
      '{
        "jobAlert": {
          "userName": "Test User",
          "jobs": [
            {
              "title": "Senior Software Engineer",
              "company": "TechCorp Inc",
              "location": "San Francisco, CA",
              "salary": "$120,000 - $160,000",
              "url": "https://usehunter.app/jobs/123"
            },
            {
              "title": "Frontend Developer",
              "company": "StartupXYZ",
              "location": "Remote",
              "salary": "$80,000 - $120,000",
              "url": "https://usehunter.app/jobs/124"
            }
          ],
          "totalMatches": 5
        }
      }'::JSONB
    );

    RAISE NOTICE 'Created 3 test notifications for user: %', test_user_id;
  ELSE
    RAISE NOTICE 'No authenticated users found to test with';
  END IF;
END $$;

-- Show the newly created notifications
SELECT
  id,
  type,
  priority,
  status,
  attempts,
  scheduled_for,
  created_at
FROM notification_queue
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 10;