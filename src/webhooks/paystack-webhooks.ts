// Paystack webhook handlers for Nigerian payment processing
// Handles subscription events and payment confirmations

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PaystackEvent {
  event: string;
  data: {
    id?: number;
    customer?: {
      id: number;
      customer_code: string;
      email: string;
      metadata?: {
        user_id?: string;
      };
    };
    plan?: {
      id: number;
      plan_code: string;
      name: string;
      amount: number;
      interval: string;
    };
    subscription_code?: string;
    status?: string;
    amount?: number;
    reference?: string;
    authorization?: {
      authorization_code: string;
    };
    metadata?: {
      user_id?: string;
      plan_name?: string;
    };
  };
}

// Verify Paystack webhook signature
export function verifyPaystackWebhook(payload: string, signature: string): PaystackEvent {
  const secret = process.env.PAYSTACK_SECRET_KEY!;
  const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');

  if (hash !== signature) {
    throw new Error('Invalid Paystack webhook signature');
  }

  return JSON.parse(payload);
}

// Handle subscription creation
async function handleSubscriptionCreate(event: PaystackEvent) {
  console.log('📊 Processing Paystack subscription creation');

  const { data } = event;
  if (!data.customer || !data.plan || !data.subscription_code) {
    throw new Error('Invalid subscription creation event data');
  }

  // Extract user ID from customer metadata
  const userId = data.customer.metadata?.user_id || data.metadata?.user_id;
  if (!userId) {
    throw new Error('No user ID found in subscription metadata');
  }

  // Determine tier from plan name
  let tier = 'free';
  if (data.plan.name.toLowerCase().includes('pro')) {
    tier = 'pro';
  } else if (data.plan.name.toLowerCase().includes('enterprise')) {
    tier = 'enterprise';
  }

  // Calculate period end (Paystack subscriptions typically auto-renew)
  const periodStart = new Date();
  const periodEnd = new Date();
  if (data.plan.interval === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else if (data.plan.interval === 'annually') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  // Create or update subscription in database
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      tier,
      status: 'active',
      payment_provider: 'paystack',
      currency: 'ngn',
      paystack_customer_code: data.customer.customer_code,
      paystack_subscription_code: data.subscription_code,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  console.log(`✅ Created Paystack subscription: ${tier} for user ${userId}`);
}

// Handle subscription status changes
async function handleSubscriptionUpdate(event: PaystackEvent) {
  console.log('📊 Processing Paystack subscription update');

  const { data } = event;
  if (!data.subscription_code || !data.status) {
    throw new Error('Invalid subscription update event data');
  }

  // Map Paystack status to our status
  let status = 'active';
  switch (data.status) {
    case 'active':
      status = 'active';
      break;
    case 'cancelled':
    case 'non-renewing':
      status = 'canceled';
      break;
    case 'expired':
      status = 'expired';
      break;
    default:
      status = 'active';
  }

  // Update subscription status
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      cancel_at_period_end: status === 'canceled',
      updated_at: new Date().toISOString()
    })
    .eq('paystack_subscription_code', data.subscription_code);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log(`✅ Updated Paystack subscription ${data.subscription_code} to ${status}`);
}

// Handle successful payments
async function handlePaymentSuccess(event: PaystackEvent) {
  console.log('💰 Processing Paystack payment success');

  const { data } = event;
  if (!data.reference || !data.amount || !data.customer) {
    throw new Error('Invalid payment success event data');
  }

  // Check if this is an overage purchase
  if (data.metadata && data.metadata.user_id) {
    const userId = data.metadata.user_id;

    // Look for pending overage purchase with matching reference
    const { data: overagePurchase, error } = await supabase
      .from('overage_purchases')
      .select('*')
      .eq('stripe_payment_intent_id', data.reference) // Reusing this field for Paystack reference
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (!error && overagePurchase) {
      // Mark overage purchase as succeeded
      const { error: updateError } = await supabase
        .from('overage_purchases')
        .update({
          status: 'succeeded',
          updated_at: new Date().toISOString()
        })
        .eq('id', overagePurchase.id);

      if (updateError) {
        throw new Error(`Failed to update overage purchase: ${updateError.message}`);
      }

      console.log(`✅ Confirmed overage purchase: ${overagePurchase.quantity} ${overagePurchase.feature_name} credits`);
    }
  }

  // For subscription payments, we might want to extend the subscription period
  // This depends on Paystack's subscription handling
  console.log(`✅ Payment processed: ₦${(data.amount / 100).toFixed(2)}`);
}

// Handle failed payments
async function handlePaymentFailed(event: PaystackEvent) {
  console.log('❌ Processing Paystack payment failure');

  const { data } = event;

  if (data.metadata && data.metadata.user_id && data.reference) {
    const userId = data.metadata.user_id;

    // Mark any pending overage purchases as failed
    const { error } = await supabase
      .from('overage_purchases')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', data.reference)
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) {
      console.error(`Failed to update overage purchase status: ${error.message}`);
    }
  }

  console.log(`❌ Payment failed: ${data.reference}`);
}

// Main webhook handler
export async function handlePaystackWebhook(event: PaystackEvent): Promise<void> {
  console.log(`📨 Processing Paystack webhook: ${event.event}`);

  // Store webhook event for debugging
  await supabase
    .from('paystack_webhooks')
    .insert({
      event_type: event.event,
      webhook_data: event,
      paystack_event_id: event.data.id?.toString(),
      processed: false
    });

  try {
    switch (event.event) {
      case 'subscription.create':
        await handleSubscriptionCreate(event);
        break;
      case 'subscription.not_renew':
      case 'subscription.disable':
        await handleSubscriptionUpdate(event);
        break;
      case 'charge.success':
        await handlePaymentSuccess(event);
        break;
      case 'charge.failed':
        await handlePaymentFailed(event);
        break;
      default:
        console.log(`ℹ️ Unhandled Paystack event: ${event.event}`);
    }

    // Mark webhook as processed
    await supabase
      .from('paystack_webhooks')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('paystack_event_id', event.data.id?.toString());

  } catch (error) {
    console.error(`❌ Failed to process Paystack webhook ${event.event}:`, error);
    throw error;
  }
}

// Helper function to create overage purchase for Nigerian users
export async function createPaystackOveragePurchase(
  userId: string,
  featureName: string,
  quantity: number
): Promise<string> {
  // Get NGN overage rate
  const { data: userData, error: userError } = await supabase
    .rpc('check_feature_usage_limit', {
      p_user_id: userId,
      p_feature_name: featureName,
      p_requested_count: 1
    });

  if (userError) {
    throw new Error(`Failed to get user data: ${userError.message}`);
  }

  const userInfo = userData[0];
  const unitPrice = userInfo.currency === 'ngn' ?
    await getOverageRateNgn(userInfo.subscription_plan, featureName) :
    userInfo.overage_cost;

  void (quantity * unitPrice);

  // Create overage purchase record
  const { data: purchaseId, error } = await supabase.rpc('purchase_overage_credits', {
    p_user_id: userId,
    p_feature_name: featureName,
    p_quantity: quantity,
    p_payment_intent_id: `paystack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  });

  if (error) {
    throw new Error(`Failed to create overage purchase: ${error.message}`);
  }

  return purchaseId;
}

// Get NGN overage rate
async function getOverageRateNgn(planName: string, featureName: string): Promise<number> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('overage_rates')
    .eq('name', planName)
    .single();

  if (error) {
    throw new Error(`Failed to get plan data: ${error.message}`);
  }

  const ngnKey = `${featureName}_ngn`;
  return parseFloat(data.overage_rates[ngnKey] || data.overage_rates[featureName] * 1600);
}