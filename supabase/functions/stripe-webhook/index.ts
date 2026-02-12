
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@^12.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2022-11-15',
});
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!endpointSecret) {
      return new Response('Webhook secret not present', { status: 400 });
  }

  try {
    const body = await req.text();
    let event;
    try {
        event = stripe.webhooks.constructEvent(body, signature!, endpointSecret);
    } catch (err) {
        return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.user_id || session.client_reference_id;
      const subscriptionId = session.subscription;
      const customerId = session.customer;

      if (userId) {
          // Upsert subscription
          const { error } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: userId,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                tier: 'pro',
                status: 'active',
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Approximate, real one comes from sub object usually
            }, { onConflict: 'user_id' });
            
          if (error) console.error('Error upserting subscription:', error);
      }
    } else if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const { error } = await supabase
            .from('subscriptions')
            .update({ status: 'canceled', tier: 'free' }) // or delete
            .eq('stripe_subscription_id', subscription.id);
         if (error) console.error('Error canceling subscription:', error);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
