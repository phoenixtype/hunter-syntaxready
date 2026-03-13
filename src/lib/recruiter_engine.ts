import { JobOpportunity } from "./crawler_engine";
import { supabase } from "@/integrations/supabase/client";

export interface Stakeholder {
  name: string;
  role: string;
  connection_degree: '1st' | '2nd' | '3rd' | 'Out of Network';
  avatar_url?: string;
  profile_url: string;
}

/**
 * Find stakeholders for a job by searching for relevant people at the company.
 * Uses Firecrawl search via the crawl-jobs edge function to find real LinkedIn profiles.
 * Falls back to LinkedIn search links if the search fails.
 */
export const findStakeholders = async (job: JobOpportunity): Promise<Stakeholder[]> => {
  const encodedCompany = encodeURIComponent(job.company);
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Use Firecrawl search to find real people at the company
    const { data, error } = await supabase.functions.invoke('crawl-jobs', {
      body: {
        mode: 'stakeholder_search',
        company: job.company,
        title: job.title,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!error && data?.stakeholders && data.stakeholders.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.stakeholders as any[]).map((s) => ({
        name: s.name || 'Unknown',
        role: s.role || s.title || 'Employee',
        connection_degree: 'Out of Network' as const,
        profile_url: s.profile_url || s.url || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(s.name + ' ' + job.company)}`,
        avatar_url: s.avatar_url || '',
      }));
    }
  } catch (err) {
    console.warn('[STAKEHOLDERS] AI search failed, falling back to LinkedIn links:', err);
  }

  // Fallback: provide useful LinkedIn search links
  return [
    {
      name: "Find Recruiters",
      role: `Recruiters at ${job.company}`,
      connection_degree: "Out of Network",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=Recruiter+at+${encodedCompany}`,
      avatar_url: ""
    },
    {
      name: "Find Hiring Managers",
      role: `Engineering Managers at ${job.company}`,
      connection_degree: "Out of Network",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=Engineering+Manager+at+${encodedCompany}`,
      avatar_url: ""
    },
    {
      name: "Connect with Employees",
      role: `People at ${job.company}`,
      connection_degree: "Out of Network",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=${encodedCompany}&network=%5B%22F%22%2C%22S%22%5D`,
      avatar_url: ""
    }
  ];
};
