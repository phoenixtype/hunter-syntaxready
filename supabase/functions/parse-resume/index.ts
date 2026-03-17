import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GENERIC_SERVICE_ERROR = 'Service temporarily unavailable';
const GENERIC_AUTH_ERROR = 'Authentication required';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: GENERIC_AUTH_ERROR }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: GENERIC_AUTH_ERROR }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ success: false, error: limitError || 'Too many requests' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { resumeText, userId, resumeUrl } = await req.json();

    const systemPrompt = `You are an expert resume parser. Extract structured data from the provided resume text.
Rules:
- Categorize content into: identity (name, email, phone, location, links), summary, experience_atoms (role, company, duration, content), education (degree, school, year), and skills (name).
- For experience, each entry should be an "atom" with a clear ID (uuid-like), role, company, duration, and content (bullet points).
- For skills, identify key technical and professional skills.
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
    const extractedData = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;

    if (!extractedData?.profile) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to extract profile' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Add UUIDs to experience atoms if missing
    if (extractedData.profile.experience_atoms) {
      extractedData.profile.experience_atoms = extractedData.profile.experience_atoms.map((atom: any) => ({
        ...atom,
        id: atom.id || crypto.randomUUID()
      }));
    }

    return new Response(JSON.stringify({ success: true, profile: extractedData.profile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[ERROR] Parse resume error occurred:', error);
    return new Response(JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
