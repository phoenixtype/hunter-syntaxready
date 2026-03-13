import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !stripeSecretKey) {
      console.error('[STRIPE ERROR]: Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user session safely
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) {
      console.error('[AUTH ERROR]:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = authData.user;

    let priceId: string | undefined;
    try {
      const body = await req.json();
      priceId = body?.priceId;
    } catch {
      // Body consumption failed or not provided
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Helper to create a new Stripe customer
    const createCustomer = async () => {
      console.log(`[CHECKOUT] Creating new Stripe customer for: ${user.email}`);
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
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customer.id,
          tier: 'free',
          status: 'active'
        }, { onConflict: 'user_id' });
        
      if (upsertError) {
        console.error('[DB ERROR]: Failed to upsert customer ID', upsertError);
      }
        
      return customer.id;
    };

    // 2. Determine Price ID
    const stripePriceId = priceId || Deno.env.get('STRIPE_PRO_PRICE_ID');
    if (!stripePriceId) {
      console.error('[CHECKOUT ERROR]: STRIPE_PRO_PRICE_ID missing');
      return new Response(
        JSON.stringify({ error: 'Pricing not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Helper to create checkout session
    const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://hunter.syntaxready.com';
    
    const createSession = async (cid: string) => {
      console.log(`[CHECKOUT] Creating session for customer: ${cid}`);
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

    // 4. Initial attempt to find existing customer
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let cid = subData?.stripe_customer_id;

    if (!cid) {
      cid = await createCustomer();
    }

    let sessionRes = await createSession(cid);

    // 5. Self-healing logic for stale customer IDs
    if (!sessionRes.ok) {
      const errorData = await sessionRes.clone().json();
      
      if (errorData.error?.code === 'resource_missing' && errorData.error?.message?.includes('No such customer')) {
        console.warn(`[CHECKOUT] Customer ID ${cid} stale, recreating...`);
        cid = await createCustomer();
        sessionRes = await createSession(cid);
      }
    }

    // 6. Final response handling
    if (!sessionRes.ok) {
       const errorData = await sessionRes.json();
       console.error('[STRIPE SESSION FINAL ERROR]:', errorData);
       return new Response(
        JSON.stringify({ error: 'Checkout session creation failed', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await sessionRes.json();
    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CHECKOUT] Global Catch:', error);
    return new Response(
      JSON.stringify({ error: 'Internal system error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
