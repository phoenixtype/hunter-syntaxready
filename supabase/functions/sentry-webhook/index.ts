import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for preflight requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let payload;

    try {
      payload = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Sentry webhook payloads usually contain 'data' or 'event' objects
    // Extract core fields based on standard Sentry schema
    const data = payload.data || payload;
    const event = data.event || data.issue || data;

    const sentry_id = event.id || String(Date.now()); // Fallback
    const project_slug = event.project || 'unknown_project';
    const issue_title = event.title || event.message || 'Unknown Sentry Exception';
    const culprit = event.culprit || 'Unknown Culprit';
    const level = event.level || 'error';
    const status = event.status || 'unresolved';
    const url = event.url || payload.url || '';
    
    const { error } = await supabase
      .from('sentry_bugs')
      .upsert({
        sentry_id,
        project_slug,
        issue_title,
        culprit,
        level,
        status,
        url,
        metadata: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'sentry_id' });

    if (error) {
      console.error('Failed to insert Sentry bug', error);
      return new Response(JSON.stringify({ error: 'Failed to log bug to database' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: unknown) {
    console.error('Unhandled webhook error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
