/**
 * Unified Email Template System for Hunter
 * Supports payment confirmations, job alerts, and usage warnings
 * with proper Hunter branding for both Stripe and Paystack
 */

const SITE_URL = Deno.env.get('SITE_URL') || 'https://usehunter.app';

// ─── Hunter Brand Colors ──────────────────────────────────────────────────────
const PRIMARY = '#0d9488';         // Hunter primary (teal-600)
const ACCENT = '#10b981';           // Hunter accent (emerald-500)
void '#0f766e'; // teal-700 (PRIMARY_DARK - reserved)
const BG = '#f8fafc';              // slate-50
const CARD_BG = '#ffffff';
const TEXT = '#1e293b';            // slate-800
const TEXT_MUTED = '#64748b';      // slate-500
const BORDER = '#e2e8f0';          // slate-200
const SUCCESS_BG = '#ecfdf5';      // emerald-50
const SUCCESS_BORDER = '#d1fae5';  // emerald-200
const _WARNING_BG = '#fef3c7';      // amber-100
const WARNING_BORDER = '#f59e0b';  // amber-500

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface EmailResult {
  subject: string;
  html: string;
}

export interface PaymentConfirmationOptions {
  tier: string;
  amount: number;
  currency: 'usd' | 'ngn';
  paymentProvider: 'stripe' | 'paystack';
  userName: string;
}

export interface JobAlertOptions {
  userName: string;
  jobs: Array<{
    title: string;
    company: string;
    location: string;
    salary?: string;
    url: string;
  }>;
  totalMatches: number;
}

export interface UsageWarningOptions {
  userName: string;
  featureName: string;
  usagePercent: number;
  remaining: number;
  limit: number;
  resetDate: string;
}

// ─── Currency Formatting ──────────────────────────────────────────────────────
function formatCurrency(amount: number, currency: 'usd' | 'ngn'): string {
  if (currency === 'ngn') {
    return `₦${new Intl.NumberFormat('en-NG').format(amount)}`;
  }
  return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(amount)}`;
}

// ─── Base Template ────────────────────────────────────────────────────────────
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
          ${opts.footer ? `<p style="color:${TEXT_MUTED};font-size:13px;margin:0 0 8px;">${opts.footer}</p>` : ''}
          <p style="color:${TEXT_MUTED};font-size:12px;margin:0;">
            © ${new Date().getFullYear()} Hunter AI ·
            <a href="${SITE_URL}/privacy" style="color:${TEXT_MUTED};text-decoration:underline;">Privacy</a> ·
            <a href="${SITE_URL}/terms" style="color:${TEXT_MUTED};text-decoration:underline;">Terms</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Feature Lists ────────────────────────────────────────────────────────────
const TIER_FEATURES = {
  pro: [
    '100 job applications',
    '50 resume generations',
    '25 AI interview sessions',
    '100 cover letters',
    '500 job matches',
    '200 company research reports',
    '10 skill assessments'
  ],
  free: [
    '10 job applications',
    '5 resume generations',
    '3 AI interview sessions',
    '10 cover letters',
    '50 job matches',
    '20 company research reports',
    '2 skill assessments'
  ]
};

// ─── Payment Confirmation Email ───────────────────────────────────────────────
export function buildPaymentConfirmationEmail(opts: PaymentConfirmationOptions): EmailResult {
  const formattedAmount = formatCurrency(opts.amount, opts.currency);
  const tierName = opts.tier.charAt(0).toUpperCase() + opts.tier.slice(1);
  const features = TIER_FEATURES[opts.tier as keyof typeof TIER_FEATURES] || TIER_FEATURES.pro;

  const subject = `Welcome to Hunter ${tierName}! Your payment is confirmed`;

  const html = baseTemplate({
    previewText: `Welcome to Hunter ${tierName} — ${formattedAmount} payment confirmed via ${opts.paymentProvider}`,
    title: subject,
    body: `
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-block;width:56px;height:56px;background:${SUCCESS_BG};border:1px solid ${SUCCESS_BORDER};border-radius:50%;line-height:56px;text-align:center;margin-bottom:16px;">
          <span style="font-size:28px;color:${ACCENT};">✓</span>
        </div>
        <h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Welcome to Hunter ${tierName}!</h1>
        <p style="color:${TEXT_MUTED};font-size:15px;margin:0;">Payment confirmed via ${opts.paymentProvider}</p>
      </div>

      <div style="background:${SUCCESS_BG};border:1px solid ${SUCCESS_BORDER};border-radius:12px;padding:20px 24px;margin:0 0 24px;text-align:center;">
        <p style="color:${TEXT};font-size:32px;font-weight:700;margin:0 0 4px;">${formattedAmount}</p>
        <p style="color:${TEXT_MUTED};font-size:14px;margin:0;">Hunter ${tierName} • Monthly subscription</p>
      </div>

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${opts.userName},</p>
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 24px;">
        Your Hunter ${tierName} subscription is now active! You now have access to all premium features to supercharge your job search.
      </p>

      <!-- Features -->
      <div style="background:${BG};border:1px solid ${BORDER};border-radius:12px;padding:20px 24px;margin:0 0 8px;">
        <p style="color:${TEXT};font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 16px;">Your ${tierName} features</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${features.map(feature => `
          <tr>
            <td width="24" valign="top" style="padding-bottom:8px;">
              <div style="width:16px;height:16px;border-radius:50%;background:${ACCENT};text-align:center;line-height:16px;">
                <span style="color:#fff;font-size:10px;font-weight:700;">✓</span>
              </div>
            </td>
            <td style="padding-left:12px;padding-bottom:8px;">
              <p style="color:${TEXT};font-size:14px;margin:0;">${feature}</p>
            </td>
          </tr>`).join('')}
        </table>
      </div>
    `,
    cta: {
      label: 'Start using Hunter Pro →',
      href: `${SITE_URL}/dashboard`
    },
    footer: `Payment processed securely via ${opts.paymentProvider}. Questions? Reply to this email.`,
  });

  return { subject, html };
}

// ─── Job Alert Email ──────────────────────────────────────────────────────────
export function buildJobAlertEmail(opts: JobAlertOptions): EmailResult {
  const subject = `${opts.jobs.length} new job matches found`;

  const html = baseTemplate({
    previewText: `${opts.jobs.length} new job opportunities match your preferences`,
    title: subject,
    body: `
      <h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">New job matches</h1>
      <p style="color:${TEXT_MUTED};font-size:15px;margin:0 0 24px;">${opts.jobs.length} opportunities that match your preferences</p>

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${opts.userName},</p>
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 24px;">
        Hunter found ${opts.jobs.length} new job opportunities that match your preferences. Here are the top matches:
      </p>

      <!-- Job Cards -->
      ${opts.jobs.slice(0, 3).map(job => `
      <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;padding:20px 24px;margin:0 0 16px;">
        <h3 style="color:${TEXT};font-size:16px;font-weight:600;margin:0 0 8px;">${job.title}</h3>
        <p style="color:${TEXT_MUTED};font-size:14px;margin:0 0 4px;"><strong style="color:${TEXT};">${job.company}</strong> • ${job.location}</p>
        ${job.salary ? `<p style="color:${ACCENT};font-size:14px;font-weight:600;margin:0 0 16px;">${job.salary}</p>` : '<div style="height:8px;"></div>'}
        <a href="${job.url}" target="_blank" style="display:inline-block;background:${BG};color:${PRIMARY};font-size:14px;font-weight:600;text-decoration:none;padding:8px 16px;border:1px solid ${BORDER};border-radius:6px;">
          View job →
        </a>
      </div>`).join('')}

      ${opts.totalMatches > opts.jobs.length ? `
      <div style="background:${BG};border:1px solid ${BORDER};border-radius:8px;padding:16px 20px;margin:0 0 8px;text-align:center;">
        <p style="color:${TEXT};font-size:14px;margin:0;">
          <strong>${opts.totalMatches - opts.jobs.length} more matches</strong> available in your dashboard
        </p>
      </div>` : ''}
    `,
    cta: {
      label: 'View all matches →',
      href: `${SITE_URL}/jobs`
    },
    footer: 'Job alerts are sent based on your search preferences. Update them anytime in your dashboard.',
  });

  return { subject, html };
}

// ─── Usage Warning Email ──────────────────────────────────────────────────────
export function buildUsageWarningEmail(opts: UsageWarningOptions): EmailResult {
  const subject = `${opts.featureName} usage at ${opts.usagePercent}% - ${opts.remaining} remaining`;
  const progressColor = opts.usagePercent >= 90 ? '#dc2626' : opts.usagePercent >= 75 ? WARNING_BORDER : ACCENT;

  const html = baseTemplate({
    previewText: `You've used ${opts.usagePercent}% of your ${opts.featureName} limit this month`,
    title: subject,
    body: `
      <h1 style="color:${TEXT};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Usage alert</h1>
      <p style="color:${TEXT_MUTED};font-size:15px;margin:0 0 24px;">You're approaching your monthly limit</p>

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${opts.userName},</p>
      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0 0 24px;">
        You've used <strong>${opts.usagePercent}%</strong> of your ${opts.featureName} limit this month.
      </p>

      <!-- Usage Progress -->
      <div style="background:${BG};border:1px solid ${BORDER};border-radius:12px;padding:24px;margin:0 0 24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h3 style="color:${TEXT};font-size:16px;font-weight:600;margin:0;">${opts.featureName}</h3>
          <span style="color:${TEXT_MUTED};font-size:14px;">${opts.limit - opts.remaining}/${opts.limit}</span>
        </div>

        <!-- Progress bar -->
        <div style="background:#f1f5f9;height:8px;border-radius:4px;overflow:hidden;margin-bottom:12px;">
          <div style="background:${progressColor};height:100%;width:${opts.usagePercent}%;border-radius:4px;"></div>
        </div>

        <p style="color:${TEXT_MUTED};font-size:13px;margin:0;">
          <strong style="color:${TEXT};">${opts.remaining} remaining</strong> until ${opts.resetDate}
        </p>
      </div>

      ${opts.usagePercent >= 90 ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin:0 0 16px;">
        <p style="color:#b91c1c;font-size:14px;margin:0;">
          <strong>Action needed:</strong> You're close to your limit. Consider upgrading to continue using ${opts.featureName}.
        </p>
      </div>` : ''}

      <p style="color:${TEXT};font-size:15px;line-height:1.7;margin:0;">
        Your usage resets on <strong>${opts.resetDate}</strong>.
        ${opts.usagePercent >= 75 ? 'To avoid interruptions, consider upgrading your plan.' : 'We\'ll send another alert if you reach 90%.'}
      </p>
    `,
    cta: opts.usagePercent >= 75 ? {
      label: 'Upgrade plan →',
      href: `${SITE_URL}/settings/billing`
    } : {
      label: 'View usage details →',
      href: `${SITE_URL}/settings/usage`
    },
    footer: 'Usage alerts help you stay informed about your plan limits.',
  });

  return { subject, html };
}