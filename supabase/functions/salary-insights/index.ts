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
    const { allowed, error: limitError } = await limiter.isAllowed('salary-insights', {
      free: { max: 5, window: 60 },
      pro: { max: 25, window: 60 }
    });

    if (!allowed) {
      return new Response(JSON.stringify({ error: limitError }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!LOVABLE_API_KEY && !GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { jobTitle, company, location, salaryRange, description } = await req.json();

    const prompt = `You are a compensation analyst. Analyze this job and provide salary insights.

Job: ${jobTitle} at ${company}
Location: ${location || 'Not specified'}
Listed Salary: ${salaryRange || 'Not listed'}
Description snippet: ${(description || '').slice(0, 500)}

You MUST call the function "salary_analysis" with your findings.`;

    // Use Gemini directly if available, otherwise use Lovable AI gateway
    const useGemini = !!GEMINI_API_KEY;
    const apiUrl = useGemini
      ? `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = useGemini ? GEMINI_API_KEY! : LOVABLE_API_KEY!;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: useGemini ? "gemini-2.5-flash" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a compensation expert. Always use the salary_analysis tool." },
          { role: "user", content: prompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "salary_analysis",
            description: "Return salary analysis data",
            parameters: {
              type: "object",
              properties: {
                estimatedRange: { type: "string", description: "e.g. '$120K - $160K'" },
                marketPosition: { type: "string", description: "e.g. 'Above Average', 'Competitive', 'Below Market'" },
                negotiationScript: { type: "string", description: "A 3-4 paragraph negotiation script the candidate can use, in markdown" },
                keyPoints: {
                  type: "array",
                  items: { type: "string" },
                  description: "3-5 key salary insights or leverage points"
                }
              },
              required: ["estimatedRange", "marketPosition", "negotiationScript", "keyPoints"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "salary_analysis" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const t = await response.text();
      console.error('[SALARY] AI error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fallback
    return new Response(JSON.stringify({
      estimatedRange: salaryRange || "Research needed",
      marketPosition: "Competitive",
      negotiationScript: "Research the company's compensation philosophy and prepare data points from similar roles in your area.",
      keyPoints: ["Research comparable roles on Levels.fyi", "Consider total compensation including equity and benefits"]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('[SALARY] Error:', error);
    return new Response(JSON.stringify({ error: 'Service unavailable' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
