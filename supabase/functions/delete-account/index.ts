import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorWithCors('Authentication required', 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the calling user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return errorWithCors('Invalid session', 401);
    }

    // Parse optional target_user_id from request body
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      if (body?.target_user_id) {
        targetUserId = body.target_user_id;
      }
    } catch {
      // No body or invalid JSON — self-deletion mode
    }

    // Determine if this is an admin deletion of another user
    const isAdminDeletion = targetUserId && targetUserId !== user.id;

    if (isAdminDeletion) {
      // Validate UUID format
      if (!UUID_RE.test(targetUserId)) {
        return errorWithCors('Invalid target_user_id format', 400);
      }
    }

    // Service role client — bypasses RLS, can delete from any table and auth.users
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let uid = user.id;

    if (isAdminDeletion) {
      // 1. Verify caller is a root admin
      const { data: callerAdmin } = await admin
        .from('platform_admins')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!callerAdmin || callerAdmin.role !== 'root') {
        return errorWithCors('Forbidden: root admin access required', 403);
      }

      // 2. Prevent deletion of other root admins
      const { data: targetAdmin } = await admin
        .from('platform_admins')
        .select('role')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (targetAdmin?.role === 'root') {
        return errorWithCors('Cannot delete a root admin', 403);
      }

      // 3. Verify target user exists
      const { data: targetUser, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
      if (targetError || !targetUser?.user) {
        return errorWithCors('User not found', 404);
      }

      // 4. Cancel Stripe subscription if active
      const { data: sub } = await admin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (sub?.stripe_subscription_id) {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (stripeKey) {
          try {
            await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${stripeKey}` },
            });
            console.log('[DELETE-ACCOUNT] Cancelled Stripe subscription:', sub.stripe_subscription_id);
          } catch (stripeErr) {
            console.error('[DELETE-ACCOUNT] Stripe cancel failed (continuing):', stripeErr);
          }
        }
      }

      // 5. Audit log
      await admin.from('platform_logs').insert({
        actor_id: user.id,
        action: 'admin_delete_user',
        entity_type: 'user',
        entity_id: targetUserId,
      });

      uid = targetUserId;
      console.log(`[DELETE-ACCOUNT] Root admin ${user.id} deleting user ${uid}`);
    }

    // Cancel Stripe subscription for self-deletion (admin deletion handled above)
    if (!isAdminDeletion) {
      const { data: selfSub } = await admin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', uid)
        .maybeSingle();

      if (selfSub?.stripe_subscription_id) {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (stripeKey) {
          try {
            await fetch(`https://api.stripe.com/v1/subscriptions/${selfSub.stripe_subscription_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${stripeKey}` },
            });
            console.log('[DELETE-ACCOUNT] Cancelled Stripe subscription:', selfSub.stripe_subscription_id);
          } catch (stripeErr) {
            console.error('[DELETE-ACCOUNT] Stripe cancel failed (continuing):', stripeErr);
          }
        }
      }
    }

    // Nullify non-CASCADE nullable FK columns that would block auth user deletion
    await admin.from('recruiter_outreach').delete().eq('candidate_id', uid);
    await admin.from('platform_logs').update({ actor_id: null }).eq('actor_id', uid);
    await admin.from('recruiter_applications').update({ reviewed_by: null }).eq('reviewed_by', uid);

    // Delete recruiter applications by user_id so re-registration with same email works
    await admin.from('recruiter_applications').delete().eq('user_id', uid);
    // Also clear any applications matched by email (no user_id set yet)
    const userEmail = isAdminDeletion
      ? (await admin.auth.admin.getUserById(uid)).data?.user?.email
      : user.email;
    if (userEmail) {
      await admin.from('recruiter_applications').delete().eq('email', userEmail.toLowerCase().trim());
    }

    // Delete all user data from tables WITH cascade (belt-and-suspenders)
    const tables: Array<{ table: string; column: string }> = [
      { table: 'agent_activity_logs',    column: 'user_id' },
      { table: 'application_history',    column: 'user_id' },
      { table: 'candidate_profiles',     column: 'user_id' },
      { table: 'compliance_metrics',     column: 'user_id' },
      { table: 'feedback_actions',       column: 'user_id' },
      { table: 'learning_weights',       column: 'user_id' },
      { table: 'tailored_resumes',       column: 'user_id' },
      { table: 'user_preferences',       column: 'user_id' },
      { table: 'subscriptions',          column: 'user_id' },
      { table: 'subscription_usage',     column: 'user_id' },
      { table: 'usage_tracking',         column: 'user_id' },
      { table: 'overage_purchases',      column: 'user_id' },
      { table: 'usage_alerts',           column: 'user_id' },
      { table: 'rate_limits',            column: 'user_id' },
      { table: 'notification_preferences', column: 'user_id' },
      { table: 'notification_queue',     column: 'user_id' },
      { table: 'notification_history',   column: 'user_id' },
      { table: 'recruiter_outreach',     column: 'recruiter_id' },
      { table: 'recruiter_profiles',     column: 'user_id' },
      { table: 'recruiter_job_applications', column: 'candidate_id' },
      { table: 'referral_rewards',        column: 'user_id' },
      { table: 'referral_events',         column: 'referrer_id' },
      { table: 'referral_events',         column: 'referred_id' },
      { table: 'referral_codes',          column: 'owner_id' },
      { table: 'platform_admins',        column: 'user_id' },
      { table: 'users',                  column: 'id' },
      { table: 'profiles',               column: 'id' },
    ];

    await Promise.allSettled(
      tables.map(({ table, column }) => admin.from(table).delete().eq(column, uid))
    );

    // Delete the auth user — cascades to any remaining FK-linked rows
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) {
      console.error('[DELETE-ACCOUNT] Auth delete failed:', deleteError.message);
      return errorWithCors(`Failed to delete auth record: ${deleteError.message}`, 500);
    }

    console.log('[DELETE-ACCOUNT] Fully deleted user:', uid);
    return jsonWithCors({ success: true });

  } catch (error) {
    console.error('[DELETE-ACCOUNT] Unexpected error:', error);
    return errorWithCors('Internal server error', 500);
  }
});
