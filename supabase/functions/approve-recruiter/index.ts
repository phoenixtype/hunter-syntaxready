import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

const SITE_URL = Deno.env.get('SITE_URL') || 'https://usehunter.app';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate — must be a platform admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify acting user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: adminRow } = await supabase
      .from('platform_admins')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRow) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { applicationId, action, rejectionReason } = await req.json();
    // action: 'approve' | 'reject'

    if (!applicationId || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'applicationId and action (approve|reject) are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the application
    const { data: app, error: appError } = await supabase
      .from('recruiter_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !app) {
      return new Response(JSON.stringify({ error: 'Application not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (app.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Application is already ${app.status}` }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sendEmail, recruiterApprovedEmail, recruiterRejectedEmail } = await import('../_shared/resend.ts');

    if (action === 'approve') {
      // Generate signup link for the recruiter (magic link → they land on /recruiter)
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: app.email,
        options: {
          redirectTo: `${SITE_URL}/recruiter-setup`,
          data: {
            role: 'recruiter',
            recruiter_application_id: app.id,
            company_name: app.company_name,
          },
        },
      });

      if (linkError) {
        console.error('[APPROVE-RECRUITER] Failed to generate signup link:', linkError);
        // Fallback: send them to recruiter-portal page to sign up manually
      }

      const signupUrl = linkData?.properties?.action_link || `${SITE_URL}/recruiter-portal?approved=1&email=${encodeURIComponent(app.email)}`;

      // Send approval email
      const html = recruiterApprovedEmail({
        fullName: app.full_name,
        companyName: app.company_name,
        signupUrl,
      });
      await sendEmail({
        to: app.email,
        subject: "You're approved — set up your Hunter recruiter account",
        html,
      });

      // Update application status
      const { error: approveError } = await supabase
        .from('recruiter_applications')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('id', applicationId);

      if (approveError) {
        console.error('[APPROVE-RECRUITER] Failed to update application status:', approveError.message);
        return new Response(JSON.stringify({ error: 'Failed to update application status' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If the user already has a Hunter account, flip their role now
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', app.user_id)
        .maybeSingle();

      if (existingUser) {
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role: 'recruiter' })
          .eq('id', app.user_id);
        if (roleError) {
          console.error('[APPROVE-RECRUITER] Failed to update profile role:', roleError.message);
        }
      }

      // Audit log
      await supabase.from('platform_logs').insert({
        actor_id: user.id,
        action: 'recruiter_approved',
        entity_type: 'recruiter_application',
        entity_id: applicationId,
        metadata: { email: app.email, company: app.company_name },
      });

      return new Response(JSON.stringify({ success: true, action: 'approved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // Reject
      const html = recruiterRejectedEmail({
        fullName: app.full_name,
        companyName: app.company_name,
        reason: rejectionReason,
      });
      await sendEmail({
        to: app.email,
        subject: 'Update on your Hunter recruiter application',
        html,
      });

      await supabase
        .from('recruiter_applications')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
        })
        .eq('id', applicationId);

      await supabase.from('platform_logs').insert({
        actor_id: user.id,
        action: 'recruiter_rejected',
        entity_type: 'recruiter_application',
        entity_id: applicationId,
        metadata: { email: app.email, company: app.company_name, reason: rejectionReason },
      });

      return new Response(JSON.stringify({ success: true, action: 'rejected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[APPROVE-RECRUITER] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
