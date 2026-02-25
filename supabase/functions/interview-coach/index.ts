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
      'interview-coach',
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

    const { messages, profile, job, mode } = await req.json();

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    // SECURITY: Don't reveal which service is missing
    if (!geminiApiKey) {
      console.error('[CONFIG] Missing required API key');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle "Briefing Generation" mode (Structured Output)
    if (mode === 'generate_briefing') {
        const briefingPrompt = `You are an elite interview coach. Generate a strategic interview preparation dossier for:
        Role: ${job?.title}
        Company: ${job?.company}
        Description: ${job?.description?.substring(0, 1000)}

        Return a JSON object with:
        1. Company Profile (infer from name/industry knowledge)
        2. 5 Specific Technical Questions based on the stack
        3. 4 Behavioral Questions (culture fit)
        4. 3 "Red Flags" to watch out for
        5. 2 Interviewer Personas they might meet
        6. Evaluation Criteria (what they grade on)
        `;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout protection

        try {
            const llmResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${geminiApiKey}`,
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model: 'gemini-2.5-flash',
                    messages: [{ role: 'user', content: briefingPrompt }],
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
                    tool_choice: { type: 'function', function: { name: 'generate_dossier' } }
                }),
            });
            clearTimeout(timeoutId);

            if (!llmResponse.ok) {
                console.error('[INTERVIEW] Briefing generation failed');
                return new Response(
                    JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const llmData = await llmResponse.json();
            const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
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
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }


    }

    const interviewMode = mode || 'behavioral';
    
    let systemPrompt = `You are an expert interview coach simulating a real job interview. `;
    
    if (interviewMode === 'technical') {
      systemPrompt += `You are conducting a technical/competency interview tailored to the role of ${job?.title || 'the candidate'}. 
      If this is a Software Engineering role, ask about system design and coding. 
      If this is a Sales role, ask about quota attainment and pipeline management.
      If this is a specialized role (e.g. Nursing, Law, Accounting), ask about specific regulations, tools, or domain knowledge (GAAP, Clinical Protocols, etc.).
      Be supportive but challenging. Test their "Hard Skills".`;
    } else if (interviewMode === 'behavioral') {
      systemPrompt += `You are conducting a behavioral interview using the STAR method. Ask follow-up questions to get specific examples, metrics, and outcomes.`;
    } else if (interviewMode === 'negotiation') {
      systemPrompt += `You are helping the candidate practice salary negotiation. Play the role of a hiring manager. Provide realistic pushback.`;
    }

    if (profile) {
      systemPrompt += `\n\nCandidate Background:
- Name: ${profile.identity?.name}
- Current Role: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
- Key Skills: ${profile.skills?.slice(0, 5).map((s: { name: string }) => s.name).join(', ')}`;
    }

    if (job) {
      systemPrompt += `\n\nTarget Role: ${job.title} at ${job.company}
Salary Range: ${job.salary_range}
Description: ${job.description}`;
    }

    systemPrompt += `\n\nAfter each response, provide brief coaching feedback in [brackets] to help them improve.`;

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(messages || [])
    ];

    // If no messages, start the interview
    if (!messages || messages.length === 0) {
      let starterMessage = '';
      if (interviewMode === 'technical') {
        const roleType = job?.title || 'this role';
        starterMessage = `Hello! I'm excited to speak with you today about the ${roleType}. Let's dive into your technical expertise. Can you describe a complex problem you solved in your domain, and exactly how you approached the solution?`;
      } else if (interviewMode === 'behavioral') {
        starterMessage = `Hi there! Thanks for joining me today. I'd love to learn more about your experience. Let's start with a classic: Tell me about a time when you faced a significant challenge at work. What was the situation, and how did you handle it?`;
      } else if (interviewMode === 'negotiation') {
        starterMessage = `Great news! We'd like to extend an offer for the ${job?.title || 'position'}. Before we discuss specifics, I wanted to ask - what are your salary expectations for this role?`;
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
        const llmResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${geminiApiKey}`,
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: 'gemini-2.5-flash',
                messages: chatMessages
            }),
        });
        clearTimeout(timeoutId);

        if (!llmResponse.ok) {
            console.error('[INTERVIEW] AI response failed');
            
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
                JSON.stringify({ success: false, error: 'No response generated' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    // SECURITY: Never expose internal errors
    console.error('[ERROR] Interview coach error occurred');
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
