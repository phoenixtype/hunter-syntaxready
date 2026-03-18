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

// Rate limit configuration: 20 requests per minute (conversational)
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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
      JSON.stringify({ status: 'healthy', service: 'interview-coach', timestamp: new Date().toISOString() }),
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

    // Use service role for rate limiting
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Server-side rate limiting with pro/free tier support
    const { RateLimiter } = await import('../_shared/rate-limiter.ts');
    const limiter = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('interview-coach', {
      free: { max: 20, window: 60 },
      pro:  { max: 60, window: 60 },
    });

    if (!allowed) {
      console.log('[RATE_LIMIT] User rate limited:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: limitError || GENERIC_RATE_LIMIT_ERROR }),
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

    const { messages, profile, job, mode } = await req.json();

    const { callAI, MODEL_FAST, MODEL_REASONING } = await import('../_shared/ai-client.ts');

    // ── Research Questions Mode ─────────────────────────────────────────────
    // Crawls Reddit, Glassdoor, Blind and community sources for real questions
    // asked at this company for this specific role.
    if (mode === 'research_questions') {
      const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (!firecrawlApiKey) {
        return new Response(JSON.stringify({ questions: [], patterns: [], insights: 'Research feature unavailable.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const company = (job?.company || '').trim();
      const role = (job?.title || '').trim();
      if (!company && !role) {
        return new Response(JSON.stringify({ questions: [], patterns: [], insights: 'Provide a company and role to research.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const searches = [
        { query: `${company} ${role} interview questions asked reddit`, label: 'Reddit' },
        { query: `${company} ${role} interview experience what questions`, label: 'Community' },
        { query: `glassdoor ${company} ${role} interview questions`, label: 'Glassdoor' },
        { query: `blind ${company} ${role} interview process questions`, label: 'Blind' },
      ];

      const searchResults = await Promise.allSettled(
        searches.map(async ({ query, label }) => {
          const res = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 3, scrapeOptions: { formats: ['markdown'] } }),
            signal: AbortSignal.timeout(12000),
          });
          if (!res.ok) return { label, content: '', urls: [] as string[] };
          const data = await res.json();
          const results = (data.data || []) as Array<{ title: string; url: string; markdown: string }>;
          const content = results
            .map(r => `[${r.title}](${r.url})\n${(r.markdown || '').substring(0, 1200)}`)
            .join('\n\n');
          return { label, content, urls: results.map(r => r.url) };
        })
      );

      const settled = searchResults
        .filter((r): r is PromiseFulfilledResult<{ label: string; content: string; urls: string[] }> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(r => r.content.length > 0);

      const combinedContent = settled
        .map(r => `=== ${r.label} ===\n${r.content}`)
        .join('\n\n---\n\n');

      if (!combinedContent) {
        return new Response(JSON.stringify({
          questions: [],
          patterns: [],
          insights: `No community interview data found for ${role} at ${company}. The company may be too niche or the role too general. Try practicing with the AI coach — it will adapt to your specific role.`,
          sources: [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const extractPrompt = `You are analysing real interview experience posts from Reddit, Glassdoor, Blind, and community forums to extract actual questions asked at ${company || 'this company'} for the ${role || 'this role'} role.

From the scraped content below, extract:
1. Specific questions that were actually asked in interviews (verbatim or near-verbatim where possible)
2. Key patterns in their interview process (e.g. "they always ask a system design question in round 2")
3. A short insight summary on what candidates consistently report about the experience

CONTENT:
${combinedContent.substring(0, 5000)}

Focus on questions SPECIFIC to this company/role. Skip completely generic questions like "tell me about yourself" unless the source says the company always asks it in a specific way. Include technical questions, behavioural questions, and any role-specific deep-dives mentioned.`;

      const extractResult = await callAI(MODEL_FAST, [{ role: 'user', content: extractPrompt }], {
        tools: [{
          type: 'function',
          function: {
            name: 'extract_interview_intel',
            description: 'Extract interview questions and patterns from community posts',
            parameters: {
              type: 'object',
              properties: {
                questions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Actual questions reported by candidates who interviewed here',
                },
                patterns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Key patterns in the interview process (format, stages, recurring themes)',
                },
                insights: {
                  type: 'string',
                  description: '2-3 sentence summary of what candidates report about the overall interview experience at this company for this role',
                },
              },
              required: ['questions', 'insights'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_interview_intel' } },
      });

      const toolCall = extractResult.tool_calls?.[0];
      const extracted = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;
      const sources = settled.flatMap(r => r.urls).filter(Boolean).slice(0, 6);

      return new Response(JSON.stringify({
        questions: extracted?.questions ?? [],
        patterns: extracted?.patterns ?? [],
        insights: extracted?.insights ?? '',
        sources,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle "Briefing Generation" mode (Structured Output)
    if (mode === 'generate_briefing') {
        // Fetch real company intelligence via Firecrawl before generating briefing
        let companyIntel = '';
        const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
        if (firecrawlApiKey && job?.company) {
            try {
                const supabaseUrl2 = Deno.env.get('SUPABASE_URL')!;
                const supabaseServiceKey2 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                // Call the crawl-jobs function in company_research mode using service role
                const researchResponse = await fetch(`${supabaseUrl2}/functions/v1/crawl-jobs`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${supabaseServiceKey2}`,
                        'Content-Type': 'application/json',
                        // Bypass the auth check by using service role — crawl-jobs verifies user JWT
                        // so we call Firecrawl search directly here instead
                    },
                });
                // Direct Firecrawl search (faster than going through crawl-jobs with auth)
                const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `${job.company} company mission culture engineering team 2024 2025`,
                        limit: 3,
                        scrapeOptions: { formats: ['markdown'] }
                    }),
                    signal: AbortSignal.timeout(12000),
                });
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    const results = searchData.data || [];
                    companyIntel = results
                        .map((r: {title: string; url: string; markdown: string}) =>
                            `**${r.title}** (${r.url})\n${(r.markdown || '').substring(0, 800)}`)
                        .join('\n\n---\n\n');
                    console.log(`[BRIEFING] Fetched company intel: ${companyIntel.length} chars`);
                }
            } catch (err) {
                console.warn('[BRIEFING] Company research failed (non-fatal):', err);
            }
        }

        const briefingPrompt = `You are Dexter, Hunter's elite interview intelligence AI. Generate a comprehensive, research-backed interview dossier.

Role: ${job?.title}
Company: ${job?.company}
Description: ${job?.description?.substring(0, 1000)}

${companyIntel ? `Real Company Intelligence (scraped live from their website and recent news — use this, not your training data):\n${companyIntel.substring(0, 3000)}` : ''}

Generate a dossier that gives the candidate a genuine unfair advantage. Include:
1. Company Profile — mission, real culture signals, stage, recent notable news from the intel above
2. 5 Targeted Technical Questions — specific to this role's stack and responsibilities, NOT generic
3. 4 Behavioural Questions — tied to this company's known values and culture signals
4. 3 Red Flags to Watch — things that could tank this interview (e.g. known tough culture, specific expectations)
5. 2 Interviewer Personas — typical archetypes they'll meet (e.g. the sceptical engineer, the culture-focused HR partner)
6. Evaluation Criteria — the dimensions they score candidates on and what "great" looks like for each
`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout protection

        try {
            const briefingResult = await callAI(
                MODEL_REASONING,
                [{ role: 'user', content: briefingPrompt }],
                {
                    signal: controller.signal,
                    tools: [{
                        type: 'function',
                        function: {
                            name: 'generate_dossier',
                            description: 'Generate interview preparation dossier',
                            parameters: {
                                type: 'object',
                                properties: {
                                    company_profile: {
                                        type: 'object',
                                        properties: {
                                            mission: { type: 'string' },
                                            industry: { type: 'string' },
                                            stage: { type: 'string' },
                                            recent_news: { type: 'array', items: { type: 'string' } }
                                        },
                                        required: ['mission', 'industry']
                                    },
                                    technical_questions: { type: 'array', items: { type: 'string' } },
                                    behavioral_questions: { type: 'array', items: { type: 'string' } },
                                    red_flags_to_watch: { type: 'array', items: { type: 'string' } },
                                    interviewer_insights: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                role: { type: 'string' },
                                                name_archetype: { type: 'string' },
                                                focus_area: { type: 'string' },
                                                tip: { type: 'string' }
                                            }
                                        }
                                    },
                                    evaluation_criteria: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                dimension: { type: 'string' },
                                                weight: { type: 'string' },
                                                description: { type: 'string' }
                                            }
                                        }
                                    }
                                },
                                required: ['company_profile', 'technical_questions', 'red_flags_to_watch']
                            }
                        }
                    }],
                    tool_choice: { type: 'function', function: { name: 'generate_dossier' } },
                },
            );
            clearTimeout(timeoutId);

            const toolCall = briefingResult.tool_calls?.[0];
            const dossier = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;

            // Augment default values if AI missed some fields
            const safeDossier = {
                company_values: ["Innovation", "Impact", "Ownership"], // Default, AI usually misses this specific field in simple prompt
                ...dossier
            };

            return new Response(
                JSON.stringify(safeDossier), // Return raw JSON directly as expected by frontend
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );

        } catch (err) {
            clearTimeout(timeoutId);
            console.error('[INTERVIEW] Briefing error:', err);
            return new Response(
                JSON.stringify({ success: false, error: 'Briefing generation timed out or failed' }),
                { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }


    }

    const interviewMode = mode || 'behavioral';

    let systemPrompt = `You are Dexter, Hunter's expert AI interview coach. You simulate real interviews with the depth and rigour of an actual hiring panel at a top company. You are supportive but honest — you won't let candidates get away with vague answers.\n\n`;

    if (interviewMode === 'technical') {
      systemPrompt += `You are running a technical interview for the role of ${job?.title || 'this position'}.

Your approach:
- Ask one focused technical question at a time
- Probe depth: when a candidate gives a surface answer, follow up with "Can you walk me through the specifics?" or "What tradeoffs did you consider?"
- Adapt to the domain: Software Engineering → system design, algorithms, architecture decisions; Sales/RevOps → pipeline metrics, quota attainment, discovery process; Finance/Accounting → GAAP, modelling, forecasting; Healthcare → clinical protocols, regulatory compliance; Data/ML → feature engineering, model evaluation, MLOps
- If the answer is strong, acknowledge it briefly then advance to a harder question
- If the answer is weak, ask a clarifying follow-up before moving on`;
    } else if (interviewMode === 'behavioral') {
      systemPrompt += `You are running a behavioural interview using the STAR method (Situation, Task, Action, Result).

Your approach:
- Ask one question at a time — never multiple questions at once
- When the candidate's answer lacks specifics, probe: "What was the specific outcome?", "What metric improved?", "How large was the team?", "What exactly did YOU do vs. what did the team do?"
- When a STAR answer is complete and strong, acknowledge the strength briefly then move to the next dimension
- Cover: leadership, conflict, failure, collaboration, initiative, and results under pressure
- Keep the flow conversational — this is a practice session, not a quiz`;
    } else if (interviewMode === 'negotiation') {
      systemPrompt += `You are playing the role of a hiring manager conducting a salary negotiation conversation. Your goal is to give the candidate REAL negotiation practice with realistic pushback.

Your approach:
- Start by extending the offer and stating a specific number (anchor slightly below market)
- Use realistic hiring manager responses: "That's above our budget", "We're pretty firm on that range", "Let me see what I can do"
- Don't cave immediately — push back once or twice to simulate real negotiation
- After 3–4 exchanges, wrap up with a realistic outcome
- Track whether the candidate: anchors high, justifies their ask with data, asks for more than just salary, and stays professional under pressure
- After the negotiation ends, step out of character and give Dexter's verdict on how they performed`;
    }

    if (profile) {
      systemPrompt += `\n\nCandidate background (use this to make questions relevant):
- Name: ${profile.identity?.name}
- Most Recent Role: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
- Key Skills: ${profile.skills?.slice(0, 6).map((s: { name: string }) => s.name).join(', ')}
- Experience depth: ${profile.experience_atoms?.length || 1} role(s)`;
    }

    if (job) {
      systemPrompt += `\n\nTarget Role: ${job.title} at ${job.company}
Salary Range: ${job.salary_range || 'Not disclosed'}
Role Context: ${(job.description || '').substring(0, 400)}`;
    }

    // Community-sourced questions: weave them into the practice session
    const communityQuestions: string[] = job?.communityQuestions ?? [];
    if (communityQuestions.length > 0) {
      systemPrompt += `\n\nReal Questions from Community Research (Reddit/Glassdoor/Blind):
These are questions real candidates report being asked at ${job?.company || 'this company'} for this role. You MUST incorporate these into the session — ask at least 3 of them verbatim or with minor adaptation. Candidates want to be prepared for these specifically:
${communityQuestions.slice(0, 12).map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

When you ask a community question, briefly note it came from candidate reports (e.g. "(Commonly reported question)")`;
    }

    systemPrompt += `\n\nAfter EVERY candidate response, end with a brief coaching note in [square brackets] on one of: clarity, specificity, structure, confidence, or what to improve. Keep the note to 1–2 sentences. Example: [Good STAR structure — add the business impact metric to make this answer truly memorable.]`;

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(messages || [])
    ];

    // If no messages, start the interview
    if (!messages || messages.length === 0) {
      let starterMessage = '';
      if (interviewMode === 'technical') {
        const roleType = job?.title || 'this role';
        const company = job?.company ? ` at ${job.company}` : '';
        starterMessage = `Hey! I'm Dexter, your AI interview coach. I'm going to run you through a technical interview for the ${roleType}${company} role — I'll push you the same way a real panel would.\n\nLet's get into it. Walk me through the most technically challenging project you've worked on. What was the problem, what was your specific contribution, and what would you do differently with hindsight?`;
      } else if (interviewMode === 'behavioral') {
        const company = job?.company ? ` at ${job.company}` : '';
        starterMessage = `Hey! I'm Dexter, your AI interview coach. We're going to do a full behavioural interview for the ${job?.title || 'position'}${company} role — I'll ask follow-ups the way a real interviewer would, so bring your real examples.\n\nLet's start somewhere interesting: Tell me about a time you had to push back on a decision made by a senior stakeholder. What was the situation, and how did you handle it?`;
      } else if (interviewMode === 'negotiation') {
        const title = job?.title || 'the position';
        const salary = job?.salary_range ? ` Our range for this role is ${job.salary_range}.` : ' We are excited to bring you on board.';
        starterMessage = `Hi ${profile?.identity?.name ? profile.identity.name.split(' ')[0] : 'there'}, great to connect. We've completed our interview process and the team loved meeting you — we'd like to extend an offer for the ${title} role.${salary}\n\nBefore I send the formal offer letter, I wanted to have a quick conversation about compensation. Does that range work for you?`;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: starterMessage,
          mode: interviewMode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout protection

    try {
        const chatResult = await callAI(
            MODEL_FAST,
            chatMessages,
            { signal: controller.signal },
        );
        clearTimeout(timeoutId);

        const content = chatResult.content;

        if (!content) {
            return new Response(
                JSON.stringify({ success: false, error: 'No response generated' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ 
                success: true, 
                message: content,
                mode: interviewMode
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        clearTimeout(timeoutId);
        console.error('[INTERVIEW] AI Chat error:', err);
        return new Response(
            JSON.stringify({ success: false, error: 'Interview coach timed out' }),
            { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    // SECURITY: Never expose internal errors
    console.error('[ERROR] Interview coach error occurred');
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
