import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-connection-pool-size',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the calling user is a recruiter
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: recruiter }, error: authError } = await authClient.auth.getUser();
    if (authError || !recruiter) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: recruiterProfile } = await authClient.from('profiles').select('role, full_name').eq('id', recruiter.id).maybeSingle();
    const rp = recruiterProfile as { role: string; full_name: string | null } | null;
    if (!rp || (rp.role !== 'recruiter' && rp.role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'Recruiter access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { candidateId, subject, message, jobId, outreachType = 'email' } = await req.json();

    if (!candidateId || !subject?.trim() || !message?.trim()) {
      return new Response(JSON.stringify({ error: 'candidateId, subject, and message are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify candidate has opted in
    const { data: candidatePrefs } = await admin
      .from('user_preferences')
      .select('auto_apply_enabled')
      .eq('user_id', candidateId)
      .maybeSingle();

    if (!(candidatePrefs as { auto_apply_enabled: boolean } | null)?.auto_apply_enabled) {
      return new Response(JSON.stringify({ error: 'This candidate has not opted in to recruiter outreach' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get candidate email via admin API
    const { data: candidateAuthUser } = await admin.auth.admin.getUserById(candidateId);
    const candidateEmail = candidateAuthUser?.user?.email;
    if (!candidateEmail) {
      return new Response(JSON.stringify({ error: 'Could not resolve candidate email' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get candidate name for personalisation
    const { data: candidateProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', candidateId)
      .maybeSingle();
    const candidateName = (candidateProfile as { full_name: string | null } | null)?.full_name ?? 'there';

    // Get recruiter company for the email
    const { data: recruiterCompanyRow } = await admin
      .from('recruiter_profiles')
      .select('company_name')
      .eq('user_id', recruiter.id)
      .maybeSingle();
    const companyName = (recruiterCompanyRow as { company_name: string } | null)?.company_name ?? rp.full_name ?? 'A Hunter recruiter';

    // Get job details if provided
    let jobTitle: string | null = null;
    if (jobId) {
      const { data: job } = await admin.from('recruiter_jobs').select('title').eq('id', jobId).maybeSingle();
      jobTitle = (job as { title: string } | null)?.title ?? null;
    }

    // Send email
    const { sendEmail, recruiterOutreachEmail } = await import('../_shared/resend.ts');
    const html = recruiterOutreachEmail({
      candidateName,
      recruiterName: rp.full_name ?? companyName,
      companyName,
      jobTitle: jobTitle ?? undefined,
      subject,
      message,
    });

    const emailResult = await sendEmail({
      to: candidateEmail,
      subject,
      html,
      reply_to: recruiter.email ?? undefined,
    });

    if (!emailResult.ok) {
      console.error('[RECRUITER-OUTREACH] Email send failed:', emailResult.error);
      return new Response(JSON.stringify({ error: `Email delivery failed: ${emailResult.error}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record the outreach
    const { error: insertError } = await admin.from('recruiter_outreach').insert({
      recruiter_id: recruiter.id,
      candidate_id: candidateId,
      recruiter_job_id: jobId ?? null,
      outreach_type: outreachType,
      subject,
      message,
      status: 'sent',
    });
    if (insertError) {
      console.error('[RECRUITER-OUTREACH] Failed to record outreach:', insertError.message);
      // Non-fatal: email was sent, but log the DB failure
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[RECRUITER-OUTREACH] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
