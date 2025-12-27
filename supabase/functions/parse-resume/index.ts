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
    const { resumeText, userId } = await req.json();

    if (!resumeText) {
      return new Response(
        JSON.stringify({ success: false, error: 'Resume text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing resume with AI...');

    // Use tool calling to extract structured data
    const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert resume parser. Extract structured information from resumes with high accuracy.
            
For skills, estimate proficiency on a 0-1 scale based on:
- 0.9-1.0: Explicitly listed as expert/advanced, or has 5+ years experience
- 0.7-0.89: Listed prominently with substantial evidence
- 0.5-0.69: Mentioned with some context
- 0.3-0.49: Briefly mentioned

For experience atoms, extract each distinct role with its key accomplishments.
Extract keywords that would match job descriptions (technologies, methodologies, soft skills).`
          },
          {
            role: 'user',
            content: `Parse this resume and extract all relevant information:\n\n${resumeText.substring(0, 8000)}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_resume_data',
              description: 'Extract structured candidate profile from resume',
              parameters: {
                type: 'object',
                properties: {
                  identity: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Full name of the candidate' },
                      email: { type: 'string', description: 'Email address' },
                      links: { type: 'array', items: { type: 'string' }, description: 'LinkedIn, GitHub, portfolio URLs' }
                    },
                    required: ['name', 'email']
                  },
                  skills: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Skill name' },
                        proficiency: { type: 'number', description: 'Proficiency level 0-1' },
                        evidence: { type: 'array', items: { type: 'string' }, description: 'Evidence from resume' }
                      },
                      required: ['name', 'proficiency']
                    }
                  },
                  experience_atoms: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        company: { type: 'string' },
                        role: { type: 'string' },
                        duration: { type: 'string' },
                        content: { type: 'string', description: 'Key accomplishment or responsibility' },
                        keywords: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['company', 'role', 'content']
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
                      },
                      required: ['school', 'degree']
                    }
                  }
                },
                required: ['identity', 'skills', 'experience_atoms', 'education']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_resume_data' } }
      }),
    });

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('LLM parsing failed:', errorText);
      
      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'AI parsing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error('No tool call response from LLM');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse resume structure' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = JSON.parse(toolCall.function.arguments);
    
    // Add IDs to experience atoms if missing
    profile.experience_atoms = profile.experience_atoms.map((exp: any, idx: number) => ({
      ...exp,
      id: exp.id || `exp-${idx + 1}`
    }));

    console.log('Successfully parsed resume:', profile.identity?.name);

    // Save to database if userId provided
    if (userId && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: upsertError } = await supabase
        .from('candidate_profiles')
        .upsert({
          user_id: userId,
          identity: profile.identity,
          skills: profile.skills,
          experience_atoms: profile.experience_atoms,
          education: profile.education,
          raw_resume_text: resumeText.substring(0, 50000)
        }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Failed to save profile:', upsertError);
      } else {
        console.log('Profile saved to database');
      }
    }

    return new Response(
      JSON.stringify({ success: true, profile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse resume error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
