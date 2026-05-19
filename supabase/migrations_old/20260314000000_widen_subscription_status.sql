-- Widen subscription status check constraint to cover all Stripe statuses.
-- Stripe can send: active, trialing, past_due, canceled, incomplete,
-- incomplete_expired, unpaid, paused — the old constraint would fail on the
-- last three causing webhook upserts to be silently rejected.

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY[
    'active', 'trialing', 'past_due', 'canceled',
    'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  ]));
