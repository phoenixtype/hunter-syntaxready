import { supabase } from "@/integrations/supabase/client";

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

    const { data, error } = await supabase.functions.invoke('crawl-jobs', {
      body: {
        keywords: params.keywords,
        targetRoles: params.targetRoles,
        location: params.location,
        remotePolicy: params.remotePolicy,
        url: params.url,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      console.error('Crawl invocation error:', error);
      return { success: false, error: error.message };
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

function mapJobRow(j: any): JobOpportunity {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    /*
    ### 1. Job Source Visibility & Types
    - **Generic Labels**: Internal service names like `Firecrawl` and `Perplexity` are now labeled as `Web` in the UI. `JSearch` is labeled as `Search`.
    - **Reasoning Consistency**: Updated the matching engine's reasoning logic to use these same user-friendly labels.
    - **System Integrity**: Updated `JobOpportunity` types to correctly handle `JSearch` results from the backend while maintaining clean user-facing labels.

    ### 2. Search Result Quality
    - **Improved Queries**: Refined the JSearch query construction in the edge function to use professional titles and combined keywords. This ensures much higher quality and more relevant search results compared to the previous single-word snippets.

    ### 3. Dashboard UX & Pagination Improvements
    - **Visibility**: Pagination controls now remain visible even if filters result in 0 matches on the current page, provided other pages exist.
    */
    location: j.location || 'Unspecified',
    salary_range: j.salary_range || 'Not specified',
    description: j.description || '',
    source: (j.source === 'Firecrawl' || j.source === 'Perplexity') ? 'Web' : (j.source === 'JSearch' ? 'Search' : j.source) as JobOpportunity['source'],
    freshness_score: Number(j.freshness_score) || 0.5,
    credibility_score: Number(j.credibility_score) || 0.8,
    url: j.url,
    posted_at: j.posted_at || 'Recently',
    tech_stack: j.tech_stack || []
  };
}

// Search jobs from database with pagination
export const searchJobs = async (query?: string, location?: string, page = 0, pageSize = 20): Promise<{ jobs: JobOpportunity[]; totalCount: number }> => {
  try {
    const from = page * pageSize;
    const to = from + pageSize; // fetch one extra to check hasMore

    let queryBuilder = supabase
      .from('job_listings')
      .select('*', { count: 'exact' })
      .order('freshness_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to - 1); // Exact size since we have count

    if (query && query.trim()) {
      const sanitizedQuery = escapeLikePattern(query.trim().slice(0, 100));
      queryBuilder = queryBuilder.or(
        `title.ilike.%${sanitizedQuery}%,company.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`
      );
    }

    if (location && location.trim()) {
      const sanitizedLocation = escapeLikePattern(location.trim().slice(0, 100));
      queryBuilder = queryBuilder.ilike('location', `%${sanitizedLocation}%`);
    }

    const { data, count, error } = await queryBuilder;

    if (error) {
      console.error('Search error:', error);
      return { jobs: [], totalCount: 0 };
    }

    const jobs = (data || []).map(mapJobRow);

    return { jobs, totalCount: count || 0 };
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

    return mapJobRow(data);
  } catch (err) {
    console.error('Get job error:', err);
    return undefined;
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
