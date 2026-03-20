import { supabase } from "@/integrations/supabase/client";
import { queueJobCrawl } from "./function-queue";

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  description: string;
  source: 'Web' | 'Search' | 'LinkedIn' | 'Direct';
  freshness_score: number;
  credibility_score: number;
  url: string;
  posted_at: string;
  tech_stack?: string[];
}

export interface CrawlParams {
  keywords?: string[];
  targetRoles?: string[];
  location?: string;
  locations?: string[];
  remotePolicy?: string;
  url?: string;
}

// Trigger a crawl to fetch fresh jobs
export const triggerJobCrawl = async (
  params: CrawlParams = {}
): Promise<{ success: boolean; inserted?: number; error?: string }> => {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('No active session for crawl:', sessionError);
      return { success: false, error: 'Please sign in to crawl jobs' };
    }

    // Use queued function call to manage edge function concurrency
    const data = await queueJobCrawl({
      keywords: params.keywords,
      targetRoles: params.targetRoles,
      location: params.location,
      locations: params.locations,
      remotePolicy: params.remotePolicy,
      url: params.url,
    });

    const error = null; // Queue system handles errors internally

    if (error) {
      console.error('Crawl invocation error:', error);
      return { success: false, error: (error as any).message };
    }

    return {
      success: data?.success ?? false,
      inserted: data?.inserted,
      error: data?.error
    };
  } catch (err) {
    console.error('Crawl error:', err);
    return { success: false, error: String(err) };
  }
};

// Escape SQL ILIKE special characters to prevent pattern injection
function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

interface JobRowData {
  id: string;
  title: string;
  company: string;
  location?: string;
  salary_range?: string;
  description?: string;
  source?: string;
  freshness_score?: number;
  credibility_score?: number;
  url?: string;
  posted_at?: string;
  tech_stack?: string[];
}

function mapJobRow(j: JobRowData): JobOpportunity {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location || 'Unspecified',
    salary_range: j.salary_range || 'Not specified',
    description: j.description || '',
    source: (j.source === 'Firecrawl' || j.source === 'Perplexity') ? 'Web' : (j.source === 'JSearch' ? 'Search' : j.source) as JobOpportunity['source'],
    freshness_score: Number(j.freshness_score) || 0.5,
    credibility_score: Number(j.credibility_score) || 0.8,
    url: j.url || '',
    posted_at: j.posted_at || 'Recently',
    tech_stack: j.tech_stack || []
  };
}

export interface SearchJobsOptions {
  query?: string;
  location?: string;
  page?: number;
  pageSize?: number;
  /** User's saved preferred locations — used when no manual location is typed */
  preferenceLocations?: string[];
  /** User's target roles — used when no manual search query is typed */
  preferenceRoles?: string[];
  /** User's remote policy — influences location filter */
  remotePolicy?: string;
}

// Search jobs from database with pagination, filtered to the user's preferences
export const searchJobs = async (
  queryOrOptions?: string | SearchJobsOptions,
  location?: string,
  page = 0,
  pageSize = 20,
  preferenceLocations?: string[],
  preferenceRoles?: string[],
  remotePolicy?: string,
): Promise<{ jobs: JobOpportunity[]; totalCount: number }> => {
  // Support both old positional signature and new options object
  let query: string | undefined;
  if (typeof queryOrOptions === 'object' && queryOrOptions !== null) {
    ({ query, location, page = 0, pageSize = 20, preferenceLocations, preferenceRoles, remotePolicy } = queryOrOptions);
  } else {
    query = queryOrOptions as string | undefined;
  }

  try {
    const from = page * pageSize;
    const to = from + pageSize;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let queryBuilder = supabase
      .from('job_listings')
      .select('*', { count: 'exact' })
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('freshness_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to - 1);

    // ── Role / keyword filter ─────────────────────────────────────────────
    // Manual search query wins; fall back to preference roles.
    if (query && query.trim()) {
      const sq = escapeLikePattern(query.trim().slice(0, 100));
      queryBuilder = queryBuilder.or(
        `title.ilike.%${sq}%,company.ilike.%${sq}%,description.ilike.%${sq}%`
      );
    } else if (preferenceRoles && preferenceRoles.length > 0) {
      // Use individual significant words from roles for broader matching
      // e.g. "Senior Frontend Engineer" → match titles containing "Frontend" or "Engineer"
      const significantWords = new Set<string>();
      const stopWords = new Set(['senior', 'junior', 'lead', 'staff', 'principal', 'mid', 'entry', 'level', 'i', 'ii', 'iii', 'iv', 'v', 'the', 'a', 'an', 'and', 'or', 'of', 'in', 'at', 'for']);
      for (const role of preferenceRoles.slice(0, 5)) {
        for (const word of role.trim().split(/\s+/)) {
          if (word.length > 2 && !stopWords.has(word.toLowerCase())) {
            significantWords.add(word);
          }
        }
      }
      if (significantWords.size > 0) {
        const roleFilter = Array.from(significantWords)
          .slice(0, 8)
          .map(w => `title.ilike.%${escapeLikePattern(w.slice(0, 50))}%`)
          .join(',');
        queryBuilder = queryBuilder.or(roleFilter);
      }
    }

    // ── Location filter ───────────────────────────────────────────────────
    // Manual location wins; fall back to preference locations.
    if (location && location.trim()) {
      // Use .ilike() directly (not inside .or()) so commas in the value are safe
      const sl = escapeLikePattern(location.trim().split(/,\s*/)[0].slice(0, 50));
      queryBuilder = queryBuilder.ilike('location', `%${sl}%`);
    } else if (preferenceLocations && preferenceLocations.length > 0) {
      // PostgREST .or() uses commas as clause delimiters, so location strings like
      // "Toronto, Ontario, Canada" must be split into comma-free individual terms.
      // Strategy: use the city (first part) and country (last part) separately.
      const locTerms = new Set<string>();
      for (const l of preferenceLocations) {
        const parts = l.trim().split(/,\s*/);
        if (parts[0]) locTerms.add(escapeLikePattern(parts[0].slice(0, 50)));
        if (parts.length > 1) locTerms.add(escapeLikePattern(parts[parts.length - 1].slice(0, 50)));
      }
      const locFilters = Array.from(locTerms)
        .map(t => `location.ilike.%${t}%`)
        .join(',');
      // Include remote jobs unless the user explicitly wants onsite-only
      const includeRemote = remotePolicy !== 'onsite';
      const remoteClause = includeRemote ? ',location.ilike.%remote%' : '';
      // Also include jobs with no specific location
      queryBuilder = queryBuilder.or(`${locFilters}${remoteClause},location.ilike.%unspecified%,location.ilike.%not specified%`);
    } else if (remotePolicy === 'remote') {
      // No location preference set but user wants remote-only
      queryBuilder = queryBuilder.ilike('location', '%remote%');
    }
    // If no location filter at all → show all jobs (fallback for users with no prefs)

    const { data, count, error } = await queryBuilder;

    if (error) {
      console.error('Search error:', error);
      return { jobs: [], totalCount: 0 };
    }

    return { jobs: (data || []).map((j: any) => mapJobRow(j)), totalCount: count || 0 };
  } catch (err) {
    console.error('Search error:', err);
    return { jobs: [], totalCount: 0 };
  }
};

// Get a specific job by ID
export const getJobById = async (id: string): Promise<JobOpportunity | undefined> => {
  try {
    const { data, error } = await supabase
      .from('job_listings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.error('Get job error:', error);
      return undefined;
    }

    return mapJobRow(data as any);
  } catch (err) {
    console.error('Get job error:', err);
    return undefined;
  }
};

// ─── Firecrawl-powered features ──────────────────────────────────────────────

export interface CompanyResearch {
  mission: string;
  industry: string;
  stage: string;
  tech_stack: string[];
  culture_signals: string[];
  recent_news: string[];
  headcount: string;
  key_products: string[];
  interview_tip: string;
  source_url: string;
  _scraped: boolean;
}

/** Scrape and analyse a company's web presence for interview prep & job matching */
export const researchCompany = async (company: string, jobTitle = ''): Promise<CompanyResearch | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase.functions.invoke('crawl-jobs', {
      body: { mode: 'company_research', company, title: jobTitle },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error || !data?.success) return null;
    return data.research as CompanyResearch;
  } catch (err) {
    console.error('[researchCompany] error:', err);
    return null;
  }
};

/** Extract multiple job listings from a company's careers page URL */
export const crawlCareersPage = async (
  careersUrl: string
): Promise<{ jobs: JobOpportunity[]; total: number }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { jobs: [], total: 0 };

    const { data, error } = await supabase.functions.invoke('crawl-jobs', {
      body: { mode: 'careers_crawl', careers_url: careersUrl },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error || !data?.success) return { jobs: [], total: 0 };
    return {
      jobs: (data.jobs || []).map(mapJobRow),
      total: data.total || 0,
    };
  } catch (err) {
    console.error('[crawlCareersPage] error:', err);
    return { jobs: [], total: 0 };
  }
};

// Get job count
export const getJobCount = async (): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('job_listings')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Count error:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Count error:', err);
    return 0;
  }
};
