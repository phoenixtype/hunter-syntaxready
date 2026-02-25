import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Response(JSON.stringify({ status: 'healthy' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Auth required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const resend = new Resend(resendKey);
    const { type, to, subject, html, data } = await req.json();

    // Build email based on type
    let emailSubject = subject || 'Hunter AI Notification';
    let emailHtml = html || '';

    if (type === 'job_alert') {
      const jobs = data?.jobs || [];
      emailSubject = `🎯 ${jobs.length} New Jobs Match Your Profile`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0d9488, #10b981); padding: 24px; border-radius: 12px; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎯 New Job Matches</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Found ${jobs.length} roles matching your profile</p>
          </div>
          ${jobs.map((job: any) => `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
              <h3 style="margin: 0 0 4px; font-size: 16px; color: #1f2937;">${job.title}</h3>
              <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">${job.company} • ${job.location || 'Remote'}</p>
              ${job.salary_range ? `<p style="margin: 0 0 8px; font-size: 13px; color: #0d9488; font-weight: 600;">${job.salary_range}</p>` : ''}
              <a href="${job.url}" style="color: #0d9488; font-size: 13px; text-decoration: none;">View Job →</a>
            </div>
          `).join('')}
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
            Sent by Hunter AI • <a href="${Deno.env.get('SITE_URL') || 'https://hunter-syntaxready.lovable.app'}/dashboard" style="color: #0d9488;">Manage notifications</a>
          </p>
        </div>
      `;
    } else if (type === 'application_update') {
      emailSubject = `📋 Application Update: ${data?.job_title || 'Your Application'}`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1f2937;">Application Status Update</h2>
          <p>Your application for <strong>${data?.job_title}</strong> at <strong>${data?.company}</strong> has been updated to: <strong>${data?.status}</strong></p>
          <a href="${Deno.env.get('SITE_URL') || 'https://hunter-syntaxready.lovable.app'}/dashboard" style="display: inline-block; background: #0d9488; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 16px;">View in Dashboard</a>
        </div>
      `;
    } else if (type === 'weekly_digest') {
      emailSubject = `📊 Your Weekly Job Hunt Digest`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0d9488, #10b981); padding: 24px; border-radius: 12px; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0;">📊 Weekly Digest</h1>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
            <div style="background: #f0fdfa; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: 700; color: #0d9488;">${data?.applications_sent || 0}</div>
              <div style="font-size: 12px; color: #6b7280;">Applications Sent</div>
            </div>
            <div style="background: #f0fdfa; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="font-size: 28px; font-weight: 700; color: #0d9488;">${data?.new_jobs || 0}</div>
              <div style="font-size: 12px; color: #6b7280;">New Matches</div>
            </div>
          </div>
          <a href="${Deno.env.get('SITE_URL') || 'https://hunter-syntaxready.lovable.app'}/dashboard" style="display: inline-block; background: #0d9488; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Open Dashboard</a>
        </div>
      `;
    }

    const recipientEmail = to || user.email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'No email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const emailResponse = await resend.emails.send({
      from: 'Hunter AI <notifications@resend.dev>',
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log('[EMAIL] Sent successfully:', emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('[EMAIL] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
