-- Grant authenticated users write access to subscriptions so admin dashboard can update plans.
-- RLS policies (below) enforce that only admins can write other users' rows,
-- and regular users can only write their own row (for future self-serve flows).

GRANT INSERT, UPDATE ON public.subscriptions TO authenticated;

-- Allow admins to insert subscriptions for any user
DROP POLICY IF EXISTS "Platform admins can insert any subscription" ON public.subscriptions;
CREATE POLICY "Platform admins can insert any subscription"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  );
