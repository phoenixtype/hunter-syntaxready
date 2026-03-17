/**
 * Shared Resend email client for Hunter edge functions.
 * All transactional emails are sent from notifications@usehunter.app
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const FROM = 'Hunter <notifications@usehunter.app>';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://usehunter.app';

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error('[RESEND] RESEND_API_KEY not set');
    return { ok: false, error: 'Email service not configured' };
  }

  const body = {
    from: payload.from || FROM,
    to: Array.isArray(payload.to) ? payload.to : [payload.to],
    subject: payload.subject,
    html: payload.html,
    ...(payload.reply_to ? { reply_to: payload.reply_to } : {}),
  };

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) return { ok: true };

      // Rate limit — exponential backoff
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }

      const err = await res.json().catch(() => ({}));
      lastError = (err as { message?: string }).message || `HTTP ${res.status}`;
      console.error(`[RESEND] Error (attempt ${attempt + 1}):`, lastError);
      break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Network error';
      console.error(`[RESEND] Exception (attempt ${attempt + 1}):`, lastError);
    }
  }

  return { ok: false, error: lastError };
}

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const PRIMARY = '#1a73e8';         // MD3 blue
const PRIMARY_DARK = '#1557b0';
const BG = '#f8fafc';
const CARD_BG = '#ffffff';
const TEXT = '#1e293b';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';

/** Base HTML wrapper shared by all templates */
function baseTemplate(opts: {
  previewText: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;color:${BG};">${opts.previewText}</div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BG};">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

        <!-- Logo header -->
        <tr><td style="padding:0 0 24px 0;text-align:center;">
          <a href="${SITE_URL}" style="text-decoration:none;">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;border-radius:50%;background:${PRIMARY};display:inline-block;line-height:36px;text-align:center;">
                <span style="color:#fff;font-size:18px;font-weight:700;">H</span>
              </div>
              <span style="color:${TEXT};font-size:20px;font-weight:700;letter-spacing:-0.5px;">Hunter</span>
            </div>
          </a>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;padding:40px 40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          ${opts.body}

          ${opts.cta ? `
          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0;">
            <tr><td align="center">
              <a href="${opts.cta.href}" target="_blank"
                style="display:inline-block;background:${PRIMARY};color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:100px;letter-spacing:0.1px;">
                ${opts.cta.label}
              </a>
            </td></tr>
          </table>` : ''}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          ${opts.footer ? `<p style="color:${MUTED};font-size:13px;margin:0 0 8px;">${opts.footer}</p>` : ''}
          <p style="color:${MUTED};font-size:12px;margin:0;">
            © ${new Date().getFullYear()} Hunter AI ·
            <a href="${SITE_URL}/privacy" style="color:${MUTED};text-decoration:underline;">Privacy</a> ·
            <a href="${SITE_URL}/terms" style="color:${MUTED};text-decoration:underline;">Terms</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Template builders ─────────────────────────────────────────────────────────

/** Recruiter application received — sent to applicant immediately after submission */
export function recruiterApplicationReceivedEmail(opts: {
  fullName: string;
  companyName: string;
}): string {
  return baseTemplate({
    previewText: `We've received your application to join Hunter as a recruiter, ${opts.fullName}.`,
    title: 'Application Received — Hunter',
    body: `
      <h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Application received</h1>
      <p style="color:${MUTED};font-size:15px;margin:0 0 24px;">We'll review it and get back to you within 2 business days.</p>

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${opts.fullName},</p>
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">
        Thanks for applying to join Hunter as a recruiter for <strong>${opts.companyName}</strong>.
        We review all applications manually to maintain the quality of our talent network.
      </p>
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 24px;">
        You'll receive an email within 2 business days once your application has been reviewed.
      </p>

      <!-- What happens next -->
      <div style="background:${BG};border:1px solid ${BORDER};border-radius:12px;padding:20px 24px;margin:0 0 8px;">
        <p style="color:${TEXT};font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 12px;">What happens next</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="28" valign="top" style="padding-top:2px;">
              <div style="width:20px;height:20px;border-radius:50%;background:${PRIMARY};text-align:center;line-height:20px;">
                <span style="color:#fff;font-size:11px;font-weight:700;">1</span>
              </div>
            </td>
            <td style="padding-left:12px;padding-bottom:12px;">
              <p style="color:${TEXT};font-size:14px;margin:0;font-weight:500;">Application review</p>
              <p style="color:${MUTED};font-size:13px;margin:4px 0 0;">Our team verifies your company details</p>
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="padding-top:2px;">
              <div style="width:20px;height:20px;border-radius:50%;background:${PRIMARY};text-align:center;line-height:20px;">
                <span style="color:#fff;font-size:11px;font-weight:700;">2</span>
              </div>
            </td>
            <td style="padding-left:12px;padding-bottom:12px;">
              <p style="color:${TEXT};font-size:14px;margin:0;font-weight:500;">Approval email</p>
              <p style="color:${MUTED};font-size:13px;margin:4px 0 0;">You'll get a link to set up your recruiter account</p>
            </td>
          </tr>
          <tr>
            <td width="28" valign="top" style="padding-top:2px;">
              <div style="width:20px;height:20px;border-radius:50%;background:${PRIMARY};text-align:center;line-height:20px;">
                <span style="color:#fff;font-size:11px;font-weight:700;">3</span>
              </div>
            </td>
            <td style="padding-left:12px;">
              <p style="color:${TEXT};font-size:14px;margin:0;font-weight:500;">Start hiring</p>
              <p style="color:${MUTED};font-size:13px;margin:4px 0 0;">Post jobs and access Hunter's AI-matched talent pool</p>
            </td>
          </tr>
        </table>
      </div>
    `,
    footer: 'Questions? Reply to this email or contact us at support@usehunter.app',
  });
}

/** Recruiter approved — sent when admin approves the application */
export function recruiterApprovedEmail(opts: {
  fullName: string;
  companyName: string;
  signupUrl: string;
}): string {
  return baseTemplate({
    previewText: `Great news — your Hunter recruiter application has been approved!`,
    title: 'You\'re approved — Hunter',
    body: `
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;width:56px;height:56px;background:#dcfce7;border-radius:50%;line-height:56px;text-align:center;margin-bottom:16px;">
          <span style="font-size:28px;">✓</span>
        </div>
        <h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">You're approved!</h1>
        <p style="color:${MUTED};font-size:15px;margin:0;">Your recruiter account is ready to set up</p>
      </div>

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${opts.fullName},</p>
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 24px;">
        We've reviewed your application for <strong>${opts.companyName}</strong> and you're in.
        Click the button below to complete your account setup and start posting jobs to Hunter's talent network.
      </p>
    `,
    cta: {
      label: 'Set up your recruiter account →',
      href: opts.signupUrl,
    },
    footer: 'This invitation link expires in 72 hours. Questions? Reply to this email.',
  });
}

/** Recruiter rejected — sent when admin rejects */
export function recruiterRejectedEmail(opts: {
  fullName: string;
  companyName: string;
  reason?: string;
}): string {
  return baseTemplate({
    previewText: `An update on your Hunter recruiter application`,
    title: 'Application Update — Hunter',
    body: `
      <h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Application update</h1>
      <p style="color:${MUTED};font-size:15px;margin:0 0 24px;">Thank you for your interest in Hunter</p>

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${opts.fullName},</p>
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">
        Thank you for applying to join Hunter as a recruiter for <strong>${opts.companyName}</strong>.
        After careful review, we're unable to approve your application at this time.
      </p>
      ${opts.reason ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin:0 0 16px;">
        <p style="color:#b91c1c;font-size:14px;margin:0;"><strong>Note from our team:</strong> ${opts.reason}</p>
      </div>` : ''}
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 24px;">
        You're welcome to reapply in the future if your situation changes. If you have questions,
        simply reply to this email.
      </p>
    `,
    footer: 'Questions about this decision? Reply to this email.',
  });
}

/** Recruiter outreach — sent to a candidate on behalf of a recruiter */
export function recruiterOutreachEmail(opts: {
  candidateName: string;
  recruiterName: string;
  companyName: string;
  jobTitle?: string;
  subject: string;
  message: string;
}): string {
  const escapedMessage = opts.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

  return baseTemplate({
    previewText: `${opts.recruiterName} from ${opts.companyName} wants to connect with you on Hunter`,
    title: `Message from ${opts.companyName} — Hunter`,
    body: `
      <h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">A recruiter wants to connect</h1>
      ${opts.jobTitle ? `<p style="color:${MUTED};font-size:15px;margin:0 0 24px;">Regarding: <strong style="color:${TEXT};">${opts.jobTitle}</strong> at ${opts.companyName}</p>` : `<p style="color:${MUTED};font-size:15px;margin:0 0 24px;">From ${opts.companyName}</p>`}

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${opts.candidateName},</p>

      <div style="background:${BG};border-left:3px solid ${PRIMARY};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
        <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0;">${escapedMessage}</p>
      </div>

      <p style="color:${MUTED};font-size:13px;line-height:1.7;margin:0 0 8px;">
        This message was sent by <strong style="color:${TEXT};">${opts.recruiterName}</strong> at <strong style="color:${TEXT};">${opts.companyName}</strong> via Hunter.
        Reply directly to this email to respond.
      </p>
      <p style="color:${MUTED};font-size:13px;margin:0;">
        You're receiving this because you have enabled recruiter outreach in your Hunter preferences.
        You can turn this off in your <a href="${SITE_URL}/settings" style="color:${PRIMARY};text-decoration:underline;">account settings</a>.
      </p>
    `,
    cta: { label: 'View your Hunter profile →', href: `${SITE_URL}/dashboard` },
    footer: 'Hunter connects active job seekers with top companies.',
  });
}

/** New user welcome — sent after account creation */
export function welcomeEmail(opts: { fullName: string }): string {
  return baseTemplate({
    previewText: `Welcome to Hunter — your autonomous job search starts now`,
    title: 'Welcome to Hunter',
    body: `
      <h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Welcome to Hunter 🎯</h1>
      <p style="color:${MUTED};font-size:15px;margin:0 0 24px;">Your AI-powered career engine is ready</p>

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${opts.fullName || 'there'},</p>
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 24px;">
        Hunter is now working in the background — discovering jobs, tailoring your applications,
        and coaching you for interviews. Here's how to get the most out of it:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
        ${[
          ['📄', 'Upload your resume', 'Hunter parses it instantly and builds your candidate profile'],
          ['🎯', 'Set your preferences', 'Role, location, salary — Hunter targets exactly what you want'],
          ['🤖', 'Enable auto-apply', 'Let Hunter apply to matched jobs on autopilot'],
          ['🎤', 'Practice with Dexter', 'Your AI coach for interview and negotiation prep'],
        ].map(([icon, title, desc]) => `
        <tr>
          <td width="40" valign="top" style="padding-bottom:16px;">
            <div style="width:32px;height:32px;background:${BG};border:1px solid ${BORDER};border-radius:8px;text-align:center;line-height:32px;font-size:16px;">${icon}</div>
          </td>
          <td style="padding-left:12px;padding-bottom:16px;">
            <p style="color:${TEXT};font-size:14px;font-weight:600;margin:0;">${title}</p>
            <p style="color:${MUTED};font-size:13px;margin:4px 0 0;">${desc}</p>
          </td>
        </tr>`).join('')}
      </table>
    `,
    cta: { label: 'Go to your dashboard →', href: `${SITE_URL}/dashboard` },
    footer: 'You\'re receiving this because you created a Hunter account.',
  });
}
