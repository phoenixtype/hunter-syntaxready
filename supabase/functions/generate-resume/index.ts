import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Response(JSON.stringify({ status: 'healthy' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Auth required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate Limiting
    const { RateLimiter } = await import("../_shared/rate-limiter.ts");
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const limiter = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('generate-resume', {
      free: { max: 3, window: 300 }, // 3 resumes per 5 mins for free users
      pro: { max: 15, window: 300 }   // 15 resumes per 5 mins for pro users
    });

    if (!allowed) {
      return new Response(JSON.stringify({ error: limitError }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { profile, template, accentColor } = await req.json();

    if (!profile || !profile.identity) {
      return new Response(JSON.stringify({ error: 'Profile data required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const TEMPLATE_STYLES: Record<string, string> = {
      minimalist: 'Professional Minimalist: Clean, ultra-modern sans-serif layout (Inter/system-ui). Focuses entirely on content readability and elegant whitespace. No borders, pure typography.',
      executive: 'Executive Premium: Authoritative serif typography (Georgia/Playfair) with strong dividing lines and a sophisticated structural grid. Center-aligned name header.',
      tech: 'Modern Tech: Sleek, high-density layout. Use monospace fonts (Fira Code/Courier) for skill tags or project metrics. Very structured.',
      corporate: 'Classic Corporate: Timeless layout with standard serif headings and minimal styling. Maximum ATS readability. Strict left alignment.',
    };
    const templateStyle = TEMPLATE_STYLES[template] || TEMPLATE_STYLES.minimalist;
    const accentHex = accentColor || '#475569';

    const systemPrompt = `You are a world-class executive resume writer and strict ATS parsing expert. 
Generate a complete, highly-optimized HTML resume document based ONLY on the provided data.

Template style requested: ${templateStyle}
Accent Color requested: ${accentHex}

CRITICAL RULES FOR GENERATION:
1. STRICTLY NO HALLUCINATIONS: You are FORBIDDEN from adding any companies, roles, degrees, skills, or responsibilities that are NOT explicitly in the user's provided data. Do not make up metrics. 
2. EXTREME CONCISENESS: Refine and rewrite the user's bullet points to be incredibly punchy. Use strong action verbs. Ensure the entire resume cleanly fits on a single printed page. Limit to a MAXIMUM of 3 bullet points per role, combining redundant points if necessary.
3. ATS OPTIMIZATION: Do not use HTML tables for layout. Use semantic <h1>, <h2>, <ul>, and <li> tags.
4. STYLING INSTRUCTIONS: All CSS must be inline. Use the provided Accent Color (${accentHex}) for key structural elements like section headings (<h2>), borders/dividers, or skill badge backgrounds.
5. FONT STACK: Use web-safe, completely standard fonts (e.g. system-ui, -apple-system, sans-serif, or serif depending on the template style).
6. PRINT READY: Ensure 'max-width: 800px; margin: 0 auto; color: #111; background: #fff;' on the body. Do not use dark backgrounds, they waste printer ink.
7. Omit any section if no data is provided for it.`;

    interface ExperienceAtom {
      role: string;
      company: string;
      duration: string;
      content: string;
    }

    interface Education {
      degree: string;
      school: string;
      year: string;
    }

    interface Skill {
      name: string;
    }

    const experienceText = profile.experience_atoms?.map((exp: ExperienceAtom) => 
      `Role: ${exp.role}, Company: ${exp.company}, Duration: ${exp.duration}, Details: ${exp.content}`
    ).join('\n') || 'No experience provided';

    const educationText = profile.education?.map((edu: Education) => 
      `${edu.degree} from ${edu.school} (${edu.year})`
    ).join('\n') || 'No education provided';

    const skillsText = profile.skills?.map((s: Skill) => s.name).join(', ') || 'No skills provided';

    const userPrompt = `Generate an HTML resume for:

Name: ${profile.identity.name}
Email: ${profile.identity.email}
Phone: ${profile.identity.phone || 'Not provided'}
Links: ${profile.identity.links?.join(', ') || 'None'}
Summary: ${profile.summary || 'Not provided'}

EXPERIENCE:
${experienceText}

EDUCATION:
${educationText}

SKILLS: ${skillsText}

Return ONLY the complete HTML document (starting with <!DOCTYPE html>). No markdown, no code fences.`;

    const llmResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${geminiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-1.5-flash',
      messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!llmResponse.ok) {
      console.error('[RESUME] LLM generation failed:', llmResponse.status);
      return new Response(JSON.stringify({ error: 'Resume generation failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const llmData = await llmResponse.json();
    let content = llmData.choices?.[0]?.message?.content || '';

    // Clean up any markdown code fences
    content = content.replace(/^```html?\s*/i, '').replace(/```\s*$/i, '').trim();

    if (!content || !content.includes('<')) {
      return new Response(JSON.stringify({ error: 'Failed to generate resume content' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[RESUME] Generated HTML resume, length:', content.length);

    return new Response(JSON.stringify({ success: true, content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('[RESUME] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
