import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

console.log("Create-checkout function initialized");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      console.error('[STRIPE ERROR]: STRIPE_SECRET_KEY not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize clients
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Validate User
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('[AUTH ERROR]:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let priceId: string | undefined;
    try {
      const body = await req.json();
      priceId = body?.priceId;
    } catch {
      // Body empty or malformed
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripePriceId = priceId || Deno.env.get('STRIPE_PRO_PRICE_ID');

    if (!stripePriceId) {
      console.error('[CHECKOUT ERROR]: Pricing ID missing');
      return new Response(
        JSON.stringify({ error: 'Pricing not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper: Create Customer
    const createCustomer = async () => {
      console.log(`[CHECKOUT] Creating Stripe customer for: ${user.email}`);
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
        const error = await res.json();
        console.error('[STRIPE CUSTOMER ERR]:', error);
        throw new Error('Customer creation failed');
      }

      const customer = await res.json();
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

    // Helper: Create Session
    const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://hunter.syntaxready.com';
    const createSession = async (cid: string) => {
      console.log(`[CHECKOUT] Creating session for: ${cid}`);
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

    // Main Logic
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let cid = sub?.stripe_customer_id;
    if (!cid) cid = await createCustomer();

    let sessionRes = await createSession(cid);

    // Self-healing for stale customers
    if (!sessionRes.ok) {
      const errorData = await sessionRes.clone().json();
      if (errorData.error?.code === 'resource_missing' && errorData.error?.message?.includes('No such customer')) {
        console.warn(`[CHECKOUT] Recreating stale customer: ${cid}`);
        cid = await createCustomer();
        sessionRes = await createSession(cid);
      }
    }

    if (!sessionRes.ok) {
       const errorData = await sessionRes.json();
       console.error('[STRIPE SESSION ERR]:', errorData);
       return new Response(
        JSON.stringify({ error: 'Checkout failed', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await sessionRes.json();
    console.log('[CHECKOUT] Success:', session.id);
    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CHECKOUT] Global Exception:', error);
    return new Response(
      JSON.stringify({ error: 'Local server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
