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

    const { profile, template } = await req.json();

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

    const templateStyle = template === 'classic' 
      ? 'Clean, traditional, serif headings, simple borders, professional corporate look'
      : template === 'executive'
      ? 'Bold, authoritative, dark header section, large name, gold accents, executive presence'
      : 'Sleek, minimal, sans-serif, teal accent color (#0d9488), modern tech industry style';

    const systemPrompt = `You are an expert resume designer. Generate a complete, ATS-friendly HTML resume document. 
The HTML must be self-contained with inline CSS styles. Use clean, professional formatting.
Template style: ${templateStyle}

Rules:
- Use semantic HTML (h1, h2, section, ul, li)
- All styles must be inline CSS
- Use a clean, readable font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Page should be letter-size friendly (max-width: 800px, centered)
- Include proper spacing, margins, and visual hierarchy
- Make it print-friendly (no dark backgrounds that waste ink, unless executive template)
- Ensure strong ATS compatibility (avoid tables for layout, use standard heading tags)
- Format experience bullet points with quantified achievements
- Group skills logically
- DO NOT include any placeholder text — only use the data provided`;

    const experienceText = profile.experience_atoms?.map((exp: any) => 
      `Role: ${exp.role}, Company: ${exp.company}, Duration: ${exp.duration}, Details: ${exp.content}`
    ).join('\n') || 'No experience provided';

    const educationText = profile.education?.map((edu: any) => 
      `${edu.degree} from ${edu.school} (${edu.year})`
    ).join('\n') || 'No education provided';

    const skillsText = profile.skills?.map((s: any) => s.name).join(', ') || 'No skills provided';

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
        model: 'gemini-2.5-flash',
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
