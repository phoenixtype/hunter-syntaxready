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

// Rate limit configuration: 10 requests per minute
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Max jobs to normalize per crawl (balance between coverage and timeout)
const MAX_NORMALIZE = 25;

// Sanitize job titles: remove number prefixes, site suffixes, aggregation patterns
function sanitizeJobTitle(title: string): string {
  let clean = title;
  // Remove leading numbers like "332 " or "1,234 "
  clean = clean.replace(/^\d[\d,]*\s+/, '');
  // Remove trailing site names like "| Glassdoor", "- Indeed", "| LinkedIn"
  clean = clean.replace(/\s*[|\-–—]\s*(Glassdoor|Indeed|LinkedIn|ZipRecruiter|Monster|SimplyHired|Dice|CareerBuilder|AngelList).*$/i, '');
  // Remove "Jobs in City, State" patterns
  clean = clean.replace(/\s+jobs?\s+in\s+.*/i, '');
  // Remove trailing date patterns like ", February 2026"
  clean = clean.replace(/,?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i, '');
  // Remove trailing "Jobs" or "Hiring"
  clean = clean.replace(/\s+(jobs?|hiring|openings?|positions?|opportunities?)$/i, '');
  return clean.trim() || title;
}

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

  return Math.max(0.1, 1 - (hoursAgo / 336));
}

/**
 * Build search queries from user preferences for Firecrawl.
 * Returns 2 complementary queries to maximize result diversity.
 */
function buildSearchQueries(
  keywords: string[],
  targetRoles: string[],
  location: string,
  remotePolicy: string
): string[] {
  const locationPart = location ? ` ${location}` : '';
  const remotePart = remotePolicy === 'remote' ? ' remote' :
                     remotePolicy === 'hybrid' ? ' hybrid' :
                     remotePolicy === 'onsite' ? ' onsite' : '';

  const queries: string[] = [];

  // Query 1: Role-focused on primary job boards
  if (targetRoles.length > 0) {
    queries.push(`${targetRoles[0]} jobs${remotePart}${locationPart} hiring`.trim());
    // Query 2: Alternative role if available
    if (targetRoles.length > 1) {
      queries.push(`${targetRoles[1]} jobs${remotePart}${locationPart} open positions`.trim());
    }
  }

  // Query 3: Skills-focused
  if (keywords.length > 0) {
    const skillsPart = keywords.slice(0, 4).join(' ');
    queries.push(`${skillsPart} developer jobs${remotePart}${locationPart}`.trim());
  }

  // Query 4: LinkedIn/Indeed style search
  if (targetRoles.length > 0) {
    queries.push(`site:linkedin.com/jobs ${targetRoles[0]}${remotePart}${locationPart}`.trim());
  }

  // Query 5: Broader search with skills
  if (keywords.length > 2) {
    const altSkills = keywords.slice(2, 5).join(' ');
    queries.push(`${altSkills} engineer jobs${remotePart}${locationPart} 2026`.trim());
  }

  // Fallback
  if (queries.length === 0) {
    queries.push(`software engineer jobs${remotePart}${locationPart} hiring now`.trim());
    queries.push(`developer jobs${remotePart}${locationPart} open positions 2026`.trim());
  }

  return queries;
}

/**
 * SECURITY: Server-side rate limiting using Supabase
 */
async function checkRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  functionName: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('check_rate_limit', {
      p_user_id: userId,
      p_function_name: functionName,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });

    if (error) {
      console.error('[RATE_LIMIT] Check failed, blocking request');
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[RATE_LIMIT] Exception during check, blocking request');
    return false;
  }
}

/**
 * SECURITY: Detect health check / crawler requests
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

  const isHealthMethod = req.method === 'HEAD' ||
    (req.method === 'GET' && !req.headers.get('Authorization'));

  return isProbe || isHealthMethod;
}

/**
 * Execute a single Firecrawl search query with timeout
 */
async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    console.log(`[CRAWL] Firecrawl search: "${query}" (limit: ${limit})`);
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({ query, limit }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CRAWL] Search failed: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const results = data.data || [];
    console.log(`[CRAWL] Got ${results.length} results for: "${query}"`);
    return results;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[CRAWL] Search error for "${query}":`, err);
    return [];
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // HEALTH CHECK
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

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[SECURITY] Missing required Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_AUTH_ERROR }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SESSION_ERROR }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting
    const isAllowed = await checkRateLimit(
      supabase, user.id, 'crawl-jobs',
      RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS
    );

    if (!isAllowed) {
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_RATE_LIMIT_ERROR }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS) } }
      );
    }

    console.log('[AUTH] Authenticated user:', user.id);

    const body = await req.json();
    const { keywords, url, location, remotePolicy, targetRoles } = body;

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!firecrawlApiKey || !geminiApiKey) {
      console.error('[SECURITY] Missing required API keys (Firecrawl or Gemini)');
      return new Response(
        JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allJobs: any[] = [];

    if (url) {
      // ── SINGLE URL SCRAPE MODE ──
      console.log(`[CRAWL] Scraping specific URL: ${url}`);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({ url, formats: ['markdown'] }),
        });
        clearTimeout(timeoutId);

        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          const markdown = scrapeData.data?.markdown || '';
          console.log('[CRAWL] Scrape successful');
          allJobs.push({ title: 'Scraped Job', url, content: markdown, source: 'Direct' });
        } else {
          console.error(`[CRAWL] Scrape failed: ${scrapeResponse.status}`);
        }
      } catch (err) {
        console.error('[CRAWL] Scrape exception', err);
      }

    } else {
      // ── SEARCH MODE ──
      // Build smart queries from user preferences
      const searchKeywords = Array.isArray(keywords) ? keywords.filter(Boolean).map(String) : [];
      const searchRoles = Array.isArray(targetRoles) ? targetRoles.filter(Boolean).map(String) : [];
      const searchLocation = typeof location === 'string' ? location : '';
      const searchRemote = typeof remotePolicy === 'string' ? remotePolicy : 'any';

      const queries = buildSearchQueries(searchKeywords, searchRoles, searchLocation, searchRemote);
      console.log(`[CRAWL] Running ${queries.length} search queries`);

      // Run searches in parallel for speed
      const searchResults = await Promise.allSettled(
        queries.map(q => firecrawlSearch(firecrawlApiKey, q, 10))
      );

      // Deduplicate by URL across search results
      const seenUrls = new Set<string>();
      for (const result of searchResults) {
        if (result.status !== 'fulfilled') continue;
        for (const res of result.value) {
          if (!res.url || seenUrls.has(res.url)) continue;
          seenUrls.add(res.url);
          allJobs.push({
            title: res.title || 'Untitled Job',
            url: res.url,
            content: res.markdown || res.content || res.description || '',
            source: 'Firecrawl'
          });
        }
      }

      console.log(`[CRAWL] Total unique results: ${allJobs.length}`);
    }

    // ── NORMALIZE WITH AI ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalizeJob = async (rawJob: any) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const llmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{
                  text: `You are a universal job listing parser. Extract structured job information from the provided content for ANY industry.
Return a JSON object with these fields:
- title: the ACTUAL job title only (string). CRITICAL: Remove any number prefixes like "332 ", remove site suffixes like "| Glassdoor", "| Indeed", "| LinkedIn". Remove location/date info from the title. Example: "332 java developer Jobs in Alpharetta, GA, February 2026 | Glassdoor" should become "Java Developer". Only return the clean role name.
- company: company name (string). If only an aggregator site name is found (Glassdoor, Indeed, LinkedIn, ZipRecruiter), return "Unknown Company".
- location: location or "Remote" (string)
- salary_range: salary range if mentioned, otherwise "Not specified" (string)
- description: brief job description (string, max 200 chars)
- tech_stack: array of HARD SKILLS or TECHNOLOGIES required
- posted_at: when it was posted, e.g. "2 hours ago", "1 day ago" (string)
- valid: boolean. Set to FALSE if this is a search results page or job listing aggregation page (e.g. "332 jobs in ...") rather than a single specific job posting. Only set true for individual job postings.

If you cannot extract valid job info, return {"valid": false}.
Always return valid JSON only, no markdown.

Parse this job listing:

Title: ${rawJob.title}
URL: ${rawJob.url}
Content: ${(rawJob.content || '').substring(0, 2000)}`
                }]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          }),
        });
        clearTimeout(timeoutId);

        if (!llmResponse.ok) {
          const errText = await llmResponse.text().catch(() => 'no body');
          console.error(`[NORMALIZE] LLM failed: ${llmResponse.status} - ${errText}`);
          // Fall back to basic extraction instead of returning null
          const jobHash = generateJobHash(rawJob.title || 'Unknown', rawJob.url || 'Unknown');
          return {
            title: rawJob.title || 'Untitled Job',
            company: 'Unknown Company',
            location: 'Remote',
            salary_range: 'Not specified',
            description: (rawJob.content || '').substring(0, 200),
            source: rawJob.source,
            freshness_score: 0.5,
            credibility_score: 0.5,
            url: rawJob.url,
            posted_at: 'Recently',
            tech_stack: [],
            job_hash: jobHash,
            raw_data: rawJob
          };
        }

        const llmData = await llmResponse.json();
        const textContent = llmData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (textContent) {
          const parsed = JSON.parse(textContent);

          if (parsed.valid !== false && (parsed.title || parsed.company)) {
            const jobHash = generateJobHash(parsed.company || 'Unknown', parsed.title || 'Unknown');
            const freshnessScore = calculateFreshnessScore(parsed.posted_at || '1 week ago');

            return {
              title: sanitizeJobTitle(parsed.title || rawJob.title || 'Unknown Title'),
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
        console.error('[NORMALIZE] Error normalizing job, using fallback:', err);
        return {
          title: rawJob.title || 'Untitled Job',
          company: 'Unknown Company',
          location: 'Remote',
          salary_range: 'Not specified',
          description: (rawJob.content || '').substring(0, 200),
          source: rawJob.source,
          freshness_score: 0.5,
          credibility_score: 0.5,
          url: rawJob.url,
          posted_at: 'Unknown',
          tech_stack: [],
          job_hash: generateJobHash('Unknown', rawJob.title || 'Untitled'),
          raw_data: rawJob
        };
      }
    };

    // Normalize up to MAX_NORMALIZE jobs in parallel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let normalizedJobs: any[] = [];

    if (allJobs.length > 0) {
      const results = await Promise.allSettled(
        allJobs.slice(0, MAX_NORMALIZE).map(normalizeJob)
      );
      normalizedJobs = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => (r as PromiseFulfilledResult<unknown>).value);
    }

    console.log(`[CRAWL] Successfully normalized ${normalizedJobs.length} jobs`);

    if (normalizedJobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true, inserted: 0, duplicates: 0, total: 0, jobs: [],
          message: 'No jobs found matching your criteria. Try different keywords.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert with deduplication
    let inserted = 0;
    let duplicates = 0;

    for (const job of normalizedJobs) {
      try {
        const { error } = await supabase
          .from('job_listings')
          .upsert(job, { onConflict: 'job_hash', ignoreDuplicates: true });

        if (error) {
          if (error.code === '23505') duplicates++;
          else console.error('[DB] Insert error');
        } else {
          inserted++;
        }
      } catch (err) {
        console.error('[DB] Database error');
      }
    }

    console.log(`[CRAWL] Inserted ${inserted} new, ${duplicates} duplicates`);

    return new Response(
      JSON.stringify({ success: true, inserted, duplicates, total: normalizedJobs.length, jobs: normalizedJobs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ERROR] Crawl error occurred');
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
