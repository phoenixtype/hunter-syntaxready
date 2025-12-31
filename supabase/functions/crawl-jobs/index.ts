import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SECURITY: Generic error messages to avoid information disclosure
const GENERIC_SERVICE_ERROR = 'Service temporarily unavailable';
const GENERIC_AUTH_ERROR = 'Authentication required';
const GENERIC_SESSION_ERROR = 'Session expired or invalid';
const GENERIC_RATE_LIMIT_ERROR = 'Too many requests. Please try again later.';

// Rate limit configuration: 2 requests per minute (expensive Firecrawl + AI operations)
const RATE_LIMIT_MAX_REQUESTS = 2;
const RATE_LIMIT_WINDOW_SECONDS = 60;

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

/**
 * SECURITY: Server-side rate limiting using Supabase
 * Checks and increments rate limit counter atomically
 * @returns true if request is allowed, false if rate limited
 */
async function checkRateLimit(
  supabase: any,
  userId: string,
  functionName: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_function_name: functionName,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });

    if (error) {
      // SECURITY: Log error but don't block on rate limit check failure
      console.error('[RATE_LIMIT] Check failed, allowing request');
      return true;
    }

    return data === true;
  } catch (err) {
    console.error('[RATE_LIMIT] Exception during check');
    return true; // Fail open to avoid blocking legitimate users
  }
}

/**
 * SECURITY: Detect health check / crawler requests
 * Returns true for Supabase internal probes, load balancers, and security scanners
 */
function isHealthCheckRequest(req: Request): boolean {
  const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';
  const isProbe = 
    userAgent.includes('supabase') ||
    userAgent.includes('healthcheck') ||
    userAgent.includes('uptime') ||
    userAgent.includes('monitoring') ||
    userAgent.includes('crawler') ||
    userAgent.includes('bot') ||
    userAgent === '';
  
  // HEAD requests are typically health checks
  // GET without auth header on root path is also a health probe
  const isHealthMethod = req.method === 'HEAD' || 
    (req.method === 'GET' && !req.headers.get('Authorization'));
  
  return isProbe || isHealthMethod;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // HEALTH CHECK: Return 200 OK for crawlers/probes without executing business logic
  if (isHealthCheckRequest(req)) {
    return new Response(
      JSON.stringify({ status: 'healthy', service: 'crawl-jobs', timestamp: new Date().toISOString() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // SECURITY: Validate required environment variables server-side only
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[SECURITY] Missing required Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authorization header - required for business logic
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[AUTH] No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_AUTH_ERROR }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });
    
    // Verify the user's token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[AUTH] Token verification failed');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SESSION_ERROR }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for rate limiting and database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Server-side rate limiting - check BEFORE any business logic
    const isAllowed = await checkRateLimit(
      supabase,
      user.id,
      'crawl-jobs',
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_SECONDS
    );

    if (!isAllowed) {
      console.log('[RATE_LIMIT] User rate limited:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_RATE_LIMIT_ERROR }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS)
          } 
        }
      );
    }

    // SECURITY: Log user ID only, not email or other PII
    console.log('[AUTH] Authenticated user:', user.id);

    const { sources, keywords } = await req.json();
    
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // SECURITY: Don't reveal which specific service is missing
    if (!firecrawlApiKey || !lovableApiKey) {
      console.error('[CONFIG] Missing required API keys');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Default search sources and keywords
    const searchSources = sources || ['Y Combinator jobs', 'LinkedIn software engineer'];
    const searchKeywords = keywords || ['software engineer', 'full stack', 'frontend', 'backend'];
    
    console.log('[CRAWL] Starting job crawl, sources:', searchSources.length);
    
    const allJobs: any[] = [];
    
    // Search for jobs using Firecrawl
    for (const source of searchSources) {
      try {
        console.log(`[CRAWL] Searching source...`);
        
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
          console.error('[CRAWL] Search failed for source');
          continue;
        }

        const searchData = await searchResponse.json();
        console.log(`[CRAWL] Found ${searchData.data?.length || 0} results`);
        
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
        console.error('[CRAWL] Error searching source');
      }
    }

    console.log(`[CRAWL] Total raw results: ${allJobs.length}`);
    
    if (allJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, jobs: [], message: 'No jobs found from sources' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use LLM to normalize job data
    console.log(`[CRAWL] Normalizing jobs...`);
    
    const normalizeJob = async (rawJob: any) => {
      try {
        const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp',
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
          console.error('[NORMALIZE] LLM parsing failed');
          return null;
        }

        const llmData = await llmResponse.json();
        const toolCall = llmData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          
          if (parsed.valid !== false && (parsed.title || parsed.company)) {
            const jobHash = generateJobHash(parsed.company || 'Unknown', parsed.title || 'Unknown');
            const freshnessScore = calculateFreshnessScore(parsed.posted_at || '1 week ago');
            
            return {
              title: parsed.title || rawJob.title || 'Unknown Title',
              company: parsed.company || 'Unknown Company',
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
            };
          }
        }
        return null;
      } catch (err) {
        console.error('[NORMALIZE] Error normalizing job');
        return null;
      }
    };

    // Parallelize normalization with a limit or all at once if small
    const normalizationPromises = allJobs.slice(0, 10).map(normalizeJob);
    const normalizedResults = await Promise.all(normalizationPromises);
    const normalizedJobs = normalizedResults.filter(Boolean);

    console.log(`[CRAWL] Successfully normalized ${normalizedJobs.length} jobs`);

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
            console.error('[DB] Insert error');
          }
        } else {
          inserted++;
        }
      } catch (err) {
        console.error('[DB] Database error');
      }
    }

    console.log(`[CRAWL] Inserted ${inserted} new, ${duplicates} duplicates`);

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
    // SECURITY: Never expose internal error messages to clients
    console.error('[ERROR] Crawl error occurred');
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
