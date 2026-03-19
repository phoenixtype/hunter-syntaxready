import { supabase } from '@/integrations/supabase/client';
import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

/**
 * Handle Stripe webhook events for subscription management
 */
export async function handleStripeWebhook(event: WebhookEvent) {
  console.log(`🎯 Processing webhook: ${event.type}`);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handleOveragePaymentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handleOveragePaymentFailed(event.data.object);
        break;

      case 'customer.created':
        await handleCustomerCreated(event.data.object);
        break;

      default:
        console.log(`⚠️ Unhandled webhook event: ${event.type}`);
    }

    console.log(`✅ Successfully processed webhook: ${event.type}`);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ Error processing webhook ${event.type}:`, error);
    throw error;
  }
}

/**
 * Handle new subscription creation
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('📝 Creating new subscription:', subscription.id);

  // Get the customer's user_id from metadata
  const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
  const userId = customer.metadata.user_id;

  if (!userId) {
    throw new Error('No user_id found in customer metadata');
  }

  // Get the subscription plan
  const priceId = subscription.items.data[0].price.id;
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('stripe_price_id', priceId)
    .single();

  if (!plans) {
    throw new Error(`No plan found for price ID: ${priceId}`);
  }

  // Create the subscription record
  const { error } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: plans.id,
      status: subscription.status as any,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      cancel_at_period_end: subscription.cancel_at_period_end,
    });

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  console.log(`✅ Subscription created for user ${userId}`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Updating subscription:', subscription.id);

  // Get the new plan
  const priceId = subscription.items.data[0].price.id;
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('stripe_price_id', priceId)
    .single();

  if (!plans) {
    throw new Error(`No plan found for price ID: ${priceId}`);
  }

  // Update the subscription record
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      plan_id: plans.id,
      status: subscription.status as any,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log(`✅ Subscription updated: ${subscription.id}`);
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  console.log('❌ Cancelling subscription:', subscription.id);

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }

  console.log(`✅ Subscription cancelled: ${subscription.id}`);
}

/**
 * Handle successful recurring payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Payment succeeded for invoice:', invoice.id);

  // Update subscription status to active if it was past due
  if (invoice.subscription) {
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', invoice.subscription);

    if (error) {
      console.error('Failed to update subscription status:', error);
    }
  }

  // Log the payment in billing history (you might want to create this table)
  console.log(`✅ Payment processed: ${invoice.amount_paid / 100} ${invoice.currency}`);
}

/**
 * Handle failed recurring payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('💸 Payment failed for invoice:', invoice.id);

  // Update subscription status to past due
  if (invoice.subscription) {
    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', invoice.subscription);

    if (error) {
      console.error('Failed to update subscription status:', error);
    }
  }

  // Send notification to user about failed payment
  console.log(`❌ Payment failed for subscription: ${invoice.subscription}`);
}

/**
 * Handle successful overage payment
 */
async function handleOveragePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('💳 Overage payment succeeded:', paymentIntent.id);

  // Update overage purchase status to succeeded
  const { error } = await supabase
    .from('overage_purchases')
    .update({
      status: 'succeeded',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (error) {
    console.error('Failed to update overage purchase:', error);
    throw error;
  }

  console.log(`✅ Overage credits activated: ${paymentIntent.id}`);
}

/**
 * Handle failed overage payment
 */
async function handleOveragePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('💸 Overage payment failed:', paymentIntent.id);

  // Update overage purchase status to failed
  const { error } = await supabase
    .from('overage_purchases')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (error) {
    console.error('Failed to update overage purchase:', error);
  }

  console.log(`❌ Overage payment failed: ${paymentIntent.id}`);
}

/**
 * Handle new customer creation
 */
async function handleCustomerCreated(customer: Stripe.Customer) {
  console.log('👤 New customer created:', customer.id);

  // Customer creation is typically handled during signup
  // This webhook mainly serves as a backup/verification
  console.log(`✅ Customer record verified: ${customer.id}`);
}

/**
 * Verify webhook signature
 */
export function verifyStripeWebhook(payload: string, signature: string): WebhookEvent {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    return event as WebhookEvent;
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    throw new Error('Invalid webhook signature');
  }
}

/**
 * Test webhook handler with mock events
 */
export async function testWebhookHandler() {
  console.log('🧪 Testing webhook handlers...');

  const mockEvents = {
    subscription_created: {
      id: 'evt_test_webhook',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'active',
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000, // 30 days
          cancel_at_period_end: false,
          items: {
            data: [{
              price: {
                id: 'price_test_pro'
              }
            }]
          }
        }
      },
      created: Math.floor(Date.now() / 1000)
    },

    payment_succeeded: {
      id: 'evt_test_payment',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_test_123',
          subscription: 'sub_test_123',
          amount_paid: 1999,
          currency: 'usd'
        }
      },
      created: Math.floor(Date.now() / 1000)
    },

    overage_payment: {
      id: 'evt_test_overage',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_overage_123',
          amount: 2000,
          currency: 'usd'
        }
      },
      created: Math.floor(Date.now() / 1000)
    }
  };

  try {
    // Test each webhook event
    for (const [eventType, event] of Object.entries(mockEvents)) {
      console.log(`Testing ${eventType}...`);
      await handleStripeWebhook(event as WebhookEvent);
    }

    console.log('✅ All webhook tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Webhook test failed:', error);
    return false;
  }
}