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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      console.error('[RATE_LIMIT] Check failed, blocking request');
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[RATE_LIMIT] Exception during check, blocking request');
    return false;
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

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    // SECURITY: Don't reveal which service is missing
    if (!geminiApiKey) {
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
Key Skills: ${profile.skills?.slice(0, 5).map((s: { name: string }) => s.name).join(', ')}
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

Provide specific optimization suggestions as a list where each item starts with "- ".`;
    } else if (requestType === 'linkedin_optimization') {
      systemPrompt = `You are a LinkedIn profile expert. Provide specific, actionable profile optimization suggestions to help candidates stand out for their target role.`;
      userPrompt = `Optimize the LinkedIn profile for this candidate applying to ${job.title} at ${job.company}.

CANDIDATE:
Name: ${profile.identity?.name}
Current Role: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
Skills: ${profile.skills?.slice(0, 8).map((s: { name: string }) => s.name).join(', ')}

JOB TECH STACK: ${job.tech_stack?.join(', ') || 'Not specified'}
JOB DESCRIPTION: ${job.description?.substring(0, 500)}

Provide suggestions for: Headline, About section, Experience bullets, Skills to add, and Engagement tips.`;
    } else if (requestType === 'interview_prep') {
      systemPrompt = `You are an expert interview coach. Provide comprehensive, role-specific interview preparation.`;
      userPrompt = `Prepare interview tips for ${job.title} at ${job.company}.
Candidate skills: ${profile.skills?.slice(0, 5).map((s: { name: string }) => s.name).join(', ')}
Job description: ${job.description?.substring(0, 500)}
Include: likely questions, STAR story prompts, and key talking points.`;
    } else if (requestType === 'thank_you_note') {
      systemPrompt = `You are a career coach. Write a concise, genuine thank-you note after an interview.`;
      userPrompt = `Write a thank-you email for ${profile.identity?.name} after interviewing at ${job.company} for the ${job.title} role. Keep it under 150 words, professional, and personalized.`;
    } else if (requestType === 'offer_evaluation') {
      systemPrompt = `You are a compensation and negotiation expert. Analyze job offers and provide strategic advice.`;
      userPrompt = `Evaluate the offer for ${job.title} at ${job.company}.
Salary range listed: ${job.salary_range || 'Not specified'}
Candidate skills: ${profile.skills?.slice(0, 5).map((s: { name: string }) => s.name).join(', ')}
Provide: market rate analysis, negotiation leverage points, and recommended counter-offer strategy.`;
    } else if (requestType === 'resume_rewrite') {
      systemPrompt = `You are an expert resume writer. Rewrite the candidate's experience bullet points to be more impactful and targeted for the specific job. Rules:
- Use strong action verbs (Led, Built, Reduced, Improved, Delivered, Designed, Scaled, Automated)
- Quantify achievements with specific metrics where the original has numbers or you can reasonably infer them
- Mirror keywords from the job description naturally
- Keep each bullet concise (one line max)
- Preserve the factual accuracy of the original — do not invent companies, roles, or results
- Return ONLY a valid JSON array, no markdown, no explanation`;

      userPrompt = `Rewrite the experience bullets for this candidate to better match the target job.

TARGET JOB: ${job.title} at ${job.company}
JOB DESCRIPTION: ${(job.description || '').substring(0, 600)}
REQUIRED SKILLS: ${(job.tech_stack || []).join(', ')}

CANDIDATE EXPERIENCE:
${JSON.stringify(profile.experience_atoms?.slice(0, 3).map((e: { id: string; role: string; company: string; content: string }) => ({
  id: e.id,
  role: e.role,
  company: e.company,
  content: e.content
})))}

Return a JSON array — one object per experience entry in the same order:
[{"id": "...", "rewritten_content": "• Rewritten bullet 1\\n• Rewritten bullet 2\\n• Rewritten bullet 3"}]

Only include entries that have content to rewrite. Return the array and nothing else.`;
    }

    const llmResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${geminiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
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
