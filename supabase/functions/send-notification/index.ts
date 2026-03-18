import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SITE_URL = Deno.env.get('SITE_URL') || 'https://usehunter.app';

// Design system colors
const BRAND = {
  primary: '#0d9488',
  primaryLight: '#14b8a6',
  primaryDark: '#0f766e',
  accent: '#10b981',
  bg: '#ffffff',
  bgSubtle: '#f0fdfa',
  bgMuted: '#f8fafc',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};

function emailLayout(title: string, previewText: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bgMuted}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.bgMuted};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: ${BRAND.primary}; width: 36px; height: 36px; border-radius: 10px; text-align: center; vertical-align: middle;">
                    <span style="color: #ffffff; font-weight: 700; font-size: 16px; line-height: 36px;">H</span>
                  </td>
                  <td style="padding-left: 10px;">
                    <span style="font-size: 20px; font-weight: 700; color: ${BRAND.text}; letter-spacing: -0.5px;">Hunter</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background: ${BRAND.bg}; border-radius: 16px; border: 1px solid ${BRAND.border}; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 24px 0; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: ${BRAND.textMuted};">
                Sent by <a href="${SITE_URL}" style="color: ${BRAND.primary}; text-decoration: none; font-weight: 500;">Hunter AI</a>
              </p>
              <p style="margin: 0; font-size: 12px; color: ${BRAND.textMuted};">
                <a href="${SITE_URL}/dashboard" style="color: ${BRAND.textMuted}; text-decoration: underline;">Manage notification preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface Job {
  title: string;
  company: string;
  location?: string;
  salary_range?: string;
  tech_stack?: string[];
  url: string;
}

interface ApplicationData {
  status: string;
  job_title?: string;
  company?: string;
}

interface WeeklyDigestData {
  applications_sent: number;
  new_jobs: number;
  interviews?: number;
}

function buildJobAlertEmail(jobs: Job[]): { subject: string; html: string } {
  const jobCards = jobs.map((job: Job) => `
    <tr>
      <td style="padding: 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden; margin-bottom: 12px;">
          <tr>
            <td style="padding: 20px;">
              <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: ${BRAND.text};">${job.title}</h3>
              <p style="margin: 0 0 12px; font-size: 14px; color: ${BRAND.textSecondary};">${job.company} · ${job.location || 'Remote'}</p>
              ${job.salary_range ? `<p style="margin: 0 0 12px; font-size: 13px; color: ${BRAND.primary}; font-weight: 600;">${job.salary_range}</p>` : ''}
              ${job.tech_stack?.length ? `<p style="margin: 0 0 12px; font-size: 12px; color: ${BRAND.textMuted};">${job.tech_stack.slice(0, 4).join(' · ')}</p>` : ''}
              <a href="${job.url}" style="display: inline-block; font-size: 13px; font-weight: 600; color: ${BRAND.primary}; text-decoration: none;">View Job →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const body = `
    <!-- Hero Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent}); padding: 40px 32px;">
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #ffffff;">🎯 New Job Matches</h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.85);">We found ${jobs.length} role${jobs.length > 1 ? 's' : ''} matching your profile</p>
      </td>
    </tr>
    <tr><td style="height: 24px;"></td></tr>
    ${jobCards}
    <tr>
      <td align="center" style="padding: 20px 32px 36px;">
        <a href="${SITE_URL}/dashboard" style="display: inline-block; background: ${BRAND.primary}; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 10px; text-decoration: none;">View All Jobs</a>
      </td>
    </tr>
  `;

  return {
    subject: `🎯 ${jobs.length} New Job${jobs.length > 1 ? 's' : ''} Match Your Profile`,
    html: emailLayout('New Job Matches', `${jobs.length} new jobs match your profile on Hunter AI`, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>`),
  };
}

function buildApplicationUpdateEmail(data: ApplicationData): { subject: string; html: string } {
  const statusColors: Record<string, string> = {
    applied: '#0d9488',
    interview: '#7c3aed',
    offer: '#16a34a',
    rejected: '#dc2626',
  };
  const statusColor = statusColors[data?.status?.toLowerCase()] || BRAND.primary;

  const body = `
    <tr>
      <td style="padding: 40px 32px;">
        <h1 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: ${BRAND.text};">📋 Application Update</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BRAND.bgSubtle}; border-radius: 12px; border: 1px solid ${BRAND.borderLight};">
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: ${BRAND.text};">${data?.job_title || 'Your Application'}</p>
              <p style="margin: 0 0 16px; font-size: 14px; color: ${BRAND.textSecondary};">${data?.company || 'Company'}</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background: ${statusColor}; color: #ffffff; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${data?.status || 'Updated'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 32px 36px;">
        <a href="${SITE_URL}/dashboard" style="display: inline-block; background: ${BRAND.primary}; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 10px; text-decoration: none;">View in Dashboard</a>
      </td>
    </tr>
  `;

  return {
    subject: `📋 Application Update: ${data?.job_title || 'Your Application'}`,
    html: emailLayout('Application Update', `Your application for ${data?.job_title} has been updated`, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>`),
  };
}

function buildWeeklyDigestEmail(data: WeeklyDigestData): { subject: string; html: string } {
  const body = `
    <!-- Hero Banner -->
    <tr>
      <td style="background: linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent}); padding: 40px 32px;">
        <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #ffffff;">📊 Your Weekly Digest</h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.85);">Here's how your job search is going</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <!-- Stats Grid -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding-right: 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BRAND.bgSubtle}; border-radius: 12px; border: 1px solid ${BRAND.borderLight};">
                <tr>
                  <td align="center" style="padding: 24px 16px;">
                    <div style="font-size: 36px; font-weight: 800; color: ${BRAND.primary}; line-height: 1;">${data?.applications_sent || 0}</div>
                    <div style="font-size: 12px; color: ${BRAND.textSecondary}; margin-top: 6px; font-weight: 500;">Applications Sent</div>
                  </td>
                </tr>
              </table>
            </td>
            <td width="50%" style="padding-left: 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BRAND.bgSubtle}; border-radius: 12px; border: 1px solid ${BRAND.borderLight};">
                <tr>
                  <td align="center" style="padding: 24px 16px;">
                    <div style="font-size: 36px; font-weight: 800; color: ${BRAND.primary}; line-height: 1;">${data?.new_jobs || 0}</div>
                    <div style="font-size: 12px; color: ${BRAND.textSecondary}; margin-top: 6px; font-weight: 500;">New Matches</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${data?.interviews ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px; background: ${BRAND.bgSubtle}; border-radius: 12px; border: 1px solid ${BRAND.borderLight};">
          <tr>
            <td align="center" style="padding: 24px 16px;">
              <div style="font-size: 36px; font-weight: 800; color: #7c3aed; line-height: 1;">${data.interviews}</div>
              <div style="font-size: 12px; color: ${BRAND.textSecondary}; margin-top: 6px; font-weight: 500;">Interviews Scheduled</div>
            </td>
          </tr>
        </table>` : ''}
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 0 32px 36px;">
        <a href="${SITE_URL}/dashboard" style="display: inline-block; background: ${BRAND.primary}; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 10px; text-decoration: none;">Open Dashboard</a>
      </td>
    </tr>
  `;

  return {
    subject: '📊 Your Weekly Job Hunt Digest',
    html: emailLayout('Weekly Digest', 'Your weekly job search progress summary from Hunter AI', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>`),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Rate Limiting
    const { RateLimiter } = await import("../_shared/rate-limiter.ts");
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const limiter = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('send-notification', {
      free: { max: 10, window: 60 },
      pro: { max: 50, window: 60 }
    });

    if (!allowed) {
      return new Response(JSON.stringify({ error: limitError }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

    let emailSubject = subject || 'Hunter AI Notification';
    let emailHtml = html || '';

    if (type === 'job_alert') {
      const result = buildJobAlertEmail(data?.jobs || []);
      emailSubject = result.subject;
      emailHtml = result.html;
    } else if (type === 'application_update') {
      const result = buildApplicationUpdateEmail(data);
      emailSubject = result.subject;
      emailHtml = result.html;
    } else if (type === 'weekly_digest') {
      const result = buildWeeklyDigestEmail(data);
      emailSubject = result.subject;
      emailHtml = result.html;
    }

    const recipientEmail = to || user.email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: 'No email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const emailResponse = await resend.emails.send({
      from: 'Hunter <notifications@usehunter.app>',
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
