import { supabase } from "@/integrations/supabase/client";

export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  description: string;
  source: 'Firecrawl' | 'Perplexity' | 'LinkedIn' | 'Direct';
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
    location: j.location || 'Unspecified',
    salary_range: j.salary_range || 'Not specified',
    description: j.description || '',
    source: j.source as JobOpportunity['source'],
    freshness_score: Number(j.freshness_score) || 0.5,
    credibility_score: Number(j.credibility_score) || 0.8,
    url: j.url,
    posted_at: j.posted_at || 'Recently',
    tech_stack: j.tech_stack || []
  };
}

// Search jobs from database with pagination
export const searchJobs = async (query?: string, page = 0, pageSize = 20): Promise<{ jobs: JobOpportunity[]; hasMore: boolean }> => {
  try {
    const from = page * pageSize;
    const to = from + pageSize; // fetch one extra to check hasMore

    let queryBuilder = supabase
      .from('job_listings')
      .select('*')
      .order('freshness_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query && query.trim()) {
      const sanitizedQuery = escapeLikePattern(query.trim().slice(0, 100));
      queryBuilder = queryBuilder.or(
        `title.ilike.%${sanitizedQuery}%,company.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`
      );
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Search error:', error);
      return { jobs: [], hasMore: false };
    }

    const rows = data || [];
    const hasMore = rows.length > pageSize;
    const jobs = rows.slice(0, pageSize).map(mapJobRow);

    return { jobs, hasMore };
  } catch (err) {
    console.error('Search error:', err);
    return { jobs: [], hasMore: false };
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
