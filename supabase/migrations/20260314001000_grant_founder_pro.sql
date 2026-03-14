-- Immediately grant Pro to the founder account whose live Stripe payment succeeded
-- but whose subscription was never written to DB (live webhook was pointing to wrong project).
-- Subscription: sub_1TAg4ID543enPilsNP1FkoPG  Customer: cus_U8xLbVMyjyu4dM
-- This row will be kept in sync by the live webhook once it is corrected in Stripe Dashboard.

INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  current_period_start,
  current_period_end,
  cancel_at_period_end
) VALUES (
  '75f9c096-c24d-4dc6-a6ce-2469f8813483',
  'pro',
  'active',
  'cus_U8xLbVMyjyu4dM',
  'sub_1TAg4ID543enPilsNP1FkoPG',
  'price_1TALVaD543enPilsrJ1adiax',
  to_timestamp(1773448114),
  to_timestamp(1774052914),
  false
)
ON CONFLICT (user_id) DO UPDATE SET
  tier                   = 'pro',
  status                 = 'active',
  stripe_customer_id     = 'cus_U8xLbVMyjyu4dM',
  stripe_subscription_id = 'sub_1TAg4ID543enPilsNP1FkoPG',
  stripe_price_id        = 'price_1TALVaD543enPilsrJ1adiax',
  current_period_start   = to_timestamp(1773448114),
  current_period_end     = to_timestamp(1774052914),
  cancel_at_period_end   = false,
  updated_at             = now();
