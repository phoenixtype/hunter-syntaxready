-- Allow users to generate their own referral codes
CREATE POLICY "users_insert_own_referral_code" ON public.referral_codes
  FOR INSERT WITH CHECK (owner_id = auth.uid() AND type = 'user');
