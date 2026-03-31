// Rate Limiter Utility for Supabase Edge Functions
// This utility leverages the existing `public.check_rate_limit` RPC function.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkSubscriptionAccess } from './input-validation.ts';

export class RateLimiter {
  constructor(private supabase: SupabaseClient, private userId: string) {}

  /**
   * Checks if the user has exceeded their rate limit for a specific function.
   * If the user is on a 'pro' tier, they receive higher limits.
   */
  async isAllowed(
    functionName: string,
    limits: {
      free: { max: number; window: number };
      pro: { max: number; window: number };
      requirePro?: boolean;
    }
  ): Promise<{ allowed: boolean; error?: string }> {
    try {
      // 1. Get user subscription tier — use limit(1) to avoid maybeSingle() failing on duplicate rows
      const { data: subscriptions } = await this.supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', this.userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      const subscription = subscriptions?.[0] ?? null;
      const tier = subscription?.tier === 'pro' ? 'pro' : 'free';

      // 2. IMPORTANT-4: Enforce Pro subscription before hitting the rate-limit DB.
      if (limits.requirePro) {
        const access = checkSubscriptionAccess(tier, true);
        if (!access.allowed) return access;
      }

      const config = limits[tier];

      console.log(`[RATE_LIMIT] Checking ${functionName} for user ${this.userId} (Tier: ${tier})`);

      // 2. Execute the rate limit RPC
      const { data, error } = await this.supabase.rpc('check_rate_limit', {
        p_user_id: this.userId,
        p_function_name: functionName,
        p_max_requests: config.max,
        p_window_seconds: config.window
      });

      if (error) {
        console.error(`[RATE_LIMIT] RPC Error for ${functionName}:`, error);
        // Fail-closed: block the request if rate-limit DB check fails.
        // Prevents abuse during DB outages.
        return { allowed: false, error: "Service temporarily unavailable. Please try again in a moment." };
      }

      const allowed = data === true;
      if (!allowed) {
        console.warn(`[RATE_LIMIT] Blocked ${functionName} for user ${this.userId}`);
      }

      const windowLabel = config.window >= 60
        ? `${Math.round(config.window / 60)} minute${config.window >= 120 ? 's' : ''}`
        : `${config.window} seconds`;

      return {
        allowed,
        error: allowed ? undefined : `Too many requests. Please try again in ${windowLabel}.`
      };

    } catch (err) {
      console.error(`[RATE_LIMIT] Unexpected error for ${functionName}:`, err);
      // Fail-closed on unexpected errors — prevent abuse during outages
      return { allowed: false, error: "Service temporarily unavailable. Please try again in a moment." };
    }
  }
}

/**
 * Common CORS headers for Edge Function responses
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-connection-pool-size, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
