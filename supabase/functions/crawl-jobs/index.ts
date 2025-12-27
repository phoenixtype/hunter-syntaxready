import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a hash for deduplication
function generateJobHash(company: string, title: string): string {
  const str = `${company.toLowerCase().trim()}-${title.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Calculate freshness score based on posting time
function calculateFreshnessScore(postedAt: string): number {
  const hoursMatch = postedAt.match(/(\d+)\s*hour/i);
  const daysMatch = postedAt.match(/(\d+)\s*day/i);
  const weeksMatch = postedAt.match(/(\d+)\s*week/i);
  
  let hoursAgo = 0;
  if (hoursMatch) hoursAgo = parseInt(hoursMatch[1]);
  else if (daysMatch) hoursAgo = parseInt(daysMatch[1]) * 24;
  else if (weeksMatch) hoursAgo = parseInt(weeksMatch[1]) * 24 * 7;
  else hoursAgo = 168; // Default to 1 week if unknown
  
  // Score decreases over time, 1.0 for brand new, ~0.5 for 1 week old
  return Math.max(0.1, 1 - (hoursAgo / 336));
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
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    const { sources, keywords } = await req.json();
    
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Default search sources and keywords
    const searchSources = sources || ['Y Combinator jobs', 'LinkedIn software engineer'];
    const searchKeywords = keywords || ['software engineer', 'full stack', 'frontend', 'backend'];
    
    console.log('Starting job crawl with sources:', searchSources);
    
    const allJobs: any[] = [];
    
    // Search for jobs using Firecrawl
    for (const source of searchSources) {
      try {
        console.log(`Searching: ${source}`);
        
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `${source} jobs hiring ${searchKeywords.join(' OR ')}`,
            limit: 10,
            scrapeOptions: {
              formats: ['markdown']
            }
          }),
        });

        if (!searchResponse.ok) {
          console.error(`Firecrawl search failed for ${source}:`, await searchResponse.text());
          continue;
        }

        const searchData = await searchResponse.json();
        console.log(`Found ${searchData.data?.length || 0} results for ${source}`);
        
        if (searchData.data && searchData.data.length > 0) {
          for (const result of searchData.data) {
            allJobs.push({
              url: result.url,
              title: result.title,
              content: result.markdown || result.description,
              source: source.includes('LinkedIn') ? 'LinkedIn' : 
                      source.includes('Y Combinator') ? 'Firecrawl' : 'Direct'
            });
          }
        }
      } catch (err) {
        console.error(`Error searching ${source}:`, err);
      }
    }

    console.log(`Total raw results: ${allJobs.length}`);
    
    if (allJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, jobs: [], message: 'No jobs found from sources' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use LLM to normalize job data
    const normalizedJobs: any[] = [];
    
    for (const rawJob of allJobs.slice(0, 10)) { // Limit to 10 to save API calls
      try {
        console.log(`Normalizing job from: ${rawJob.url}`);
        
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
                content: `You are a job listing parser. Extract structured job information from the provided content. 
                Return a JSON object with these fields:
                - title: job title (string)
                - company: company name (string)
                - location: location or "Remote" (string)
                - salary_range: salary range if mentioned, otherwise "Not specified" (string)
                - description: brief job description (string, max 200 chars)
                - tech_stack: array of technologies mentioned (string array)
                - posted_at: when it was posted, e.g. "2 hours ago", "1 day ago" (string)
                
                If you cannot extract valid job info, return {"valid": false}.
                Always return valid JSON only, no markdown.`
              },
              {
                role: 'user',
                content: `Parse this job listing:\n\nTitle: ${rawJob.title}\nURL: ${rawJob.url}\nContent: ${rawJob.content?.substring(0, 2000) || 'No content'}`
              }
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'extract_job_info',
                  description: 'Extract structured job information',
                  parameters: {
                    type: 'object',
                    properties: {
                      valid: { type: 'boolean' },
                      title: { type: 'string' },
                      company: { type: 'string' },
                      location: { type: 'string' },
                      salary_range: { type: 'string' },
                      description: { type: 'string' },
                      tech_stack: { type: 'array', items: { type: 'string' } },
                      posted_at: { type: 'string' }
                    },
                    required: ['valid']
                  }
                }
              }
            ],
            tool_choice: { type: 'function', function: { name: 'extract_job_info' } }
          }),
        });

        if (!llmResponse.ok) {
          console.error('LLM parsing failed:', await llmResponse.text());
          continue;
        }

        const llmData = await llmResponse.json();
        const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          
          if (parsed.valid !== false && parsed.title && parsed.company) {
            const jobHash = generateJobHash(parsed.company, parsed.title);
            const freshnessScore = calculateFreshnessScore(parsed.posted_at || '1 week ago');
            
            normalizedJobs.push({
              title: parsed.title,
              company: parsed.company,
              location: parsed.location || 'Remote',
              salary_range: parsed.salary_range || 'Not specified',
              description: parsed.description || '',
              source: rawJob.source,
              freshness_score: freshnessScore,
              credibility_score: 0.8,
              url: rawJob.url,
              posted_at: parsed.posted_at || 'Recently',
              tech_stack: parsed.tech_stack || [],
              job_hash: jobHash,
              raw_data: rawJob
            });
          }
        }
      } catch (err) {
        console.error('Error normalizing job:', err);
      }
    }

    console.log(`Normalized ${normalizedJobs.length} jobs`);

    // Insert jobs into database with deduplication
    let inserted = 0;
    let duplicates = 0;
    
    for (const job of normalizedJobs) {
      try {
        const { error } = await supabase
          .from('job_listings')
          .upsert(job, { 
            onConflict: 'job_hash',
            ignoreDuplicates: true 
          });
        
        if (error) {
          if (error.code === '23505') { // Unique violation
            duplicates++;
          } else {
            console.error('Insert error:', error);
          }
        } else {
          inserted++;
        }
      } catch (err) {
        console.error('Database error:', err);
      }
    }

    console.log(`Inserted ${inserted} new jobs, ${duplicates} duplicates skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted,
        duplicates,
        total: normalizedJobs.length,
        jobs: normalizedJobs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Crawl error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
