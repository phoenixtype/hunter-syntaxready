import { supabase } from "@/integrations/supabase/client";

// ── Referral reward tiers ────────────────────────────────────────────────────
// Based on market research: Dropbox (extra storage), Notion (credits),
// Canva (Pro days). We use a tiered model rewarding both referrer & referred.
export const REFERRAL_MILESTONES = [
  { count: 1, reward: "3 days Pro", type: "pro_days" as const, amount: 3 },
  { count: 3, reward: "7 days Pro", type: "pro_days" as const, amount: 7 },
  { count: 5, reward: "14 days Pro + 5 Auto-Applies", type: "pro_days" as const, amount: 14 },
  { count: 10, reward: "30 days Pro + 10 Auto-Applies", type: "pro_days" as const, amount: 30 },
] as const;

// ── Generate a unique referral code ──────────────────────────────────────────
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
  let code = "HNT-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Get or create user's referral code ───────────────────────────────────────
export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  // Check existing
  const { data: existing } = await supabase
    .from("referral_codes" as never)
    .select("code")
    .eq("owner_id", userId)
    .eq("type", "user")
    .maybeSingle() as { data: { code: string } | null; error: unknown };

  if (existing?.code) return existing.code;

  // Create new
  const code = generateCode();
  const { error } = await supabase
    .from("referral_codes" as never)
    .insert({ code, owner_id: userId, type: "user" } as never);

  if (error) {
    console.error("Failed to create referral code:", error);
    return null;
  }
  return code;
}

// ── Get referral stats for current user ──────────────────────────────────────
export interface UserReferralStats {
  code: string;
  totalReferrals: number;
  rewards: { reward_type: string; amount: number; granted_at: string; expires_at: string | null }[];
  nextMilestone: typeof REFERRAL_MILESTONES[number] | null;
}

export async function getUserReferralStats(userId: string): Promise<UserReferralStats | null> {
  const code = await getOrCreateReferralCode(userId);
  if (!code) return null;

  const [eventsRes, rewardsRes] = await Promise.all([
    supabase
      .from("referral_events" as never)
      .select("id")
      .eq("referrer_id", userId) as Promise<{ data: { id: string }[] | null; error: unknown }>,
    supabase
      .from("referral_rewards" as never)
      .select("reward_type, amount, granted_at, expires_at")
      .eq("user_id", userId)
      .order("granted_at", { ascending: false }) as Promise<{
        data: { reward_type: string; amount: number; granted_at: string; expires_at: string | null }[] | null;
        error: unknown;
      }>,
  ]);

  const totalReferrals = eventsRes.data?.length ?? 0;
  const rewards = rewardsRes.data ?? [];

  // Find next unreached milestone
  const nextMilestone = REFERRAL_MILESTONES.find(m => totalReferrals < m.count) ?? null;

  return { code, totalReferrals, rewards, nextMilestone };
}

// ── Build shareable referral URL ─────────────────────────────────────────────
export function getReferralUrl(code: string): string {
  return `${window.location.origin}/signup?ref=${code}`;
}

// ── Record a referral on signup (called from auth flow) ──────────────────────
export async function recordReferral(referredUserId: string, referralCode: string): Promise<boolean> {
  // Validate code exists and is active
  const { data: codeData } = await supabase
    .from("referral_codes" as never)
    .select("code, owner_id, active, max_uses, type")
    .eq("code", referralCode)
    .maybeSingle() as {
      data: { code: string; owner_id: string | null; active: boolean; max_uses: number | null; type: string } | null;
      error: unknown;
    };

  if (!codeData || !codeData.active) return false;

  // Check max uses
  if (codeData.max_uses) {
    const { data: uses } = await supabase
      .from("referral_events" as never)
      .select("id")
      .eq("referral_code", referralCode) as { data: { id: string }[] | null; error: unknown };
    if ((uses?.length ?? 0) >= codeData.max_uses) return false;
  }

  // Don't allow self-referral
  if (codeData.owner_id === referredUserId) return false;

  // Insert event
  const { error } = await supabase
    .from("referral_events" as never)
    .insert({
      referral_code: referralCode,
      referrer_id: codeData.owner_id,
      referred_id: referredUserId,
    } as never);

  if (error) {
    console.error("Failed to record referral:", error);
    return false;
  }

  // Check if referrer hit a milestone and grant reward
  if (codeData.owner_id) {
    await checkAndGrantRewards(codeData.owner_id);
  }

  return true;
}

// ── Check milestones and grant rewards ───────────────────────────────────────
async function checkAndGrantRewards(userId: string): Promise<void> {
  const { data: events } = await supabase
    .from("referral_events" as never)
    .select("id")
    .eq("referrer_id", userId) as { data: { id: string }[] | null; error: unknown };

  const count = events?.length ?? 0;

  // Check each milestone
  for (const milestone of REFERRAL_MILESTONES) {
    if (count >= milestone.count) {
      // Check if already granted
      const { data: existing } = await supabase
        .from("referral_rewards" as never)
        .select("id")
        .eq("user_id", userId)
        .eq("reason", `${milestone.count} referrals milestone`) as { data: { id: string }[] | null; error: unknown };

      if (!existing?.length) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + milestone.amount);

        await supabase.from("referral_rewards" as never).insert({
          user_id: userId,
          reward_type: milestone.type,
          amount: milestone.amount,
          reason: `${milestone.count} referrals milestone`,
          expires_at: expiresAt.toISOString(),
        } as never);

        // For 5+ referrals, also grant auto-applies
        if (milestone.count === 5) {
          await supabase.from("referral_rewards" as never).insert({
            user_id: userId,
            reward_type: "auto_applies",
            amount: 5,
            reason: `${milestone.count} referrals milestone`,
          } as never);
        } else if (milestone.count === 10) {
          await supabase.from("referral_rewards" as never).insert({
            user_id: userId,
            reward_type: "auto_applies",
            amount: 10,
            reason: `${milestone.count} referrals milestone`,
          } as never);
        }
      }
    }
  }
}
