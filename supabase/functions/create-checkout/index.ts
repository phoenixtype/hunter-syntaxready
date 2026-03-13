import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let priceId: string | undefined;
    try {
      const body = await req.json();
      priceId = body?.priceId;
    } catch {
      // No body sent — use default price
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already has a Stripe customer ID
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;

    // Helper to create a new Stripe customer
    const createCustomer = async () => {
      console.log('[CHECKOUT] Creating new Stripe customer for:', user.email);
      const res = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'email': user.email || '',
          'metadata[supabase_user_id]': user.id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('[STRIPE CUSTOMER ERROR]:', errorData);
        throw new Error('Failed to create Stripe customer');
      }

      const customer = await res.json();
      
      // Update our database with the new customer ID
      await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customer.id,
          tier: 'free',
          status: 'active'
        }, { onConflict: 'user_id' });
        
      return customer.id;
    };

    // Check if user already has a Stripe customer ID
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;

    if (!customerId) {
      customerId = await createCustomer();
    }

    const stripePriceId = priceId || Deno.env.get('STRIPE_PRO_PRICE_ID');

    if (!stripePriceId) {
      console.error('[CHECKOUT ERROR]: Pricing not configured (STRIPE_PRO_PRICE_ID missing)');
      return new Response(
        JSON.stringify({ error: 'Pricing not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use SITE_URL for redirects, validated against allowed origins
    const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'http://localhost:5173';

    // Helper to create checkout session
    const createSession = async (cid: string) => {
      console.log('[CHECKOUT] Creating session for customer:', cid, 'Price:', stripePriceId);
      return await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'customer': cid,
          'mode': 'subscription',
          'line_items[0][price]': stripePriceId,
          'line_items[0][quantity]': '1',
          'success_url': `${siteUrl}/dashboard?checkout=success`,
          'cancel_url': `${siteUrl}/dashboard?checkout=canceled`,
          'metadata[supabase_user_id]': user.id,
        }),
      });
    };

    let sessionRes = await createSession(customerId);

    // If the customer was not found (likely from a different account/env), recreate and try once more
    if (!sessionRes.ok) {
      const errorData = await sessionRes.json();
      
      if (errorData.error?.code === 'resource_missing' && errorData.error?.message?.includes('No such customer')) {
        console.warn('[CHECKOUT] Customer ID was stale, recreating...', customerId);
        customerId = await createCustomer();
        sessionRes = await createSession(customerId);
      } else {
        console.error('[STRIPE SESSION ERROR]:', errorData);
        return new Response(
          JSON.stringify({ error: 'Failed to create checkout session', details: errorData }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!sessionRes.ok) {
       const errorData = await sessionRes.json();
       console.error('[STRIPE SESSION FINAL ERROR]:', errorData);
       return new Response(
        JSON.stringify({ error: 'Failed to create checkout session after recreation', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  const session = await sessionRes.json();

  return new Response(
    JSON.stringify({ url: session.url, sessionId: session.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

} catch (error) {
  console.error('[CHECKOUT] Global Error:', error);
  return new Response(
    JSON.stringify({ error: 'Service temporarily unavailable', details: error instanceof Error ? error.message : String(error) }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
});
