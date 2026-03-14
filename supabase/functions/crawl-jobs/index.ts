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

function isHealthCheckRequest(req: Request): boolean {
  const ua = req.headers.get('user-agent')?.toLowerCase() || '';
  const isProbe = ua.includes('supabase') || ua.includes('healthcheck') || ua.includes('uptime') || ua.includes('monitoring') || ua.includes('crawler') || ua.includes('bot') || ua === '';
  const isHealthMethod = req.method === 'HEAD' || (req.method === 'GET' && !req.headers.get('Authorization'));
  return isProbe || isHealthMethod;
}

// ─── Tech stack extractor ─────────────────────────────────────────────────────

const TECH_KEYWORDS = [
  'JavaScript','TypeScript','Python','Java','Kotlin','Swift','Go','Rust','C++','C#','Ruby','PHP','Scala','Dart','R',
  'React','Vue','Angular','Next.js','Nuxt','Svelte','Redux','GraphQL','HTML','CSS','Tailwind','Bootstrap','Webpack','Vite',
  'Node.js','Express','FastAPI','Django','Flask','Spring','Rails','Laravel','NestJS','tRPC',
  'React Native','Flutter','iOS','Android','Expo',
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','CI/CD','GitHub Actions','Jenkins','Ansible',
  'SQL','PostgreSQL','MySQL','MongoDB','Redis','Elasticsearch','Kafka','Spark','dbt','Airflow','PyTorch','TensorFlow','LangChain','OpenAI',
  'Supabase','Firebase','Vercel','Netlify','Stripe','Twilio','Salesforce','Jira','Git','Linux',
  'REST','API','Microservices','Agile','Scrum',
];

const KEYWORD_REGEX = new RegExp(
  `\\b(${TECH_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'gi'
);

function extractTechStack(description: string): string[] {
  const matches = description.match(KEYWORD_REGEX) || [];
  const seen = new Map<string, string>();
  for (const m of matches) {
    const key = m.toLowerCase();
    if (!seen.has(key)) seen.set(key, m);
  }
  return Array.from(seen.values()).slice(0, 12);
}

// ─── Firecrawl helpers ────────────────────────────────────────────────────────

/** Scrape a single URL → clean markdown */
async function firecrawlScrapeUrl(apiKey: string, url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ url, formats: ['markdown'], waitFor: 2000 }),
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

/** Search the web via Firecrawl → returns array of {url, title, markdown} */
async function firecrawlSearch(apiKey: string, query: string, limit = 5): Promise<Array<{url: string; title: string; markdown: string}>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ query, limit, scrapeOptions: { formats: ['markdown'] } }),
    });
    clearTimeout(timeoutId);
    if (!response.ok) { console.error(`[FIRECRAWL] Search failed: ${response.status}`); return []; }
    const data = await response.json();
    return (data.data || []).map((r: Record<string, unknown>) => ({
      url: String(r.url || ''),
      title: String(r.title || ''),
      markdown: String(r.markdown || ''),
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[FIRECRAWL] Search exception', err);
    return [];
  }
}

/** Extract structured data from a URL using Firecrawl /extract */
async function firecrawlExtract(apiKey: string, urls: string[], prompt: string, schema: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/extract', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ urls, prompt, schema }),
    });
    clearTimeout(timeoutId);
    if (!response.ok) { console.error(`[FIRECRAWL] Extract failed: ${response.status}`); return null; }
    const data = await response.json();
    return data.data || null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[FIRECRAWL] Extract exception', err);
    return null;
  }
}

// ─── JSearch API ─────────────────────────────────────────────────────────────

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
  let location = 'Remote';
  if (!item.job_is_remote) {
    const parts = [item.job_city, item.job_state, item.job_country].filter(Boolean);
    location = parts.join(', ') || 'Not specified';
  }

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

// ─── Gemini normalization ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function normalizeWithGemini(geminiKey: string, rawJob: { title: string; url: string; content: string; source: string }): Promise<any | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const llmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
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

    if (!llmResponse.ok) { console.error(`[GEMINI] Failed: ${llmResponse.status}`); return null; }

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

// ─── Company Research (Firecrawl /search + /scrape + Gemini) ─────────────────

async function handleCompanyResearch(firecrawlKey: string, geminiKey: string, company: string, jobTitle: string): Promise<Record<string, unknown>> {
  console.log(`[COMPANY_RESEARCH] Researching: ${company}`);

  // 1. Search for company's own website + about page
  const [companyResults, newsResults] = await Promise.all([
    firecrawlSearch(firecrawlKey, `${company} official website about mission culture engineering`, 4),
    firecrawlSearch(firecrawlKey, `${company} news funding product launch 2024 2025`, 3),
  ]);

  // Prefer the company's own domain (not aggregators)
  const aggregatorDomains = ['linkedin', 'glassdoor', 'indeed', 'crunchbase', 'wikipedia', 'pitchbook', 'bloomberg'];
  const companyPage = companyResults.find(r =>
    !aggregatorDomains.some(d => r.url.toLowerCase().includes(d))
  ) || companyResults[0];

  // 2. Scrape deeper if the search result markdown is thin
  let companyContent = companyPage?.markdown || '';
  if (companyContent.length < 500 && companyPage?.url) {
    console.log(`[COMPANY_RESEARCH] Scraping: ${companyPage.url}`);
    const scraped = await firecrawlScrapeUrl(firecrawlKey, companyPage.url, 12000);
    if (scraped.length > companyContent.length) companyContent = scraped;
  }

  // 3. Scrape an about/team page if found
  const aboutPage = companyResults.find(r =>
    (r.url.includes('/about') || r.url.includes('/team') || r.url.includes('/company')) &&
    !aggregatorDomains.some(d => r.url.toLowerCase().includes(d))
  );
  let aboutContent = '';
  if (aboutPage && aboutPage.url !== companyPage?.url) {
    aboutContent = aboutPage.markdown || await firecrawlScrapeUrl(firecrawlKey, aboutPage.url, 8000);
  }

  const newsContent = newsResults
    .map(r => `**${r.title}** (${r.url})\n${r.markdown?.substring(0, 400)}`)
    .join('\n\n---\n\n');

  const combinedContent = [
    companyContent.substring(0, 6000),
    aboutContent.substring(0, 2000),
  ].filter(Boolean).join('\n\n---\n\n');

  // 4. Parse with Gemini into structured intel
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    const llmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `Extract structured company intelligence from the content below.
Company: ${company}
Target Role: ${jobTitle}

Website Content:
${combinedContent}

Recent News:
${newsContent.substring(0, 2000)}

Return JSON with these fields:
- mission: company mission/vision statement (1-2 sentences)
- industry: industry/sector
- stage: company stage (e.g. "Public", "Series B startup", "Enterprise", "Bootstrapped")
- tech_stack: array of technologies they use (from job descriptions, engineering blog, etc.)
- culture_signals: array of 3-5 culture/values keywords (e.g. "remote-first", "ownership", "fast-paced")
- recent_news: array of up to 3 recent notable events (funding, product launch, expansion)
- headcount: approximate employee count if mentioned (string like "500-1000" or "unknown")
- key_products: array of main products/services (up to 4)
- interview_tip: one specific tip for interviewing at this company based on their culture/focus
- source_url: the main company URL you found

Return only valid JSON, no markdown code blocks.`
          }]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      }),
    });
    clearTimeout(timeoutId);

    if (!llmResponse.ok) throw new Error(`Gemini ${llmResponse.status}`);
    const llmData = await llmResponse.json();
    const text = llmData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No Gemini response');

    const parsed = JSON.parse(text);
    return {
      ...parsed,
      source_url: parsed.source_url || companyPage?.url || '',
      _scraped: true,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[COMPANY_RESEARCH] Gemini parse error:', err);
    // Return partial data from search results
    return {
      mission: '',
      industry: '',
      stage: 'Unknown',
      tech_stack: [],
      culture_signals: [],
      recent_news: newsResults.slice(0, 3).map(r => r.title).filter(Boolean),
      headcount: 'unknown',
      key_products: [],
      interview_tip: `Research ${company}'s recent announcements before your interview.`,
      source_url: companyPage?.url || '',
      _scraped: false,
    };
  }
}

// ─── Stakeholder Search (Firecrawl /search for real people) ──────────────────

async function handleStakeholderSearch(firecrawlKey: string, geminiKey: string, company: string, jobTitle: string): Promise<Array<Record<string, unknown>>> {
  console.log(`[STAKEHOLDERS] Searching for people at: ${company}`);

  // Search for people at the company — targeting team/about pages and public profiles
  const [teamResults, recruiterResults] = await Promise.all([
    firecrawlSearch(firecrawlKey, `${company} engineering team managers linkedin site:linkedin.com/in`, 5),
    firecrawlSearch(firecrawlKey, `${company} recruiter talent acquisition "hiring" site:linkedin.com`, 3),
  ]);

  const allResults = [...teamResults, ...recruiterResults];
  const linkedinProfiles = allResults.filter(r => r.url.includes('linkedin.com/in/'));

  if (linkedinProfiles.length === 0) {
    // Try scraping the company's team/about page instead
    const teamPage = await firecrawlSearch(firecrawlKey, `${company} team members about people`, 3);
    const aboutResult = teamPage.find(r =>
      (r.url.includes('/about') || r.url.includes('/team') || r.url.includes('/people')) &&
      !r.url.includes('linkedin') && !r.url.includes('glassdoor')
    );

    if (aboutResult) {
      const content = aboutResult.markdown || await firecrawlScrapeUrl(firecrawlKey, aboutResult.url, 10000);

      // Extract people with Gemini
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const llmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{
                text: `Extract a list of people (employees, leaders, team members) from this company page.
Company: ${company}

Content:
${content.substring(0, 8000)}

Return JSON array of up to 6 people:
[{ "name": "...", "role": "...", "linkedin_url": "" }]

Only include people with names and roles. Return empty array [] if none found.
Return only valid JSON array, no markdown.`
              }]
            }],
            generationConfig: { responseMimeType: 'application/json' }
          }),
        });
        clearTimeout(timeoutId);
        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          const text = llmData.candidates?.[0]?.content?.parts?.[0]?.text;
          const people = JSON.parse(text || '[]');
          if (Array.isArray(people) && people.length > 0) {
            return people.map((p: Record<string, unknown>) => ({
              name: p.name,
              role: p.role,
              profile_url: p.linkedin_url || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(String(p.name) + ' ' + company)}`,
              avatar_url: '',
            }));
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('[STAKEHOLDERS] Gemini parse error:', err);
      }
    }
    return []; // Fall back to recruiter_engine's LinkedIn search links
  }

  // Extract name + role from LinkedIn profile URLs and their markdown snippets
  return linkedinProfiles.slice(0, 6).map(r => {
    const nameFromUrl = r.url.split('/in/')[1]?.split('?')[0]?.replace(/-/g, ' ') || '';
    const name = nameFromUrl.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return {
      name: name || r.title.split(' - ')[0] || 'Employee',
      role: r.title.split(' - ')[1] || 'Employee',
      profile_url: r.url,
      avatar_url: '',
    };
  });
}

// ─── Careers Page Crawl (Firecrawl /scrape + Gemini multi-job extraction) ────

async function handleCareersCrawl(firecrawlKey: string, geminiKey: string, careersUrl: string): Promise<Array<Record<string, unknown>>> {
  console.log(`[CAREERS_CRAWL] Scraping: ${careersUrl}`);

  const markdown = await firecrawlScrapeUrl(firecrawlKey, careersUrl, 20000);
  if (!markdown || markdown.length < 100) {
    console.error('[CAREERS_CRAWL] Empty content from careers page');
    return [];
  }

  // Parse multiple job listings from the page with Gemini
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const llmResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `Extract all job listings from this careers page content. This is a company careers page.

URL: ${careersUrl}
Content:
${markdown.substring(0, 20000)}

Return a JSON array of job listings. Each job should have:
- title: job title (clean, no suffixes)
- company: company name (infer from URL or content)
- location: location or "Remote"
- salary_range: if mentioned, else "Not specified"
- description: role description/requirements (up to 500 chars)
- url: apply link or job URL if visible, else use the careers page URL
- employment_type: "Full-time", "Part-time", "Contract", etc.

Return only valid JSON array. If no jobs found, return [].`
          }]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      }),
    });
    clearTimeout(timeoutId);

    if (!llmResponse.ok) throw new Error(`Gemini ${llmResponse.status}`);
    const llmData = await llmResponse.json();
    const text = llmData.candidates?.[0]?.content?.parts?.[0]?.text;
    const jobs = JSON.parse(text || '[]');

    if (!Array.isArray(jobs)) return [];

    const domain = new URL(careersUrl).hostname.replace('www.', '').split('.')[0];
    const company = jobs[0]?.company || domain.charAt(0).toUpperCase() + domain.slice(1);

    return jobs.map((j: Record<string, unknown>) => {
      const title = sanitizeJobTitle(String(j.title || 'Unknown Role'));
      const comp = String(j.company || company);
      return {
        title,
        company: comp,
        location: j.location || 'Not specified',
        salary_range: j.salary_range || 'Not specified',
        description: String(j.description || '').substring(0, 5000),
        source: 'Careers Page',
        freshness_score: 0.9,
        credibility_score: 0.95,
        url: String(j.url || careersUrl),
        posted_at: new Date().toISOString(),
        tech_stack: extractTechStack(String(j.description || '')),
        job_hash: generateJobHash(comp, title),
        raw_data: { careers_url: careersUrl },
      };
    });
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[CAREERS_CRAWL] Error:', err);
    return [];
  }
}

// ─── Salary Market Data (Firecrawl /search for real comp data) ───────────────

async function handleSalaryResearch(firecrawlKey: string, role: string, location: string): Promise<string> {
  console.log(`[SALARY_RESEARCH] Fetching market data for: ${role} in ${location || 'US'}`);

  const locationQuery = location && location.toLowerCase() !== 'remote' ? `${location}` : 'United States';

  const [levelsResults, jobResults] = await Promise.all([
    firecrawlSearch(firecrawlKey, `site:levels.fyi ${role} salary compensation`, 2),
    firecrawlSearch(firecrawlKey, `${role} salary ${locationQuery} 2024 2025 compensation range`, 3),
  ]);

  const allContent = [...levelsResults, ...jobResults]
    .map(r => `Source: ${r.url}\n${r.markdown?.substring(0, 800)}`)
    .join('\n\n---\n\n');

  return allContent.substring(0, 6000);
}

// ─── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    const { RateLimiter } = await import('../_shared/rate-limiter.ts');
    const limiter = new RateLimiter(supabase, user.id);
    const { allowed, error: limitError } = await limiter.isAllowed('crawl-jobs', {
      free: { max: 5,  window: 60 },
      pro:  { max: 20, window: 60 },
    });
    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: limitError || GENERIC_RATE_LIMIT_ERROR }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
    }

    console.log('[AUTH] User:', user.id);

    const body = await req.json();
    const { mode, keywords, url, location, locations, remotePolicy, targetRoles } = body;

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const jsearchApiKey = Deno.env.get('JSEARCH_API_KEY');

    // ── COMPANY RESEARCH MODE ─────────────────────────────────────────────────
    if (mode === 'company_research') {
      if (!firecrawlApiKey || !geminiApiKey) {
        return new Response(JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const research = await handleCompanyResearch(firecrawlApiKey, geminiApiKey, body.company, body.title || '');
      return new Response(JSON.stringify({ success: true, research }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── STAKEHOLDER SEARCH MODE ──────────────────────────────────────────────
    if (mode === 'stakeholder_search') {
      if (!firecrawlApiKey || !geminiApiKey) {
        return new Response(JSON.stringify({ success: false, stakeholders: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const stakeholders = await handleStakeholderSearch(firecrawlApiKey, geminiApiKey, body.company, body.title || '');
      return new Response(JSON.stringify({ success: true, stakeholders }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── CAREERS PAGE CRAWL MODE ──────────────────────────────────────────────
    if (mode === 'careers_crawl') {
      if (!firecrawlApiKey || !geminiApiKey || !body.careers_url) {
        return new Response(JSON.stringify({ success: false, error: 'Missing careers_url or API keys' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const jobs = await handleCareersCrawl(firecrawlApiKey, geminiApiKey, body.careers_url);

      if (jobs.length > 0) {
        let inserted = 0;
        for (const job of jobs.slice(0, MAX_JOBS_PER_PASS)) {
          const { error } = await supabase.from('job_listings').upsert(job, { onConflict: 'job_hash', ignoreDuplicates: true });
          if (!error) inserted++;
        }
        console.log(`[CAREERS_CRAWL] Inserted ${inserted} of ${jobs.length} jobs`);
      }

      return new Response(JSON.stringify({ success: true, jobs, total: jobs.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── SALARY RESEARCH MODE ─────────────────────────────────────────────────
    if (mode === 'salary_research') {
      if (!firecrawlApiKey) {
        return new Response(JSON.stringify({ success: false, market_data: '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const market_data = await handleSalaryResearch(firecrawlApiKey, body.role || '', body.location || '');
      return new Response(JSON.stringify({ success: true, market_data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allJobs: any[] = [];

    if (url) {
      // ── URL SCRAPE MODE (Firecrawl + Gemini) ──────────────────────────────
      if (!firecrawlApiKey || !geminiApiKey) {
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
      // ── SEARCH MODE (JSearch) ─────────────────────────────────────────────
      if (!jsearchApiKey) {
        return new Response(JSON.stringify({ success: false, error: GENERIC_SERVICE_ERROR }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const searchRoles  = Array.isArray(targetRoles) ? targetRoles.filter(Boolean).map(String) : [];
      const searchKws    = Array.isArray(keywords) ? keywords.filter(Boolean).map(String) : [];
      const searchLocs: string[] = Array.isArray(locations) && locations.length > 0
        ? locations.filter(Boolean).map(String).slice(0, 2)
        : (typeof location === 'string' && location.trim() ? [location.trim()] : []);
      const isRemote     = remotePolicy === 'remote';

      const primaryRole = searchRoles[0] || 'software engineer';
      const queries: string[] = [];

      const effectiveLocs = searchLocs.length > 0 ? searchLocs : [''];
      for (const loc of effectiveLocs) {
        const locSuffix = loc ? ` ${loc}` : '';
        queries.push(`${primaryRole}${locSuffix}`.trim());
        if (loc === effectiveLocs[0] && searchKws.length > 0) {
          const keywordsForQuery = searchKws.slice(0, 3).join(' ');
          queries.push(`${primaryRole} ${keywordsForQuery}${locSuffix}`.trim());
        }
      }

      if (searchRoles[1] && queries.length < 4) {
        const locSuffix = searchLocs[0] ? ` ${searchLocs[0]}` : '';
        queries.push(`${searchRoles[1]}${locSuffix}`.trim());
      }

      if (queries.length < 5) {
        const locSuffix = searchLocs[0] ? ` ${searchLocs[0]}` : '';
        queries.push(`${primaryRole} contract${locSuffix}`.trim());
      }

      console.log(`[JSEARCH] Running ${queries.length} queries`);

      const searchResults = await Promise.allSettled(
        queries.map(q => jsearchFetch(jsearchApiKey, q, isRemote))
      );

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
