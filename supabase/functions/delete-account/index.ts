import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

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

    const uid = user.id;

    // Service role client — bypasses RLS, can delete from any table and auth.users
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Nullify non-CASCADE nullable FK columns that would block auth user deletion
    //    (tables that reference auth.users without ON DELETE CASCADE)
    await admin.from('recruiter_outreach').delete().eq('candidate_id', uid);
    await admin.from('platform_logs').update({ actor_id: null }).eq('actor_id', uid);
    await admin.from('recruiter_applications').update({ reviewed_by: null }).eq('reviewed_by', uid);

    // 2. Delete all user data from tables WITH cascade (belt-and-suspenders, catches any
    //    rows that might linger before the auth delete propagates the cascade).
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
      { table: 'platform_admins',        column: 'user_id' },
      { table: 'users',                  column: 'id' },
      { table: 'profiles',               column: 'id' },
    ];

    await Promise.allSettled(
      tables.map(({ table, column }) => admin.from(table).delete().eq(column, uid))
    );

    // 3. Delete the auth user — cascades to any remaining FK-linked rows
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
