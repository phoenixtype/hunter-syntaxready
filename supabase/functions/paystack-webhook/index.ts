import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

/**
 * Paystack Webhook Handler
 * Processes Paystack payment events for Nigerian users.
 *
 * Handles: subscription.create, subscription.not_renew, subscription.disable,
 *          charge.success, charge.failed
 */

// Verify Paystack webhook signature using HMAC-SHA512
async function verifyPaystackSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedSig = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSig === signature;
}

/** Map a Paystack plan name to our internal tier. */
function tierFromPlanName(planName: string | undefined): string {
  if (!planName) return 'pro';
  const lower = planName.toLowerCase();
  if (lower.includes('starter')) return 'starter';
  if (lower.includes('growth')) return 'growth';
  if (lower.includes('enterprise')) return 'enterprise';
  return 'pro';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!paystackSecretKey) {
      console.error('[PAYSTACK-WEBHOOK] Missing PAYSTACK_SECRET_KEY');
      return errorWithCors('Server configuration error', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      return errorWithCors('Missing x-paystack-signature header', 400);
    }

    // Verify webhook signature
    const isValid = await verifyPaystackSignature(body, signature, paystackSecretKey);
    if (!isValid) {
      console.error('[PAYSTACK-WEBHOOK] Invalid signature');
      return errorWithCors('Invalid signature', 401);
    }

    let event: any;
    try {
      event = JSON.parse(body);
    } catch {
      return errorWithCors('Invalid JSON body', 400);
    }

    console.log(`[PAYSTACK-WEBHOOK] Processing event: ${event.event}`);

    const data = event.data;

    switch (event.event) {
      // ── Subscription created ──────────────────────────────────────
      case 'subscription.create': {
        const userId = data.customer?.metadata?.user_id || data.metadata?.user_id;
        if (!userId) {
          console.warn('[PAYSTACK-WEBHOOK] subscription.create: no user_id in metadata');
          break;
        }

        const tier = tierFromPlanName(data.plan?.name);
        const periodStart = new Date();
        const periodEnd = new Date();
        if (data.plan?.interval === 'annually') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          // Default to 7 days (Weekly) as requested
          periodEnd.setDate(periodEnd.getDate() + 7);
        }

        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            tier,
            status: 'active',
            payment_provider: 'paystack',
            currency: 'ngn',
            paystack_customer_code: data.customer?.customer_code,
            paystack_subscription_code: data.subscription_code,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            cancel_at_period_end: false,
          }, { onConflict: 'user_id' });

        if (error) {
          console.error('[PAYSTACK-WEBHOOK] Failed to upsert subscription:', error.message);
        } else {
          console.log(`[PAYSTACK-WEBHOOK] Subscription activated: ${tier} for user ${userId}`);
        }
        break;
      }

      // ── Subscription disabled / not renewing ──────────────────────
      case 'subscription.not_renew':
      case 'subscription.disable': {
        if (!data.subscription_code) break;

        const status = event.event === 'subscription.disable' ? 'canceled' : 'canceled';

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status,
            cancel_at_period_end: true,
          })
          .eq('paystack_subscription_code', data.subscription_code);

        if (error) {
          console.error('[PAYSTACK-WEBHOOK] Failed to update subscription:', error.message);
        } else {
          console.log(`[PAYSTACK-WEBHOOK] Subscription ${data.subscription_code} → ${status}`);
        }
        break;
      }

      // ── Successful charge ─────────────────────────────────────────
      case 'charge.success': {
        const userId = data.metadata?.user_id;
        if (!userId) break;

        // Check if this is an overage purchase
        if (data.reference) {
          const { data: overagePurchase, error: fetchErr } = await supabase
            .from('overage_purchases')
            .select('id')
            .eq('stripe_payment_intent_id', data.reference)
            .eq('user_id', userId)
            .eq('status', 'pending')
            .maybeSingle();

          if (!fetchErr && overagePurchase) {
            await supabase
              .from('overage_purchases')
              .update({ status: 'succeeded' })
              .eq('id', overagePurchase.id);

            console.log(`[PAYSTACK-WEBHOOK] Overage purchase confirmed for user ${userId}`);
          }
        }

        // For subscription renewals, ensure the subscription stays active
        if (data.plan && data.customer?.metadata?.user_id) {
          await supabase
            .from('subscriptions')
            .update({ status: 'active' })
            .eq('user_id', userId)
            .eq('payment_provider', 'paystack');

          console.log(`[PAYSTACK-WEBHOOK] Subscription renewal confirmed for user ${userId}`);
        }

        console.log(`[PAYSTACK-WEBHOOK] Charge success: ₦${((data.amount || 0) / 100).toFixed(2)}`);
        break;
      }

      // ── Failed charge ─────────────────────────────────────────────
      case 'charge.failed': {
        const userId = data.metadata?.user_id;

        if (userId && data.reference) {
          // Mark any pending overage purchases as failed
          await supabase
            .from('overage_purchases')
            .update({ status: 'failed' })
            .eq('stripe_payment_intent_id', data.reference)
            .eq('user_id', userId)
            .eq('status', 'pending');
        }

        // If subscription payment failed, mark as past_due
        if (userId) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('user_id', userId)
            .eq('payment_provider', 'paystack');
        }

        console.log(`[PAYSTACK-WEBHOOK] Charge failed: ${data.reference}`);
        break;
      }

      default:
        console.log(`[PAYSTACK-WEBHOOK] Unhandled event: ${event.event}`);
    }

    return jsonWithCors({ received: true });

  } catch (error) {
    console.error('[PAYSTACK-WEBHOOK] Error:', error);
    return errorWithCors('Webhook handler failed', 500);
  }
});
