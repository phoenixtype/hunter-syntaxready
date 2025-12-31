import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SECURITY: Generic error messages to avoid information disclosure
const GENERIC_SERVICE_ERROR = 'Service temporarily unavailable';
const GENERIC_AUTH_ERROR = 'Authentication required';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // SECURITY: Validate config server-side only
    if (!supabaseUrl || !supabaseAnonKey) {
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

    // SECURITY: Log only user ID
    console.log('[AUTH] Authenticated user:', user.id);

    const { messages, profile, job, mode } = await req.json();

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // SECURITY: Don't reveal which service is missing
    if (!lovableApiKey) {
      console.error('[CONFIG] Missing required API key');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const interviewMode = mode || 'behavioral';
    
    let systemPrompt = `You are an expert interview coach simulating a real job interview. `;
    
    if (interviewMode === 'technical') {
      systemPrompt += `You are conducting a technical interview. Ask probing follow-up questions about system design, coding practices, and technical decision-making. Be supportive but challenging.`;
    } else if (interviewMode === 'behavioral') {
      systemPrompt += `You are conducting a behavioral interview using the STAR method. Ask follow-up questions to get specific examples, metrics, and outcomes. Help the candidate improve their answers.`;
    } else if (interviewMode === 'negotiation') {
      systemPrompt += `You are helping the candidate practice salary negotiation. Play the role of a hiring manager. Provide realistic pushback and teach negotiation techniques. The candidate should aim high but be prepared to justify their ask.`;
    }

    if (profile) {
      systemPrompt += `\n\nCandidate Background:
- Name: ${profile.identity?.name}
- Current Role: ${profile.experience_atoms?.[0]?.role} at ${profile.experience_atoms?.[0]?.company}
- Key Skills: ${profile.skills?.slice(0, 5).map((s: any) => s.name).join(', ')}`;
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
        starterMessage = `Hello! I'm excited to speak with you today about the ${job?.title || 'engineering'} role. Let's start with a technical question: Can you walk me through the architecture of a complex system you've built recently? What were the key technical decisions and trade-offs?`;
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

    const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: chatMessages
      }),
    });

    if (!llmResponse.ok) {
      console.error('[INTERVIEW] AI response failed');
      
      if (llmResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const llmData = await llmResponse.json();
    const content = llmData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ success: false, error: 'No response generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

  } catch (error) {
    // SECURITY: Never expose internal errors
    console.error('[ERROR] Interview coach error occurred');
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
