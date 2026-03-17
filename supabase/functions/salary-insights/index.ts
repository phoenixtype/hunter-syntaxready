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

    const { callAI, MODEL_FAST } = await import('../_shared/ai-client.ts');

    const { jobTitle, company, location, salaryRange, description } = await req.json();

    // Fetch real market compensation data via Firecrawl before AI analysis
    let marketData = '';
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (firecrawlKey && jobTitle) {
      try {
        const locationQuery = location && !location.toLowerCase().includes('remote') ? location : 'United States';
        const [levelsRes, marketRes] = await Promise.allSettled([
          fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `${jobTitle} salary compensation levels.fyi ${locationQuery}`,
              limit: 2,
              scrapeOptions: { formats: ['markdown'] }
            }),
            signal: AbortSignal.timeout(10000),
          }),
          fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `${jobTitle} ${company || ''} salary range 2024 2025 glassdoor linkedin`,
              limit: 2,
              scrapeOptions: { formats: ['markdown'] }
            }),
            signal: AbortSignal.timeout(10000),
          }),
        ]);

        const allSnippets: string[] = [];
        for (const result of [levelsRes, marketRes]) {
          if (result.status === 'fulfilled' && result.value.ok) {
            const data = await result.value.json();
            for (const r of (data.data || []).slice(0, 2)) {
              if (r.markdown) allSnippets.push(`Source: ${r.url}\n${r.markdown.substring(0, 600)}`);
            }
          }
        }
        marketData = allSnippets.join('\n\n---\n\n');
        console.log(`[SALARY] Fetched market data: ${marketData.length} chars`);
      } catch (err) {
        console.warn('[SALARY] Market data fetch failed (non-fatal):', err);
      }
    }

    const prompt = `You are a compensation analyst. Analyze this job and provide salary insights.

Job: ${jobTitle} at ${company}
Location: ${location || 'Not specified'}
Listed Salary: ${salaryRange || 'Not listed'}
Description snippet: ${(description || '').slice(0, 500)}

${marketData ? `Real Market Compensation Data (scraped from salary sites and job boards):\n${marketData.substring(0, 3000)}` : ''}

Use the real market data above to ground your analysis. You MUST call the function "salary_analysis" with your findings.`;

    const aiResult = await callAI(
      MODEL_FAST,
      [
        { role: "system", content: "You are a compensation expert. Always use the salary_analysis tool." },
        { role: "user", content: prompt },
      ],
      {
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
        tool_choice: { type: "function", function: { name: "salary_analysis" } },
      },
    );

    const toolCall = aiResult.tool_calls?.[0];
    
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
