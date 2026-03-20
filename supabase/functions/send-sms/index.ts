import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return jsonWithCors({ status: 'healthy' });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonWithCors({ error: 'Auth required' }, { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return jsonWithCors({ error: 'Invalid session' }, { status: 401 });
    }

    // Rate Limiting
    const { RateLimiter } = await import("../_shared/rate-limiter.ts");
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const limiter = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('send-sms', {
      free: { max: 5, window: 60 },
      pro: { max: 20, window: 60 }
    });

    if (!allowed) {
      return jsonWithCors({ error: limitError }, { status: 429 });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Twilio credentials not configured');
      return jsonWithCors({ error: 'SMS service not configured' }, { status: 500 });
    }

    const { to, message, type, data } = await req.json();

    if (!to) {
      return jsonWithCors({ error: 'Phone number required' }, { status: 400 });
    }

    // Build SMS message based on type
    let smsBody = message || '';

    if (type === 'job_alert') {
      const count = data?.count || 0;
      const topJob = data?.top_job;
      smsBody = `🎯 Hunter AI: ${count} new job${count > 1 ? 's' : ''} match your profile!`;
      if (topJob) {
        smsBody += ` Top: ${topJob.title} at ${topJob.company}`;
        if (topJob.salary_range) smsBody += ` (${topJob.salary_range})`;
      }
      smsBody += ` → Open app to view`;
    } else if (type === 'application_update') {
      smsBody = `📋 Hunter AI: Your application for ${data?.job_title} at ${data?.company} → ${data?.status}`;
    } else if (type === 'interview_reminder') {
      smsBody = `🎤 Hunter AI: Interview reminder for ${data?.job_title} at ${data?.company}. Good luck!`;
    }

    // Send via Twilio REST API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append('To', to);
    formData.append('From', fromNumber);
    formData.append('Body', smsBody);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('[SMS] Twilio error:', twilioData);
      return new Response(JSON.stringify({ error: `SMS failed: ${twilioData.message || 'Unknown error'}` }), {
        status: twilioResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[SMS] Sent successfully:', twilioData.sid);

    return jsonWithCors({ success: true, sid: twilioData.sid });
  } catch (error: unknown) {
    console.error('[SMS] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return jsonWithCors({ error: msg }, { status: 500 });
  }
});
