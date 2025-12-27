import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const { profile, job, type } = await req.json();

    if (!profile || !job) {
      return new Response(
        JSON.stringify({ success: false, error: 'Profile and job are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestType = type || 'cover_letter';
    console.log(`Generating ${requestType} for ${job.company} - ${job.title}`);

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
Key Skills: ${profile.skills?.slice(0, 5).map((s: any) => s.name).join(', ')}
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

Provide specific optimization suggestions.`;
    } else if (requestType === 'interview_prep') {
      systemPrompt = `You are an expert interview coach. Based on the candidate's background and the target job, provide:
1. Likely technical questions they'll face
2. Behavioral questions with STAR-method answer frameworks
3. Questions the candidate should ask
4. Red flags to watch for
5. Salary negotiation talking points`;

      userPrompt = `Prepare interview coaching for:

CANDIDATE: ${profile.identity?.name}
Background: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
Skills: ${profile.skills?.slice(0, 5).map((s: any) => s.name).join(', ')}

TARGET ROLE: ${job.title} at ${job.company}
Description: ${job.description}
Salary Range: ${job.salary_range}

Provide comprehensive interview preparation.`;
    }

    const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('LLM generation failed:', errorText);
      
      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'No content generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully generated ${requestType}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        content,
        type: requestType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate content error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
