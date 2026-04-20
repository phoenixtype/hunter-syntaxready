import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';

const GENERIC_SERVICE_ERROR = 'Service temporarily unavailable';
const GENERIC_AUTH_ERROR = 'Authentication required';
const GENERIC_SESSION_ERROR = 'Session expired or invalid';
const GENERIC_RATE_LIMIT_ERROR = 'Too many requests. Please try again later.';

// Max jobs to process per search pass - reduced for better memory usage
const MAX_JOBS_PER_PASS = 20;

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
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[JSEARCH] Request failed: ${response.status} ${response.statusText}`, errorText);

      if (response.status === 429) {
        throw new Error('Rate limit reached for job search API');
      } else if (response.status === 401) {
        throw new Error('Invalid API key for job search service');
      } else if (response.status >= 500) {
        throw new Error('Job search service temporarily unavailable');
      }

      return [];
    }

    const data = await response.json();
    const jobs: JSearchJob[] = data.data || [];
    console.log(`[JSEARCH] Got ${jobs.length} results for "${query}"`);
    return jobs;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[JSEARCH] Error for "${query}":`, err);

    // Re-throw specific errors for better error handling upstream
    if (err instanceof Error && (err.message.includes('Rate limit') || err.message.includes('Invalid API key') || err.message.includes('temporarily unavailable'))) {
      throw err;
    }

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

  if (salary_range === 'Not specified' && (item as unknown as Record<string, unknown>).job_salary_string) {
    salary_range = (item as unknown as Record<string, unknown>).job_salary_string as string;
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
async function normalizeWithGemini(_geminiKey: string, rawJob: { title: string; url: string; content: string; source: string }): Promise<any | null> {
  const { callAI, MODEL_FAST } = await import('../_shared/ai-client.ts');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const aiResult = await callAI(
      MODEL_FAST,
      [{
        role: 'user',
        content: `You are a job listing parser. Extract structured job information from the provided content.
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
Content: ${rawJob.content.substring(0, 15000)}`,
      }],
      { json: true, signal: controller.signal },
    );
    clearTimeout(timeoutId);

    const text = aiResult.content;
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

async function handleCompanyResearch(firecrawlKey: string, _geminiKey: string, company: string, jobTitle: string): Promise<Record<string, unknown>> {
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

  // 4. Parse with AI into structured intel
  const { callAI, MODEL_FAST } = await import('../_shared/ai-client.ts');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    const aiResult = await callAI(
      MODEL_FAST,
      [{
        role: 'user',
        content: `Extract structured company intelligence from the content below.
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

Return only valid JSON, no markdown code blocks.`,
      }],
      { json: true, signal: controller.signal },
    );
    clearTimeout(timeoutId);

    const text = aiResult.content;
    if (!text) throw new Error('No AI response');

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

async function handleStakeholderSearch(firecrawlKey: string, _geminiKey: string, company: string, jobTitle: string): Promise<Array<Record<string, unknown>>> {
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

      // Extract people with AI
      const { callAI, MODEL_FAST } = await import('../_shared/ai-client.ts');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      try {
        const aiResult = await callAI(
          MODEL_FAST,
          [{
            role: 'user',
            content: `Extract a list of people (employees, leaders, team members) from this company page.
Company: ${company}

Content:
${content.substring(0, 8000)}

Return JSON array of up to 6 people:
[{ "name": "...", "role": "...", "linkedin_url": "" }]

Only include people with names and roles. Return empty array [] if none found.
Return only valid JSON array, no markdown.`,
          }],
          { json: true, signal: controller.signal },
        );
        clearTimeout(timeoutId);
        if (aiResult.content) {
          const people = JSON.parse(aiResult.content || '[]');
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

async function handleCareersCrawl(firecrawlKey: string, _geminiKey: string, careersUrl: string): Promise<Array<Record<string, unknown>>> {
  console.log(`[CAREERS_CRAWL] Scraping: ${careersUrl}`);

  const markdown = await firecrawlScrapeUrl(firecrawlKey, careersUrl, 20000);
  if (!markdown || markdown.length < 100) {
    console.error('[CAREERS_CRAWL] Empty content from careers page');
    return [];
  }

  // Parse multiple job listings from the page with AI
  const { callAI, MODEL_FAST } = await import('../_shared/ai-client.ts');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const aiResult = await callAI(
      MODEL_FAST,
      [{
        role: 'user',
        content: `Extract all job listings from this careers page content. This is a company careers page.

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

Return only valid JSON array. If no jobs found, return [].`,
      }],
      { json: true, signal: controller.signal },
    );
    clearTimeout(timeoutId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jobs: any[];
    try {
      const parsed = JSON.parse(aiResult.content || '[]');
      jobs = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }

    if (jobs.length === 0) return [];

    let domain = 'company';
    try {
      domain = new URL(careersUrl).hostname.replace('www.', '').split('.')[0];
    } catch { /* use fallback */ }
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
      return jsonWithCors({ success: false, error: GENERIC_SERVICE_ERROR });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonWithCors({ success: false, error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // Detect service-role calls (e.g. from cron / auto-job-discovery).
    // The service-role JWT is sent verbatim by edge functions invoking this one
    // via a service-role supabase client. Service-role calls bypass user auth
    // and rate limiting because they're trusted internal system traffic.
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
    const isServiceRole = bearerToken === supabaseServiceKey;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let user: { id: string } | null = null;

    if (isServiceRole) {
      console.log('[AUTH] Service-role call (system/cron) — bypassing user auth');
    } else {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      });

      const { data: { user: authedUser }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !authedUser) {
        return jsonWithCors({ success: false, error: GENERIC_SESSION_ERROR }, { status: 401 });
      }
      user = authedUser;

      const { RateLimiter } = await import('../_shared/rate-limiter.ts');
      const limiter = new RateLimiter(supabase, user.id);
      const { allowed, error: limitError } = await limiter.isAllowed('crawl-jobs', {
        free: { max: 10,  window: 60 },
        pro:  { max: 30, window: 60 },
      });
      if (!allowed) {
        return new Response(JSON.stringify({ success: false, error: limitError || GENERIC_RATE_LIMIT_ERROR }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
      }

      console.log('[AUTH] User:', user.id);
    }

    const body = await req.json();
    const { mode, keywords, url, location, locations, remotePolicy, targetRoles } = body;

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const jsearchApiKey = Deno.env.get('JSEARCH_API_KEY');

    // ── COMPANY RESEARCH MODE ─────────────────────────────────────────────────
    if (mode === 'company_research') {
      if (!firecrawlApiKey || !geminiApiKey) {
        return jsonWithCors({ success: false, error: GENERIC_SERVICE_ERROR });
      }
      const research = await handleCompanyResearch(firecrawlApiKey, geminiApiKey, body.company, body.title || '');
      return jsonWithCors({ success: true, research });
    }

    // ── STAKEHOLDER SEARCH MODE ──────────────────────────────────────────────
    if (mode === 'stakeholder_search') {
      if (!firecrawlApiKey || !geminiApiKey) {
        return jsonWithCors({ success: false, stakeholders: [] });
      }
      const stakeholders = await handleStakeholderSearch(firecrawlApiKey, geminiApiKey, body.company, body.title || '');
      return jsonWithCors({ success: true, stakeholders });
    }

    // ── CAREERS PAGE CRAWL MODE ──────────────────────────────────────────────
    if (mode === 'careers_crawl') {
      if (!firecrawlApiKey || !geminiApiKey || !body.careers_url) {
        return jsonWithCors({ success: false, error: 'Missing careers_url or API keys' });
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

      return jsonWithCors({ success: true, jobs, total: jobs.length });
    }

    // ── SALARY RESEARCH MODE ─────────────────────────────────────────────────
    if (mode === 'salary_research') {
      if (!firecrawlApiKey) {
        return jsonWithCors({ success: false, market_data: '' });
      }
      const market_data = await handleSalaryResearch(firecrawlApiKey, body.role || '', body.location || '');
      return jsonWithCors({ success: true, market_data });
    }

    // ── COMPANY FOCUSED MODE (Source Prioritization Integration) ─────────────
    if (mode === 'company_focused') {
      if (!firecrawlApiKey || !geminiApiKey || !jsearchApiKey) {
        return jsonWithCors({ success: false, error: 'Missing required API keys for company focused crawl' });
      }

      const { company, limit = 50 } = body;
      if (!company) {
        return jsonWithCors({ success: false, error: 'Company name required for company focused mode' });
      }

      console.log(`[COMPANY_FOCUSED] Starting prioritized crawl for: ${company}`);
      const companyJobs: any[] = [];
      const duplicateHashes = new Set<string>();

      // Tier 1: Company Career Pages (Highest Priority)
      try {
        console.log('[COMPANY_FOCUSED] Tier 1: Searching for career pages');
        const careerSearchResults = await firecrawlSearch(firecrawlApiKey, `${company} careers jobs site:${company.toLowerCase().replace(/\s+/g, '')}.com`, 3);

        for (const careerResult of careerSearchResults) {
          if (companyJobs.length >= limit) break;

          console.log(`[COMPANY_FOCUSED] Scraping career page: ${careerResult.url}`);
          const careerJobs = await handleCareersCrawl(firecrawlApiKey, geminiApiKey, careerResult.url);

          for (const job of careerJobs) {
            if (companyJobs.length >= limit) break;
            const jobCompany = String(job.company || company);
            const jobTitle = String(job.title || '');
            const jobPostedAt = String(job.posted_at || '1 hour ago');
            const jobHash = generateJobHash(jobCompany, jobTitle);

            if (!duplicateHashes.has(jobHash)) {
              duplicateHashes.add(jobHash);
              job.source = 'career_page';
              job.priority = 1;
              job.freshness_score = calculateFreshnessFromString(jobPostedAt);
              companyJobs.push(job);
            }
          }
        }

        console.log(`[COMPANY_FOCUSED] Tier 1 complete: ${companyJobs.length} career page jobs`);
      } catch (error) {
        console.error('[COMPANY_FOCUSED] Tier 1 error:', error);
      }

      // Tier 2: Job Boards (Medium Priority) - only if we have space
      if (companyJobs.length < limit) {
        try {
          console.log('[COMPANY_FOCUSED] Tier 2: Searching job boards');
          const remainingSlots = limit - companyJobs.length;
          const boardQueries = [`${company} jobs`, `"${company}" software engineer`, `"${company}" developer`];

          for (const query of boardQueries) {
            if (companyJobs.length >= limit) break;

            const boardResults = await jsearchFetch(jsearchApiKey, query, false);

            for (const job of boardResults) {
              if (companyJobs.length >= limit) break;

              const normalizedJob = mapJSearchJob(job);
              const jobCompany = String(normalizedJob.company || company);
              const jobTitle = String(normalizedJob.title || '');
              const jobPostedAt = String(normalizedJob.posted_at || '1 day ago');
              const jobHash = generateJobHash(jobCompany, jobTitle);

              if (!duplicateHashes.has(jobHash) &&
                  jobCompany.toLowerCase().includes(company.toLowerCase())) {
                duplicateHashes.add(jobHash);
                normalizedJob.source = 'job_board';
                normalizedJob.priority = 2;
                normalizedJob.freshness_score = calculateFreshnessFromString(jobPostedAt);
                companyJobs.push(normalizedJob);
              }
            }
          }

          console.log(`[COMPANY_FOCUSED] Tier 2 complete: ${companyJobs.length} total jobs`);
        } catch (error) {
          console.error('[COMPANY_FOCUSED] Tier 2 error:', error);
        }
      }

      // Tier 3: Niche Sites (Low Priority) - only if we still have space
      if (companyJobs.length < limit) {
        try {
          console.log('[COMPANY_FOCUSED] Tier 3: Searching niche sites');
          const nicheQueries = [
            `site:stackoverflow.com/jobs "${company}"`,
            `site:angel.co "${company}"`,
            `site:dice.com "${company}"`
          ];

          for (const query of nicheQueries) {
            if (companyJobs.length >= limit) break;

            const nicheResults = await firecrawlSearch(firecrawlApiKey, query, 2);

            for (const result of nicheResults) {
              if (companyJobs.length >= limit) break;

              const markdown = await firecrawlScrapeUrl(firecrawlApiKey, result.url);
              if (!markdown) continue;

              const normalized = await normalizeWithGemini(geminiApiKey, {
                title: result.title,
                url: result.url,
                content: markdown,
                source: 'niche_site'
              });

              if (normalized && normalized.valid) {
                const jobHash = generateJobHash(normalized.company || company, normalized.title || '');

                if (!duplicateHashes.has(jobHash)) {
                  duplicateHashes.add(jobHash);
                  normalized.source = 'niche_site';
                  normalized.priority = 3;
                  normalized.freshness_score = calculateFreshnessFromString(normalized.posted_at || '2 days ago');
                  companyJobs.push(normalized);
                }
              }
            }
          }

          console.log(`[COMPANY_FOCUSED] Tier 3 complete: ${companyJobs.length} total jobs`);
        } catch (error) {
          console.error('[COMPANY_FOCUSED] Tier 3 error:', error);
        }
      }

      // Sort by priority and freshness
      companyJobs.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority; // Lower priority number = higher importance
        }
        return (b.freshness_score || 0) - (a.freshness_score || 0); // Higher freshness = more recent
      });

      // Insert jobs into database
      let inserted = 0;
      for (const job of companyJobs) {
        try {
          const { error } = await supabase
            .from('job_listings')
            .upsert({
              title: sanitizeJobTitle(job.title || 'Untitled'),
              company: job.company || company,
              location: job.location || 'Not specified',
              description: job.description || '',
              application_url: job.application_url || job.url || '#',
              salary_min: job.salary_min ? parseInt(String(job.salary_min)) : null,
              salary_max: job.salary_max ? parseInt(String(job.salary_max)) : null,
              salary_currency: job.salary_currency || 'USD',
              experience_level: job.experience_level || 'not_specified',
              job_type: job.job_type || 'full-time',
              required_skills: job.required_skills || job.tech_stack?.join(', ') || '',
              posted_date: job.posted_date || new Date().toISOString(),
              freshness_score: job.freshness_score || 0.5,
              remote_ok: Boolean(job.remote_ok)
            }, {
              onConflict: 'title,company,location',
              ignoreDuplicates: true
            });

          if (!error) {
            inserted++;
          } else if (!error.message?.includes('duplicate')) {
            console.error('[DB_INSERT] Error:', error.message);
          }
        } catch (insertError) {
          console.error('[DB_INSERT] Exception:', insertError);
        }
      }

      console.log(`[COMPANY_FOCUSED] Complete: ${inserted}/${companyJobs.length} jobs inserted for ${company}`);

      return jsonWithCors({
        success: true,
        jobs: companyJobs,
        total: companyJobs.length,
        inserted,
        company,
        prioritization: {
          tier1_career_pages: companyJobs.filter(j => j.source === 'career_page').length,
          tier2_job_boards: companyJobs.filter(j => j.source === 'job_board').length,
          tier3_niche_sites: companyJobs.filter(j => j.source === 'niche_site').length
        }
      });
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
        return jsonWithCors({ success: false, error: GENERIC_SERVICE_ERROR });
      }

      console.log(`[SCRAPE] URL: ${url}`);
      const markdown = await firecrawlScrapeUrl(firecrawlApiKey, url);

      if (!markdown) {
        return jsonWithCors({ success: false, error: 'Could not extract content from the job page. Ensure the URL is publicly accessible.' });
      }

      const normalized = await normalizeWithGemini(geminiApiKey, { title: 'Scraped Job', url, content: markdown, source: 'Direct' });
      if (normalized) allJobs.push(normalized);

    } else {
      // ── SEARCH MODE (JSearch) ─────────────────────────────────────────────
      if (!jsearchApiKey) {
        console.error('[CRAWL-JOBS] Missing JSEARCH_API_KEY environment variable');
        return jsonWithCors({ success: false, error: 'Job search service is temporarily unavailable. Please try again in a few minutes.' });
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

    // Process jobs in smaller batches for better memory usage
    const batchSize = 10;
    const jobsToProcess = allJobs.slice(0, MAX_JOBS_PER_PASS);

    for (let i = 0; i < jobsToProcess.length; i += batchSize) {
      const batch = jobsToProcess.slice(i, i + batchSize);

      for (const job of batch) {
        try {
          const { error } = await supabase
            .from('job_listings')
            .upsert(job, { onConflict: 'job_hash', ignoreDuplicates: true });

          if (error) {
            if (error.code === '23505') {
              duplicates++;
            } else {
              console.error('[DB] Upsert error:', error.code, error.message);
            }
          } else {
            inserted++;
          }
        } catch (err) {
          console.error('[DB] Exception during upsert:', err instanceof Error ? err.message : String(err));
        }
      }

      // Small delay between batches to prevent overwhelming the database
      if (i + batchSize < jobsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[DONE] Inserted ${inserted}, duplicates ${duplicates}`);

    return new Response(
      JSON.stringify({ success: true, inserted, duplicates, total: allJobs.length, jobs: allJobs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CRAWL-JOBS] Unhandled exception:', error);

    // Provide more specific error messages based on the error type
    let userMessage = GENERIC_SERVICE_ERROR;
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('AbortError')) {
        userMessage = 'Job search timed out. Please try again with fewer keywords.';
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        userMessage = 'Rate limit reached. Please wait a moment before searching again.';
      } else if (error.message.includes('API key') || error.message.includes('401')) {
        userMessage = 'Job search service configuration error. Please contact support.';
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: userMessage, debug: error instanceof Error ? error.message : String(error) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
