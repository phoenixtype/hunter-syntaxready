import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

const GENERIC_SERVICE_ERROR = 'Service temporarily unavailable';
const GENERIC_AUTH_ERROR = 'Authentication required';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorWithCors(GENERIC_AUTH_ERROR, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return errorWithCors(GENERIC_AUTH_ERROR, 401);
    }

    // Rate limiting
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { RateLimiter } = await import('../_shared/rate-limiter.ts');
    const limiter = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('parse-resume', {
      free: { max: 10, window: 60 },
      pro:  { max: 30, window: 60 },
    });
    if (!allowed) {
      return errorWithCors(limitError || 'Too many requests', 429);
    }

    const { resumeText, userId, resumeUrl } = await req.json();

    const systemPrompt = `You are an expert ATS-optimized resume parser and writer. Extract and significantly improve structured data from the provided resume text.
Rules:
- Categorize content into: identity (name, email, phone, location, links), summary, experience_atoms (role, company, duration, content), education (degree, school, year), and skills (name).
- **ATS Optimization Rules for Experience Bullets:**
  - Rewrite bullet points to be highly quantifiable (add metrics where implied).
  - Use strong action verbs.
  - Remove all fluff words ("responsible for", "helped", "worked on"); jump straight to the action.
  - Break long paragraphs into concise, punchy bullet points.
- **ATS Optimization Rules for Skills:**
  - Extract only hard, technical, and domain-specific skills. Do not extract soft skills like "teamwork" or "hard worker" as ATS parsers discard them.
- For experience, each entry must be an "atom" with a clear ID (uuid-like), role, company, duration, and content (bullet points separated by newlines).
- Return ONLY valid JSON matching the CandidateProfile schema. No markdown, no fences.`;

    const userPrompt = `Parse this resume text:
${resumeText}

Additional context:
- User ID: ${userId || 'unknown'}
- Resume URL: ${resumeUrl || 'none'}`;

    const { callAI, MODEL_FAST } = await import('../_shared/ai-client.ts');

    const aiResult = await callAI(
      MODEL_FAST,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        tools: [{
          type: 'function',
          function: {
            name: 'extract_profile',
            description: 'Extract candidate profile data',
            parameters: {
              type: 'object',
              properties: {
                profile: {
                  type: 'object',
                  properties: {
                    identity: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' },
                        location: { type: 'string' },
                        links: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['name', 'email']
                    },
                    summary: { type: 'string' },
                    skills: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          proficiency: { type: 'number' },
                          evidence: { type: 'array', items: { type: 'string' } }
                        }
                      }
                    },
                    experience_atoms: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          role: { type: 'string' },
                          company: { type: 'string' },
                          duration: { type: 'string' },
                          content: { type: 'string' }
                        }
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
                        }
                      }
                    }
                  },
                  required: ['identity', 'skills', 'experience_atoms']
                }
              },
              required: ['profile']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_profile' } },
      },
    );

    const toolCall = aiResult.tool_calls?.[0];
    let extractedData: Record<string, unknown> | null = null;
    try {
      extractedData = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;
    } catch { /* malformed AI response — treat as extraction failure */ }

    if (!extractedData?.profile) {
      return jsonWithCors({ success: false, error: 'Failed to extract profile' });
    }

    // Add UUIDs to experience atoms if missing
    const profileData = extractedData.profile as Record<string, unknown>;
    if (Array.isArray(profileData.experience_atoms)) {
      profileData.experience_atoms = (profileData.experience_atoms as Array<Record<string, unknown>>).map((atom) => ({
        ...atom,
        id: atom.id || crypto.randomUUID()
      }));
    }

    return jsonWithCors({ success: true, profile: extractedData.profile });

  } catch (error) {
    console.error('[ERROR] Parse resume error occurred:', error);
    return errorWithCors(GENERIC_SERVICE_ERROR, 500);
  }
});
