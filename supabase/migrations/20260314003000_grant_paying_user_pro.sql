-- Grant Pro to user c4135be9 whose live checkout.session.completed
-- (cs_live_a1fXczCs91262QtdJeM5WyEmiECviL1gBO2AK4aMkxqKx1vAwCUUxsTwKp)
-- fired before live webhook events were corrected.
-- Stripe customer: cus_U901WfqZPdtHvd  Subscription: sub_1TAiGBD543enPilsT2uHRuhn

INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  cancel_at_period_end
) VALUES (
  'c4135be9-9bae-4526-b2f1-5fb448238acd',
  'pro',
  'active',
  'cus_U901WfqZPdtHvd',
  'sub_1TAiGBD543enPilsT2uHRuhn',
  false
)
ON CONFLICT (user_id) DO UPDATE SET
  tier                   = 'pro',
  status                 = 'active',
  stripe_customer_id     = 'cus_U901WfqZPdtHvd',
  stripe_subscription_id = 'sub_1TAiGBD543enPilsT2uHRuhn',
  cancel_at_period_end   = false,
  updated_at             = now();
