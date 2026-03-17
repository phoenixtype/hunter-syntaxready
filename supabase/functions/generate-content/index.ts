import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// SECURITY: Generic error messages to avoid information disclosure
const GENERIC_SERVICE_ERROR = 'Service temporarily unavailable';
const GENERIC_AUTH_ERROR = 'Authentication required';
const GENERIC_RATE_LIMIT_ERROR = 'Too many requests. Please try again later.';

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

    // SECURITY: Server-side rate limiting with pro/free tier support
    const { RateLimiter } = await import('../_shared/rate-limiter.ts');
    const limiter = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('generate-content', {
      free: { max: 10, window: 60 },
      pro:  { max: 40, window: 60 },
    });

    if (!allowed) {
      console.log('[RATE_LIMIT] User rate limited:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: limitError || GENERIC_RATE_LIMIT_ERROR }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
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

    const requestType = type || 'cover_letter';
    console.log(`[GENERATE] Generating ${requestType}`);

    let systemPrompt = '';
    let userPrompt = '';

    if (requestType === 'cover_letter') {
      systemPrompt = `You are Dexter, Hunter's elite career coach AI. You write cover letters that get candidates hired at top companies.

Your cover letters:
- Open with a compelling, specific hook tied to the company's mission or a recent achievement (NOT "I am writing to apply…")
- Weave 2–3 of the candidate's strongest, quantified achievements directly into the narrative
- Mirror the exact language and keywords from the job description — ATS systems score this
- Sound like a real, excited human wrote it — warm, confident, never robotic
- Stay under 280 words — hiring managers don't read long letters
- Close with a specific, confident call to action ("I'd love to discuss how I can help X achieve Y")

Never use: "I am excited to apply", "I believe I would be a great fit", "To whom it may concern"`;

      userPrompt = `Write a highly personalised cover letter for this candidate.

CANDIDATE:
Name: ${profile.identity?.name}
Most Recent Role: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
Top Skills: ${profile.skills?.slice(0, 6).map((s: { name: string }) => s.name).join(', ')}
Key Experience: ${(profile.experience_atoms?.[0]?.content || '').substring(0, 400)}
Professional Summary: ${profile.summary || 'Not provided'}

TARGET ROLE:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Salary Range: ${job.salary_range || 'Not listed'}
Job Description: ${(job.description || '').substring(0, 800)}

Write the complete cover letter text only — no subject line, no "Dear Hiring Manager" placeholder needed unless it sounds natural. Make it specific, human, and compelling.`;

    } else if (requestType === 'resume_optimization') {
      systemPrompt = `You are Dexter, Hunter's resume optimization AI. You help candidates beat ATS systems and impress human reviewers.

Your analysis identifies:
1. Missing keywords from the job description that must be added to pass ATS
2. Weak bullet points to strengthen with action verbs and metrics
3. Skills gaps to address
4. Structural improvements for better ATS parsing
5. Specific rewrite examples, not just generic advice`;

      userPrompt = `Analyse and optimise this resume for the target role. Be specific — give actual rewrite examples.

CANDIDATE SKILLS: ${profile.skills?.slice(0, 10).map((s: { name: string; proficiency: number }) => s.name).join(', ')}
EXPERIENCE SUMMARY:
${profile.experience_atoms?.slice(0, 3).map((e: { role: string; company: string; content: string }) =>
  `${e.role} at ${e.company}: ${(e.content || '').substring(0, 200)}`
).join('\n')}

TARGET ROLE: ${job.title} at ${job.company}
JOB DESCRIPTION: ${(job.description || '').substring(0, 700)}

Respond with a structured markdown list. Each item starts with "- " and gives specific, actionable advice. Include 2–3 example bullet rewrites.`;

    } else if (requestType === 'linkedin_optimization') {
      systemPrompt = `You are Dexter, Hunter's LinkedIn growth AI. You help candidates appear in recruiter searches and attract inbound opportunities.

You provide specific rewrites, not generic tips. You understand LinkedIn's algorithm and recruiter search behaviour.`;

      userPrompt = `Create a LinkedIn optimisation plan for this candidate targeting ${job.title} roles.

CANDIDATE:
Name: ${profile.identity?.name}
Current/Recent Role: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
Skills: ${profile.skills?.slice(0, 10).map((s: { name: string }) => s.name).join(', ')}
Summary: ${profile.summary || 'Not provided'}

TARGET: ${job.title} at ${job.company}
TECH STACK: ${job.tech_stack?.join(', ') || 'Not specified'}
JOB DESCRIPTION: ${(job.description || '').substring(0, 500)}

Provide specific rewrites for:
1. **Headline** (120 chars, keyword-rich, value-driven — NOT just job title)
2. **About section** (first 3 lines must hook, include 3–5 target keywords)
3. **Top 3 Featured Skills** to pin
4. **Experience bullet** rewrite example for most recent role
5. **Engagement strategy** — 2 specific actions to attract recruiter attention this week`;

    } else if (requestType === 'interview_prep') {
      systemPrompt = `You are Dexter, Hunter's interview preparation AI. You give candidates a real edge — not generic advice.

You provide role-specific questions the company is KNOWN to ask, STAR story frameworks tailored to the candidate's actual experience, and red flags to avoid.`;

      userPrompt = `Prepare a targeted interview guide for this candidate.

CANDIDATE:
Skills: ${profile.skills?.slice(0, 6).map((s: { name: string }) => s.name).join(', ')}
Most Recent Role: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
Key Experience: ${(profile.experience_atoms?.[0]?.content || '').substring(0, 300)}

TARGET ROLE: ${job.title} at ${job.company}
JOB DESCRIPTION: ${(job.description || '').substring(0, 600)}

Provide:
## Likely Interview Questions
5 specific questions this company is likely to ask for this role

## STAR Story Starters
3 STAR story frameworks using the candidate's actual experience

## Key Talking Points
3 things to emphasise that align candidate strengths to this role

## Watch Out For
2 potential weaknesses to address proactively`;

    } else if (requestType === 'thank_you_note') {
      systemPrompt = `You are Dexter, Hunter's career AI. Write a thank-you email that reinforces the candidate's fit and keeps them top of mind — not a generic "thanks for your time" note.`;

      userPrompt = `Write a post-interview thank-you email for ${profile.identity?.name || 'the candidate'} after interviewing at ${job.company} for the ${job.title} role.

Top skills: ${profile.skills?.slice(0, 4).map((s: { name: string }) => s.name).join(', ')}

The email should:
- Be 120–160 words
- Reference something specific about the role or conversation (use a placeholder like [mention from interview])
- Reinforce one key strength relevant to the role
- Express genuine enthusiasm without sounding desperate
- End with a clear, confident closing line`;

    } else if (requestType === 'offer_evaluation') {
      systemPrompt = `You are Dexter, Hunter's compensation and negotiation strategist. You help candidates maximise their total compensation using market data, leverage points, and proven negotiation scripts.

You are direct, specific, and data-driven. You don't give vague advice — you give candidates the exact words to say.`;

      userPrompt = `Evaluate this offer and build a negotiation strategy.

ROLE: ${job.title} at ${job.company}
LISTED SALARY RANGE: ${job.salary_range || 'Not disclosed'}
CANDIDATE SKILLS: ${profile.skills?.slice(0, 6).map((s: { name: string }) => s.name).join(', ')}
EXPERIENCE: ${profile.experience_atoms?.length || 0} roles, most recent: ${profile.experience_atoms?.[0]?.role || 'N/A'}

Provide:
## Market Rate Assessment
Where this offer sits vs. market (use your knowledge of current compensation trends)

## Negotiation Leverage Points
3 specific reasons this candidate can push higher

## Counter-Offer Script
Exact words to say when negotiating (phone/email version)

## Total Comp Checklist
5 additional items to negotiate beyond base salary (equity, signing bonus, PTO, remote flexibility, title)`;

    } else if (requestType === 'resume_rewrite') {
      systemPrompt = `You are Dexter, Hunter's resume rewriting AI. You transform weak, generic bullet points into powerful, ATS-optimised achievements.

Rules:
- Lead every bullet with a strong action verb (Led, Built, Reduced, Launched, Scaled, Architected, Delivered, Automated, Negotiated, Grew)
- Add specific metrics wherever the original suggests scale — infer reasonable numbers if needed (e.g. "multiple clients" → "12+ enterprise clients")
- Mirror keywords from the job description naturally — don't keyword stuff
- Keep each bullet under 20 words
- Preserve factual accuracy — do not invent companies, roles, or job titles
- Return ONLY a valid JSON array, no markdown, no explanation, no preamble`;

      userPrompt = `Rewrite these experience bullets to maximise impact for the target role.

TARGET: ${job.title} at ${job.company}
JOB KEYWORDS: ${(job.tech_stack || []).slice(0, 8).join(', ')}
JOB DESCRIPTION SNIPPET: ${(job.description || '').substring(0, 500)}

CANDIDATE EXPERIENCE TO REWRITE:
${JSON.stringify(profile.experience_atoms?.slice(0, 3).map((e: { id: string; role: string; company: string; content: string }) => ({
  id: e.id,
  role: e.role,
  company: e.company,
  original_bullets: e.content
})))}

Return exactly this JSON format — nothing else:
[{"id": "...", "rewritten_content": "• Strong bullet 1\\n• Strong bullet 2\\n• Strong bullet 3"}]`;
    }

    // Route natural text tasks to Claude (better prose), everything else to Gemini Flash
    const { callAI, MODEL_CONTENT, MODEL_FAST } = await import('../_shared/ai-client.ts');
    const naturalTextTypes = new Set(['cover_letter', 'thank_you_note']);
    const model = naturalTextTypes.has(requestType) ? MODEL_CONTENT : MODEL_FAST;

    const llmController = new AbortController();
    const llmTimeout = setTimeout(() => llmController.abort(), 45000);

    let aiResult: { content: string | null };
    try {
      aiResult = await callAI(
        model,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { signal: llmController.signal },
      );
    } catch (aiErr) {
      clearTimeout(llmTimeout);
      console.error('[GENERATE] AI call failed:', aiErr instanceof Error ? aiErr.message : 'unknown');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    clearTimeout(llmTimeout);

    const content = aiResult.content;

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
