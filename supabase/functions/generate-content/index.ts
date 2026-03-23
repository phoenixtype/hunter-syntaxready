import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

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
    return handleCorsPrelight();
  }

  // HEALTH CHECK: Return 200 OK for crawlers/probes
  if (isHealthCheckRequest(req)) {
    return jsonWithCors({ status: 'healthy', service: 'generate-content', timestamp: new Date().toISOString() });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorWithCors(GENERIC_AUTH_ERROR, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // SECURITY: Validate config server-side only
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[SECURITY] Missing required configuration');
      return errorWithCors(GENERIC_SERVICE_ERROR, 500);
    }

    // Verify user token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('[AUTH] Token verification failed');
      return errorWithCors(GENERIC_AUTH_ERROR, 401);
    }

    // Use service role for rate limiting
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Server-side rate limiting with pro/free tier support
    const { RateLimiter } = await import('../_shared/rate-limiter.ts');
    const limiter = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('generate-content', {
      free: { max: 30, window: 60 },
      pro:  { max: 100, window: 60 },
      requirePro: true,
    });

    if (!allowed) {
      console.log('[RATE_LIMIT] User rate limited:', user.id);
      const response = errorWithCors(limitError || GENERIC_RATE_LIMIT_ERROR, 429);
      response.headers.set('Retry-After', '60');
      return response;
    }

    // SECURITY: Log only user ID
    console.log('[AUTH] Authenticated user:', user.id);

    const { profile, job, type } = await req.json();

    if (!profile || !job) {
      return errorWithCors('Profile and job are required', 400);
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

      const interviewerName = job.interviewer_name || job.description?.match(/Interviewer:\s*([^.]+)/)?.[1]?.trim();
      const topicsDiscussed = job.notes || '';

      userPrompt = `Write a post-interview thank-you email for ${profile.identity?.name || 'the candidate'} after interviewing with ${interviewerName || 'the hiring manager'} at ${job.company}.

Interviewer name: ${interviewerName || 'not provided — address generically'}
Topics discussed: ${topicsDiscussed || 'not specified'}
Candidate top skills: ${profile.skills?.slice(0, 4).map((s: { name: string }) => s.name).join(', ')}

The email should:
- Open with "Hi ${interviewerName ? interviewerName.split(' ')[0] : 'there'},"
- Be 120–160 words
- Reference one of the topics discussed above naturally
- Reinforce one key strength relevant to the role
- Express genuine enthusiasm without sounding desperate
- End with a clear, confident closing line
- Use no placeholder brackets — write it ready to send`;

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

    } else if (requestType === 'negotiation_script') {
      const format = job.format || 'phone';
      const isPhone = format === 'phone';

      systemPrompt = `You are Dexter, Hunter's negotiation coach. You write concise, ready-to-use negotiation scripts that sound natural and confident. Never use placeholder brackets like [Name] or [Company] — write the script so the candidate can use it as-is.`;

      userPrompt = `Write a ${isPhone ? 'phone call script' : 'professional email'} for ${profile.identity?.name || 'the candidate'} to negotiate their salary at ${job.company}.

Offer received: $${job.offer_salary ? Number(job.offer_salary).toLocaleString() : 'the amount offered'}
Counter target: ${job.counter_amount || 'a higher salary reflecting their market value'}
Candidate background: ${profile.experience_atoms?.[0]?.role || 'professional'} with expertise in ${profile.skills?.slice(0, 3).map((s: { name: string }) => s.name).join(', ')}

${isPhone
  ? 'Write a phone script the candidate reads aloud. Natural, conversational, under 100 words. No headers or bullet points — just flowing spoken dialogue.'
  : 'Write a complete, ready-to-send email. Include a subject line on the first line, then the body. Professional tone, under 150 words total.'}`;

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

    } else if (requestType === 'job_description') {
      // Recruiter-side: generate a full job posting from sparse inputs
      systemPrompt = `You are a world-class talent acquisition specialist and copywriter. You write job descriptions that attract top candidates — specific, engaging, and ATS-friendly. You do NOT use filler phrases like "fast-paced", "self-starter", "wear many hats", or "rockstar". Every sentence earns its place.`;

      userPrompt = `Generate a complete job description for this role. Return ONLY valid JSON — no markdown, no preamble, no explanation.

Role: ${job.title}
Company: ${job.company || 'the company'}
Location type: ${job.location_type || 'hybrid'}
Employment: ${job.employment_type || 'full_time'}
Experience level: ${job.experience_level || 'mid'}
Location: ${job.location || 'not specified'}
Tech/skills: ${(job.tech_stack || []).join(', ') || 'not specified'}
Salary range: ${job.salary_min && job.salary_max ? `$${job.salary_min.toLocaleString()}–$${job.salary_max.toLocaleString()} ${job.salary_currency || 'USD'}` : 'not specified'}
Additional context: ${job.description || 'none'}

Return exactly this JSON structure:
{
  "description": "3–4 engaging sentences about the role and impact. Start with the opportunity, not the company. ~100 words.",
  "responsibilities": "• Responsibility 1\\n• Responsibility 2\\n• Responsibility 3\\n• Responsibility 4\\n• Responsibility 5",
  "requirements": "• Requirement 1\\n• Requirement 2\\n• Requirement 3\\n• Requirement 4\\n• Requirement 5",
  "benefits": "• Benefit 1\\n• Benefit 2\\n• Benefit 3\\n• Benefit 4"
}`;
    }

    // Route natural text tasks to Claude (better prose), everything else to Gemini Flash
    const { callAI, MODEL_CONTENT, MODEL_FAST } = await import('../_shared/ai-client.ts');
    const naturalTextTypes = new Set(['cover_letter', 'thank_you_note', 'negotiation_script']);
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
      return jsonWithCors({ success: false, error: GENERIC_SERVICE_ERROR });
    }
    clearTimeout(llmTimeout);

    const content = aiResult.content;

    if (!content) {
      return jsonWithCors({ success: false, error: 'No content generated' });
    }

    console.log(`[GENERATE] Successfully generated ${requestType}`);

    return jsonWithCors({
      success: true,
      content,
      type: requestType
    });

  } catch (error) {
    // SECURITY: Never expose internal errors
    console.error('[ERROR] Generate content error occurred');
    return jsonWithCors({ success: false, error: GENERIC_SERVICE_ERROR });
  }
});
