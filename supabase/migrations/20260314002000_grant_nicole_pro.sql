-- Grant Pro access to nicolemasodje09@gmail.com
-- Payment confirmed; subscription row written manually as webhook was misconfigured at time of payment.

INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  cancel_at_period_end
)
SELECT
  id,
  'pro',
  'active',
  false
FROM auth.users
WHERE email = 'nicolemasodje09@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  tier               = 'pro',
  status             = 'active',
  cancel_at_period_end = false,
  updated_at         = now();
