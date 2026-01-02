import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SECURITY: Generic error messages to avoid information disclosure
const GENERIC_SERVICE_ERROR = 'Service temporarily unavailable';
const GENERIC_AUTH_ERROR = 'Authentication required';
const GENERIC_RATE_LIMIT_ERROR = 'Too many requests. Please try again later.';

// Rate limit configuration: 10 requests per minute (cheaper generation)
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * SECURITY: Server-side rate limiting using Supabase
 */
async function checkRateLimit(
  supabase: any,
  userId: string,
  functionName: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_function_name: functionName,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });

    if (error) {
      console.error('[RATE_LIMIT] Check failed, allowing request');
      return true;
    }

    return data === true;
  } catch (err) {
    console.error('[RATE_LIMIT] Exception during check');
    return true;
  }
}

/**
 * SECURITY: Detect health check / crawler requests
 */
function isHealthCheckRequest(req: Request): boolean {
  const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';
  const isProbe = 
    userAgent.includes('supabase') ||
    userAgent.includes('healthcheck') ||
    userAgent.includes('uptime') ||
    userAgent.includes('monitoring') ||
    userAgent.includes('crawler') ||
    userAgent.includes('bot') ||
    userAgent === '';
  
  const isHealthMethod = req.method === 'HEAD' || 
    (req.method === 'GET' && !req.headers.get('Authorization'));
  
  return isProbe || isHealthMethod;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // HEALTH CHECK: Return 200 OK for crawlers/probes
  if (isHealthCheckRequest(req)) {
    return new Response(
      JSON.stringify({ status: 'healthy', service: 'generate-content', timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_AUTH_ERROR }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // SECURITY: Validate config server-side only
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[SECURITY] Missing required configuration');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('[AUTH] Token verification failed');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_AUTH_ERROR }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for rate limiting
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Server-side rate limiting - check BEFORE any business logic
    const isAllowed = await checkRateLimit(
      supabase,
      user.id,
      'generate-content',
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_SECONDS
    );

    if (!isAllowed) {
      console.log('[RATE_LIMIT] User rate limited:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_RATE_LIMIT_ERROR }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS)
          } 
        }
      );
    }

    // SECURITY: Log only user ID
    console.log('[AUTH] Authenticated user:', user.id);

    const { profile, job, type } = await req.json();

    if (!profile || !job) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile and job are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // SECURITY: Don't reveal which service is missing
    if (!lovableApiKey) {
      console.error('[CONFIG] Missing required API key');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestType = type || 'cover_letter';
    console.log(`[GENERATE] Generating ${requestType}`);

    let systemPrompt = '';
    let userPrompt = '';

    if (requestType === 'cover_letter') {
      systemPrompt = `You are an expert career coach and cover letter writer. Write compelling, personalized cover letters that:
- Open with a hook that shows genuine interest in the company
- Highlight 2-3 specific achievements that match the job requirements
- Use concrete numbers and metrics where available
- Sound authentic, not generic or AI-generated
- Are concise (under 300 words)
- End with a clear call to action`;

      userPrompt = `Write a personalized cover letter for this candidate applying to this job:

CANDIDATE PROFILE:
Name: ${profile.identity?.name}
Current/Recent Role: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
Key Skills: ${profile.skills?.slice(0, 5).map((s: any) => s.name).join(', ')}
Recent Achievement: ${profile.experience_atoms?.[0]?.content}

JOB DETAILS:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description}

Write a compelling cover letter that connects the candidate's experience to this specific role.`;
    } else if (requestType === 'resume_optimization') {
      systemPrompt = `You are an expert resume optimizer. Analyze the candidate's profile against the job and provide:
1. Specific bullet point rewrites that better match the job keywords
2. Skills to emphasize or add
3. Quantifiable achievements to highlight
4. ATS optimization suggestions`;

      userPrompt = `Optimize this resume for the target job:

CANDIDATE SKILLS: ${JSON.stringify(profile.skills?.slice(0, 8))}
EXPERIENCE: ${JSON.stringify(profile.experience_atoms?.slice(0, 3))}

TARGET JOB:
${job.title} at ${job.company}
${job.description}

Provide specific optimization suggestions.`;
    } else if (requestType === 'interview_prep') {
      systemPrompt = `You are an expert interview coach. Provide comprehensive prep.`;
      userPrompt = `Prepare interview for ${job.title} at ${job.company}.`;
    } else if (requestType === 'thank_you_note') {
      systemPrompt = `You are a career coach. Write a thank-you note.`;
      userPrompt = `Write thank-you for ${profile.identity?.name} at ${job.company}.`;
    } else if (requestType === 'offer_evaluation') {
      systemPrompt = `You are a negotiation expert. Evaluate the offer.`;
      userPrompt = `Evaluate offer for ${job.title} at ${job.company}.`;
    }

    const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!llmResponse.ok) {
      console.error('[GENERATE] AI generation failed');
      
      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: GENERIC_RATE_LIMIT_ERROR }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'No content generated' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[GENERATE] Successfully generated ${requestType}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        content,
        type: requestType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // SECURITY: Never expose internal errors
    console.error('[ERROR] Generate content error occurred');
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
