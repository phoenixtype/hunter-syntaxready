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

// Trigger a crawl to fetch fresh jobs
export const triggerJobCrawl = async (
  sources?: string[], 
  keywords?: string[]
): Promise<{ success: boolean; inserted?: number; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('crawl-jobs', {
      body: { sources, keywords }
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

// Search jobs from database
export const searchJobs = async (query?: string): Promise<JobOpportunity[]> => {
  try {
    let queryBuilder = supabase
      .from('job_listings')
      .select('*')
      .order('freshness_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    // If query provided, do text search
    if (query && query.trim()) {
      queryBuilder = queryBuilder.or(
        `title.ilike.%${query}%,company.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Search error:', error);
      return [];
    }

    // Transform database records to JobOpportunity interface
    return (data || []).map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location || 'Remote',
      salary_range: job.salary_range || 'Not specified',
      description: job.description || '',
      source: job.source as JobOpportunity['source'],
      freshness_score: Number(job.freshness_score) || 0.5,
      credibility_score: Number(job.credibility_score) || 0.8,
      url: job.url,
      posted_at: job.posted_at || 'Recently',
      tech_stack: job.tech_stack || []
    }));
  } catch (err) {
    console.error('Search error:', err);
    return [];
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

    return {
      id: data.id,
      title: data.title,
      company: data.company,
      location: data.location || 'Remote',
      salary_range: data.salary_range || 'Not specified',
      description: data.description || '',
      source: data.source as JobOpportunity['source'],
      freshness_score: Number(data.freshness_score) || 0.5,
      credibility_score: Number(data.credibility_score) || 0.8,
      url: data.url,
      posted_at: data.posted_at || 'Recently',
      tech_stack: data.tech_stack || []
    };
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
