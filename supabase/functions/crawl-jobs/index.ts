import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GENERIC_SERVICE_ERROR = 'Service temporarily unavailable';
const GENERIC_AUTH_ERROR = 'Authentication required';
const GENERIC_SESSION_ERROR = 'Session expired or invalid';
const GENERIC_RATE_LIMIT_ERROR = 'Too many requests. Please try again later.';

const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// Max jobs to process per search pass
const MAX_JOBS_PER_PASS = 30;

// ─── Utility helpers ──────────────────────────────────────────────────────────

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

/** Freshness from a Unix timestamp (seconds) */
function calculateFreshnessFromTimestamp(timestamp: number): number {
  if (!timestamp) return 0.5;
  const hoursAgo = (Date.now() / 1000 - timestamp) / 3600;
  return Math.max(0.1, 1 - (hoursAgo / 336)); // decays over 2 weeks
}

/** Freshness from a relative string like "2 days ago" */
function calculateFreshnessFromString(postedAt: string): number {
  const hoursMatch = postedAt.match(/(\d+)\s*hour/i);
  const daysMatch  = postedAt.match(/(\d+)\s*day/i);
  const weeksMatch = postedAt.match(/(\d+)\s*week/i);
  let hoursAgo = 168;
  if (hoursMatch) hoursAgo = parseInt(hoursMatch[1]);
  else if (daysMatch) hoursAgo = parseInt(daysMatch[1]) * 24;
  else if (weeksMatch) hoursAgo = parseInt(weeksMatch[1]) * 24 * 7;
  return Math.max(0.1, 1 - (hoursAgo / 336));
}

function sanitizeJobTitle(title: string): string {
  let clean = title;
  clean = clean.replace(/^\d[\d,]*\s+/, '');
  clean = clean.replace(/\s*[|\-–—]\s*(Glassdoor|Indeed|LinkedIn|ZipRecruiter|Monster|SimplyHired|Dice|CareerBuilder|AngelList).*$/i, '');
  clean = clean.replace(/\s+jobs?\s+in\s+.*/i, '');
  clean = clean.replace(/,?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i, '');
  clean = clean.replace(/\s+(jobs?|hiring|openings?|positions?|opportunities?)$/i, '');
  return clean.trim() || title;
}

// ─── Rate limiting ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkRateLimit(supabase: any, userId: string, functionName: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('check_rate_limit', {
      p_user_id: userId,
      p_function_name: functionName,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds
    });
    if (error) { console.error('[RATE_LIMIT] Check failed, blocking request'); return false; }
    return data === true;
  } catch { console.error('[RATE_LIMIT] Exception, blocking'); return false; }
}

function isHealthCheckRequest(req: Request): boolean {
  const ua = req.headers.get('user-agent')?.toLowerCase() || '';
  const isProbe = ua.includes('supabase') || ua.includes('healthcheck') || ua.includes('uptime') || ua.includes('monitoring') || ua.includes('crawler') || ua.includes('bot') || ua === '';
  const isHealthMethod = req.method === 'HEAD' || (req.method === 'GET' && !req.headers.get('Authorization'));
  return isProbe || isHealthMethod;
}

// ─── Tech stack extractor (parses description text) ──────────────────────────

const TECH_KEYWORDS = [
  // Languages
  'JavaScript','TypeScript','Python','Java','Kotlin','Swift','Go','Rust','C++','C#','Ruby','PHP','Scala','Dart','R',
  // Frontend
  'React','Vue','Angular','Next.js','Nuxt','Svelte','Redux','GraphQL','HTML','CSS','Tailwind','Bootstrap','Webpack','Vite',
  // Backend
  'Node.js','Express','FastAPI','Django','Flask','Spring','Rails','Laravel','NestJS','tRPC',
  // Mobile
  'React Native','Flutter','iOS','Android','Expo',
  // Cloud/DevOps
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','CI/CD','GitHub Actions','Jenkins','Ansible',
  // Data/AI
  'SQL','PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','Kafka','Spark','dbt','Airflow','PyTorch','TensorFlow','LangChain','OpenAI',
  // Tools/Platforms
  'Supabase','Firebase','Vercel','Netlify','Stripe','Twilio','Salesforce','Jira','Git','Linux',
  // Soft/Process
  'REST','API','Microservices','Agile','Scrum',
];

const KEYWORD_REGEX = new RegExp(
  `\\b(${TECH_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

function extractTechStack(description: string): string[] {
  const matches = description.match(KEYWORD_REGEX) || [];
  // Deduplicate preserving original casing of first occurrence
  const seen = new Map<string, string>();
  for (const m of matches) {
    const key = m.toLowerCase();
    if (!seen.has(key)) seen.set(key, m);
  }
  return Array.from(seen.values()).slice(0, 12);
}

// ─── JSearch API (search mode) ─────────────────────────────────────────────────

interface JSearchJob {
  employer_name: string;
  employer_logo?: string;
  employer_website?: string;
  job_id: string;
  job_title: string;
  job_apply_link: string;
  job_description: string;
  job_is_remote: boolean;
  job_posted_at_timestamp?: number;
  job_posted_at_datetime_utc?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_required_skills?: string[];
  job_salary_string?: string;
  job_employment_type?: string;
}

async function jsearchFetch(apiKey: string, query: string, remoteOnly: boolean): Promise<JSearchJob[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const params = new URLSearchParams({
      query,
      num_pages: '2',
      date_posted: 'month',
    });
    if (remoteOnly) params.set('remote_jobs_only', 'true');

    console.log(`[JSEARCH] Query: "${query}" remote=${remoteOnly}`);
    const response = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[JSEARCH] Request failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const jobs: JSearchJob[] = data.data || [];
    console.log(`[JSEARCH] Got ${jobs.length} results for "${query}"`);
    return jobs;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[JSEARCH] Error for "${query}":`, err);
    return [];
  }
}

function mapJSearchJob(item: JSearchJob): Record<string, unknown> {
  // Build location string
  let location = 'Remote';
  if (!item.job_is_remote) {
    const parts = [item.job_city, item.job_state, item.job_country].filter(Boolean);
    location = parts.join(', ') || 'Not specified';
  }

  // Salary range
  let salary_range = 'Not specified';
  if (item.job_min_salary && item.job_max_salary) {
    const currency = item.job_salary_currency || 'USD';
    salary_range = `$${Math.round(item.job_min_salary / 1000)}K–$${Math.round(item.job_max_salary / 1000)}K ${currency}`;
  } else if (item.job_min_salary) {
    salary_range = `$${Math.round(item.job_min_salary / 1000)}K+ ${item.job_salary_currency || 'USD'}`;
  }

  const title = sanitizeJobTitle(item.job_title || 'Unknown Title');
  const company = item.employer_name || 'Unknown Company';

  const description = item.job_description || '';
  const tech_stack = (item.job_required_skills && item.job_required_skills.length > 0)
    ? item.job_required_skills
    : extractTechStack(description);

  // Also use job_salary_string as fallback if min/max not set
  if (salary_range === 'Not specified' && (item as Record<string, unknown>).job_salary_string) {
    salary_range = (item as Record<string, unknown>).job_salary_string as string;
  }

  return {
    title,
    company,
    location,
    salary_range,
    description: description.substring(0, 15000),
    source: 'JSearch',
    freshness_score: calculateFreshnessFromTimestamp(item.job_posted_at_timestamp || 0),
    credibility_score: 0.92,
    url: item.job_apply_link || '',
    posted_at: item.job_posted_at_datetime_utc || new Date().toISOString(),
    tech_stack,
    job_hash: generateJobHash(company, title),
    raw_data: { job_id: item.job_id, employer_website: item.employer_website },
  };
}

// ─── Firecrawl (URL scrape mode only) ─────────────────────────────────────────

async function firecrawlScrapeUrl(apiKey: string, url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ url, formats: ['markdown'] }),
    });
    clearTimeout(timeoutId);
    if (!response.ok) { console.error(`[FIRECRAWL] Scrape failed: ${response.status}`); return ''; }
    const data = await response.json();
    return data.data?.markdown || '';
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[FIRECRAWL] Scrape exception', err);
    return '';
  }
}

// ─── Gemini normalization (URL scrape mode only) ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function normalizeWithGemini(geminiKey: string, rawJob: { title: string; url: string; content: string; source: string }): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const llmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `You are a job listing parser. Extract structured job information from the provided content.
Return a JSON object:
- title: clean job title only (remove site suffixes, numbers, location suffixes)
- company: company name (if only an aggregator name like Glassdoor/Indeed, return "Unknown Company")
- location: location or "Remote"
- salary_range: salary if mentioned, else "Not specified"
- description: detailed description of the role, including responsibilities and requirements
- tech_stack: array of required skills/technologies
- posted_at: when posted e.g. "2 days ago"
- valid: false if this is a search results page or aggregation page, not a single job posting

Return only valid JSON, no markdown.

Title: ${rawJob.title}
URL: ${rawJob.url}
Content: ${rawJob.content.substring(0, 15000)}`
          }]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      }),
    });
    clearTimeout(timeoutId);

    if (!llmResponse.ok) {
      console.error(`[GEMINI] Failed: ${llmResponse.status}`);
      return null;
    }

    const llmData = await llmResponse.json();
    const text = llmData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (parsed.valid === false || (!parsed.title && !parsed.company)) return null;

    const title = sanitizeJobTitle(parsed.title || rawJob.title || 'Unknown Title');
    const company = parsed.company || 'Unknown Company';

    return {
      title,
      company,
      location: parsed.location || 'Remote',
      salary_range: parsed.salary_range || 'Not specified',
      description: parsed.description || '',
      source: rawJob.source,
      freshness_score: calculateFreshnessFromString(parsed.posted_at || '1 week ago'),
      credibility_score: 0.85,
      url: rawJob.url,
      posted_at: parsed.posted_at || 'Recently',
      tech_stack: parsed.tech_stack || [],
      job_hash: generateJobHash(company, title),
      raw_data: rawJob,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[GEMINI] Normalization error:', err);
    return null;
  }
}

// ─── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check
  if (isHealthCheckRequest(req)) {
    return new Response(
      JSON.stringify({ status: 'healthy', service: 'crawl-jobs' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('[CONFIG] Missing Supabase env vars');
      return new Response(JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: GENERIC_AUTH_ERROR }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: GENERIC_SESSION_ERROR }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const isAllowed = await checkRateLimit(supabase, user.id, 'crawl-jobs', RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS);
    if (!isAllowed) {
      return new Response(JSON.stringify({ success: false, error: GENERIC_RATE_LIMIT_ERROR }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS) } });
    }

    console.log('[AUTH] User:', user.id);

    const body = await req.json();
    const { keywords, url, location, locations, remotePolicy, targetRoles } = body;

    // ─── Cleanup Stale Jobs (older than 30 days) ──────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { error: cleanupError, count: deletedCount } = await supabase
      .from('job_listings')
      .delete({ count: 'exact' })
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (cleanupError) {
      console.error('[CLEANUP] Error pruning stale jobs:', cleanupError);
    } else {
      console.log(`[CLEANUP] Pruned ${deletedCount || 0} stale jobs older than 30 days`);
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const jsearchApiKey = Deno.env.get('JSEARCH_API_KEY');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allJobs: any[] = [];

    if (url) {
      // ── URL SCRAPE MODE (uses Firecrawl + Gemini) ──────────────────────────
      if (!firecrawlApiKey || !geminiApiKey) {
        console.error('[CONFIG] Missing Firecrawl or Gemini key for URL scrape');
        return new Response(JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log(`[SCRAPE] URL: ${url}`);
      const markdown = await firecrawlScrapeUrl(firecrawlApiKey, url);

      if (!markdown) {
        return new Response(JSON.stringify({ success: false, error: 'Could not extract content from the job page. Ensure the URL is publicly accessible.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const normalized = await normalizeWithGemini(geminiApiKey, { title: 'Scraped Job', url, content: markdown, source: 'Direct' });
      if (normalized) allJobs.push(normalized);

    } else {
      // ── SEARCH MODE (uses JSearch) ─────────────────────────────────────────
      if (!jsearchApiKey) {
        console.error('[CONFIG] Missing JSEARCH_API_KEY — cannot run job search');
        return new Response(JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const searchRoles  = Array.isArray(targetRoles) ? targetRoles.filter(Boolean).map(String) : [];
      const searchKws    = Array.isArray(keywords) ? keywords.filter(Boolean).map(String) : [];
      // Prefer the new locations array; fall back to a single location string for backward compat
      const searchLocs: string[] = Array.isArray(locations) && locations.length > 0
        ? locations.filter(Boolean).map(String).slice(0, 2)
        : (typeof location === 'string' && location.trim() ? [location.trim()] : []);
      const isRemote     = remotePolicy === 'remote';

      const primaryRole = searchRoles[0] || 'software engineer';
      const queries: string[] = [];

      // For each preferred location, build a "role + location" query + optional keywords query
      // If no location preference, build queries without location suffix
      const effectiveLocs = searchLocs.length > 0 ? searchLocs : [''];
      for (const loc of effectiveLocs) {
        const locSuffix = loc ? ` ${loc}` : '';
        // Role + location
        queries.push(`${primaryRole}${locSuffix}`.trim());
        // Role + top keywords + location (only for first location to stay under quota)
        if (loc === effectiveLocs[0] && searchKws.length > 0) {
          const keywordsForQuery = searchKws.slice(0, 3).join(' ');
          queries.push(`${primaryRole} ${keywordsForQuery}${locSuffix}`.trim());
        }
      }

      // Alternative role query (without extra location, deduplication handles overlap)
      if (searchRoles[1] && queries.length < 4) {
        const locSuffix = searchLocs[0] ? ` ${searchLocs[0]}` : '';
        queries.push(`${searchRoles[1]}${locSuffix}`.trim());
      }

      // Contract / freelance variant to surface gig opportunities
      if (queries.length < 5) {
        const locSuffix = searchLocs[0] ? ` ${searchLocs[0]}` : '';
        queries.push(`${primaryRole} contract${locSuffix}`.trim());
      }

      console.log(`[JSEARCH] Running ${queries.length} queries for locations: ${searchLocs.join(', ') || '(any)'}`);

      const searchResults = await Promise.allSettled(
        queries.map(q => jsearchFetch(jsearchApiKey, q, isRemote))
      );

      // Deduplicate by job_id across queries
      const seenIds = new Set<string>();
      for (const result of searchResults) {
        if (result.status !== 'fulfilled') continue;
        for (const item of result.value) {
          if (!item.job_id || seenIds.has(item.job_id)) continue;
          seenIds.add(item.job_id);
          allJobs.push(mapJSearchJob(item));
        }
      }

      console.log(`[JSEARCH] Total unique jobs: ${allJobs.length}`);
    }

    if (allJobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted: 0, duplicates: 0, total: 0, jobs: [], message: 'No jobs found. Try adjusting your search preferences.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert into job_listings
    let inserted = 0;
    let duplicates = 0;

    for (const job of allJobs.slice(0, MAX_JOBS_PER_PASS)) {
      try {
        const { error } = await supabase
          .from('job_listings')
          .upsert(job, { onConflict: 'job_hash', ignoreDuplicates: true });

        if (error) {
          if (error.code === '23505') duplicates++;
          else console.error('[DB] Upsert error:', error.code);
        } else {
          inserted++;
        }
      } catch (err) {
        console.error('[DB] Exception during upsert');
      }
    }

    console.log(`[DONE] Inserted ${inserted}, duplicates ${duplicates}`);

    return new Response(
      JSON.stringify({ success: true, inserted, duplicates, total: allJobs.length, jobs: allJobs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ERROR] Unhandled exception in crawl-jobs');
    return new Response(
      JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
