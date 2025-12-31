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

// Rate limit configuration: 5 requests per minute (moderate AI cost)
const RATE_LIMIT_MAX_REQUESTS = 5;
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
      JSON.stringify({ status: 'healthy', service: 'parse-resume', timestamp: new Date().toISOString() }),
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
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Use service role for rate limiting and database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Server-side rate limiting - check BEFORE any business logic
    const isAllowed = await checkRateLimit(
      supabase,
      user.id,
      'parse-resume',
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

    // SECURITY: Log only user ID, not email
    console.log('[AUTH] Authenticated user:', user.id);

    const { resumeText } = await req.json();

    if (!resumeText) {
      return new Response(
        JSON.stringify({ success: false, error: 'Resume text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // SECURITY: Don't reveal which service is missing
    if (!lovableApiKey) {
      console.error('[CONFIG] Missing required API key');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[PARSE] Parsing resume...');

    // Use tool calling to extract structured data
    const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert resume parser. Extract structured information from resumes with high accuracy.
            
For skills, estimate proficiency on a 0-1 scale based on:
- 0.9-1.0: Explicitly listed as expert/advanced, or has 5+ years experience
- 0.7-0.89: Listed prominently with substantial evidence
- 0.5-0.69: Mentioned with some context
- 0.3-0.49: Briefly mentioned

For experience atoms, extract each distinct role with its key accomplishments.
Extract keywords that would match job descriptions (technologies, methodologies, soft skills).`
          },
          {
            role: 'user',
            content: `Parse this resume and extract all relevant information:\n\n${resumeText.substring(0, 8000)}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_resume_data',
              description: 'Extract structured candidate profile from resume',
              parameters: {
                type: 'object',
                properties: {
                  identity: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Full name of the candidate' },
                      email: { type: 'string', description: 'Email address' },
                      links: { type: 'array', items: { type: 'string' }, description: 'LinkedIn, GitHub, portfolio URLs' }
                    },
                    required: ['name', 'email']
                  },
                  skills: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Skill name' },
                        proficiency: { type: 'number', description: 'Proficiency level 0-1' },
                        evidence: { type: 'array', items: { type: 'string' }, description: 'Evidence from resume' }
                      },
                      required: ['name', 'proficiency']
                    }
                  },
                  experience_atoms: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        company: { type: 'string' },
                        role: { type: 'string' },
                        duration: { type: 'string' },
                        content: { type: 'string', description: 'Key accomplishment or responsibility' },
                        keywords: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['company', 'role', 'content']
                    }
                  },
                  education: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        school: { type: 'string' },
                        degree: { type: 'string' },
                        year: { type: 'string' }
                      },
                      required: ['school', 'degree']
                    }
                  }
                },
                required: ['identity', 'skills', 'experience_atoms', 'education']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_resume_data' } }
      }),
    });

    if (!llmResponse.ok) {
      console.error('[PARSE] AI parsing failed');
      
      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: GENERIC_RATE_LIMIT_ERROR }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error('[PARSE] No valid response from AI');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse resume structure' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = JSON.parse(toolCall.function.arguments);
    
    // Add IDs to experience atoms if missing
    profile.experience_atoms = profile.experience_atoms.map((exp: any, idx: number) => ({
      ...exp,
      id: exp.id || `exp-${idx + 1}`
    }));

    // SECURITY: Log success without PII
    console.log('[PARSE] Successfully parsed resume');

    // Save to database using the authenticated user's ID
    const { error: upsertError } = await supabase
      .from('candidate_profiles')
      .upsert({
        user_id: user.id,
        identity: profile.identity,
        skills: profile.skills,
        experience_atoms: profile.experience_atoms,
        education: profile.education,
        raw_resume_text: resumeText.substring(0, 50000)
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('[DB] Failed to save profile');
    } else {
      console.log('[DB] Profile saved');
    }

    return new Response(
      JSON.stringify({ success: true, profile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // SECURITY: Never expose internal errors
    console.error('[ERROR] Parse resume error occurred');
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
