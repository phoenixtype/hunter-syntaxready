import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPaymentConfirmationEmail } from "../_shared/email-templates.ts";

const SITE_URL = Deno.env.get('SITE_URL') || 'https://usehunter.app';
const FROM = 'Hunter <notifications@usehunter.app>';


function paymentFailedEmail(): { subject: string; html: string } {
  return {
    subject: 'Action required: Hunter Pro payment failed',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding-bottom:32px;">
  <div style="background:#0d9488;width:40px;height:40px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
    <span style="color:#fff;font-weight:700;font-size:18px;">H</span>
  </div>
</td></tr>
<tr><td style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;padding:32px;">
  <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#0f172a;">Payment failed</h2>
  <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">We couldn't process your Hunter Pro subscription payment. To keep your Pro access, please update your payment method.</p>
  <div style="text-align:center;margin-bottom:24px;">
    <a href="${SITE_URL}/dashboard?billing=true" style="display:inline-block;background:#0d9488;color:#fff;font-size:14px;font-weight:600;padding:14px 36px;border-radius:8px;text-decoration:none;">Update Payment Method</a>
  </div>
  <p style="margin:0;font-size:13px;color:#94a3b8;">If you need help, contact <a href="mailto:support@syntaxready.com" style="color:#0d9488;">support@syntaxready.com</a></p>
</td></tr>
</table></td></tr></table></body></html>`,
  };
}

async function sendTransactionalEmail(type: string, to: string, data?: any) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;

  try {
    let email: { subject: string; html: string } | null = null;

    if (type === 'pro_activated' && data) {
      email = buildPaymentConfirmationEmail({
        tier: data.tier || 'pro',
        amount: data.amount || 19.99,
        currency: data.currency || 'usd',
        paymentProvider: data.paymentProvider || 'stripe',
        userName: data.userName
      });
    } else if (type === 'payment_failed') {
      // Keep existing payment failed template for now
      email = paymentFailedEmail();
    }

    if (!email) return;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: email.subject,
        html: email.html
      }),
    });

    console.log(`[WEBHOOK] Email sent: ${type} → ${to}`);
  } catch (err) {
    console.warn('[WEBHOOK] Non-critical email send failed:', err);
  }
}

function getCorsHeaders(req: Request) {
  const siteUrl = Deno.env.get('SITE_URL') || '';
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = siteUrl ? siteUrl : origin;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  };
}

// Verify Stripe webhook signature using HMAC-SHA256
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, part) => {
    const [key, value] = part.split('=');
    acc[key.trim()] = value;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];

  if (!timestamp || !signature) return false;

  // Reject events older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.error('[WEBHOOK] Timestamp too old, possible replay attack');
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSig === signature;
}

/** Map a Stripe price ID to our internal tier name. Falls back to 'pro'. */
function tierFromPriceId(priceId: string | undefined): string {
  if (!priceId) return 'pro';
  const starterPrice = Deno.env.get('STRIPE_RECRUITER_STARTER_PRICE_ID');
  const growthPrice  = Deno.env.get('STRIPE_RECRUITER_GROWTH_PRICE_ID');
  if (starterPrice && priceId === starterPrice) return 'recruiter_starter';
  if (growthPrice  && priceId === growthPrice)  return 'recruiter_growth';
  return 'pro'; // default: candidate pro plan
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!stripeSecretKey || !stripeWebhookSecret) {
      console.error('[WEBHOOK] Missing Stripe configuration');
      return new Response('Server configuration error', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    // Verify webhook signature
    const isValid = await verifyStripeSignature(body, sig, stripeWebhookSecret);
    if (!isValid) {
      console.error('[WEBHOOK] Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any;
    try {
      event = JSON.parse(body);
    } catch {
      console.error('[WEBHOOK] Failed to parse event body');
      return new Response('Invalid JSON body', { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error('[WEBHOOK] No user ID in session metadata');
          break;
        }

        // Determine tier from plan_type metadata set at checkout creation time
        const tier = tierFromPriceId(session.metadata?.price_id);

        // Grant access immediately — customer.subscription.created fires separately and fills in period dates.
        const { error: upsertError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            tier,
            status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          }, { onConflict: 'user_id' });

        if (upsertError) {
          console.error('[WEBHOOK] Failed to upsert subscription:', upsertError.message);
        } else {
          console.log('[WEBHOOK] Pro access granted for user:', userId);
          // Send Pro activation email (non-blocking)
          const { data: authUser } = await supabase.auth.admin.getUserById(userId);
          if (authUser?.user?.email) {
            sendTransactionalEmail('pro_activated', authUser.user.email, {
              tier,
              amount: session.amount_total / 100, // Convert from cents
              currency: session.currency === 'ngn' ? 'ngn' : 'usd',
              paymentProvider: 'stripe',
              userName: authUser.user.user_metadata?.full_name || authUser.user.email
            });
          }
        }

        // Enrich with subscription period dates (blocking — ensures data is complete)
        if (subscriptionId) {
          try {
            const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
              headers: { 'Authorization': `Bearer ${stripeSecretKey}` },
            });
            if (subRes.ok) {
              const stripeSub = await subRes.json();
              await supabase
                .from('subscriptions')
                .update({
                  status: stripeSub.status,
                  stripe_price_id: stripeSub.items?.data?.[0]?.price?.id,
                  current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
                  current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: stripeSub.cancel_at_period_end,
                })
                .eq('user_id', userId);
            }
          } catch (err) {
            console.warn('[WEBHOOK] Subscription enrichment failed:', err);
          }
        }
        break;
      }

      // Fired when a subscription is first created (e.g. after checkout.session.completed).
      // We handle this to catch cases where checkout.session.completed is delayed or missed.
      case 'customer.subscription.created': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (existingSub) {
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';
          const tier = isActive ? tierFromPriceId(priceId) : 'free';

          await supabase
            .from('subscriptions')
            .update({
              tier,
              status: subscription.status,
              stripe_subscription_id: subscription.id,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              stripe_price_id: priceId,
            })
            .eq('user_id', existingSub.user_id);
        } else {
          // No existing row means checkout.session.completed hasn't run yet —
          // the metadata.supabase_user_id is on the checkout session, not the subscription.
          // Log and let checkout.session.completed handle it.
          console.warn('[WEBHOOK] subscription.created: no matching customer row for', customerId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (existingSub) {
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const isActive = subscription.status === 'active' || subscription.status === 'trialing';
          const tier = isActive ? tierFromPriceId(priceId) : 'free';

          await supabase
            .from('subscriptions')
            .update({
              tier,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              stripe_price_id: subscription.items?.data?.[0]?.price?.id,
            })
            .eq('user_id', existingSub.user_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (existingSub) {
          await supabase
            .from('subscriptions')
            .update({
              tier: 'free',
              status: 'canceled',
              cancel_at_period_end: false,
            })
            .eq('user_id', existingSub.user_id);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (existingSub) {
          // Fetch current price from existing sub row to preserve tier on renewal
          const { data: subRow } = await supabase
            .from('subscriptions')
            .select('stripe_price_id, tier')
            .eq('user_id', existingSub.user_id)
            .maybeSingle();
          const tier = tierFromPriceId(subRow?.stripe_price_id) || subRow?.tier || 'pro';
          await supabase
            .from('subscriptions')
            .update({ tier, status: 'active' })
            .eq('user_id', existingSub.user_id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (existingSub) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('user_id', existingSub.user_id);

          // Send payment failed alert (non-blocking)
          const { data: authUser } = await supabase.auth.admin.getUserById(existingSub.user_id);
          if (authUser?.user?.email) {
            sendTransactionalEmail('payment_failed', authUser.user.email);
          }
        }
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return new Response('Webhook handler failed', { status: 500 });
  }
});
