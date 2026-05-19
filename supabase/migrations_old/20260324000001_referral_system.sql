-- ─────────────────────────────────────────────────────────────────────────────
-- Referral system + enhanced admin roles
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Referral codes table (user + influencer codes)
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  owner_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type          text NOT NULL DEFAULT 'user' CHECK (type IN ('user', 'influencer')),
  label         text,                            -- display name for influencer campaigns
  max_uses      int,                             -- null = unlimited
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id)   -- admin who created influencer codes
);

-- 2. Referral events — tracks each successful signup via referral
CREATE TABLE IF NOT EXISTS public.referral_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code   text NOT NULL REFERENCES public.referral_codes(code),
  referrer_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_id)  -- a user can only be referred once
);

-- 3. Referral rewards — tracks bonus access granted to referrers
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type     text NOT NULL CHECK (reward_type IN ('pro_days', 'auto_applies')),
  amount          int NOT NULL,
  reason          text,                          -- e.g. "3 referrals milestone"
  granted_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz                    -- null = permanent
);

-- 4. Expand admin roles: root > admin > moderator > viewer
ALTER TABLE public.platform_admins
  DROP CONSTRAINT IF EXISTS platform_admins_role_check;
ALTER TABLE public.platform_admins
  ADD CONSTRAINT platform_admins_role_check
  CHECK (role IN ('root', 'admin', 'moderator', 'viewer'));

-- 5. Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for referral_codes
-- Users can read their own code
CREATE POLICY "users_read_own_referral_code" ON public.referral_codes
  FOR SELECT USING (owner_id = auth.uid());

-- Admins can read all
CREATE POLICY "admins_read_all_referral_codes" ON public.referral_codes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- Admins can insert/update/delete
CREATE POLICY "admins_manage_referral_codes" ON public.referral_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND role IN ('root', 'admin'))
  );

-- Service role can insert user codes (via edge function on signup)
-- This is handled by service_role bypassing RLS

-- 7. RLS policies for referral_events
-- Users can see events where they are the referrer
CREATE POLICY "users_read_own_referral_events" ON public.referral_events
  FOR SELECT USING (referrer_id = auth.uid());

-- Admins can read all events
CREATE POLICY "admins_read_all_referral_events" ON public.referral_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- 8. RLS policies for referral_rewards
-- Users can see their own rewards
CREATE POLICY "users_read_own_referral_rewards" ON public.referral_rewards
  FOR SELECT USING (user_id = auth.uid());

-- Admins can read all rewards
CREATE POLICY "admins_read_all_referral_rewards" ON public.referral_rewards
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
  );

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON public.referral_codes(owner_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON public.referral_events(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_code ON public.referral_events(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON public.referral_rewards(user_id);

-- 10. Function to get referral stats for admin dashboard
CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only allow platform admins
  IF NOT EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'total_codes', (SELECT count(*) FROM referral_codes),
    'active_codes', (SELECT count(*) FROM referral_codes WHERE active = true),
    'total_referrals', (SELECT count(*) FROM referral_events),
    'total_rewards', (SELECT count(*) FROM referral_rewards),
    'top_referrers', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT
          re.referrer_id,
          p.full_name,
          count(*) as referral_count,
          rc.code,
          rc.type
        FROM referral_events re
        JOIN referral_codes rc ON rc.code = re.referral_code
        LEFT JOIN profiles p ON p.id = re.referrer_id
        WHERE re.referrer_id IS NOT NULL
        GROUP BY re.referrer_id, p.full_name, rc.code, rc.type
        ORDER BY referral_count DESC
        LIMIT 20
      ) t
    ),
    'influencer_codes', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT
          rc.id,
          rc.code,
          rc.label,
          rc.max_uses,
          rc.active,
          rc.created_at,
          count(re.id) as uses
        FROM referral_codes rc
        LEFT JOIN referral_events re ON re.referral_code = rc.code
        WHERE rc.type = 'influencer'
        GROUP BY rc.id
        ORDER BY rc.created_at DESC
      ) t
    ),
    'referrals_by_day', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT
          date_trunc('day', created_at)::date as day,
          count(*) as count
        FROM referral_events
        WHERE created_at > now() - interval '30 days'
        GROUP BY day
        ORDER BY day
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
