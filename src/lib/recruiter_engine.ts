
import { JobOpportunity } from "./crawler_engine";

export interface Stakeholder {
  name: string;
  role: string;
  connection_degree: '1st' | '2nd' | '3rd' | 'Out of Network';
  avatar_url?: string;
  profile_url: string;
}

export const findStakeholders = async (job: JobOpportunity): Promise<Stakeholder[]> => {
  // Real utility: Generate deep-search links for the user to find actual people
  // This replaces "Fake AI" with "Augmented Intelligence"

  const encodedCompany = encodeURIComponent(job.company);
  
  return [
    {
      name: "Find Recruiters",
      role: "LinkedIn Search",
      connection_degree: "1st",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=Recruiter+at+${encodedCompany}`,
      avatar_url: "https://cdn-icons-png.flaticon.com/512/174/174857.png" // LinkedIn icon placeholder
    },
    {
      name: "Engineering Managers",
      role: "LinkedIn Search",
      connection_degree: "2nd",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=Engineering+Manager+at+${encodedCompany}`,
      avatar_url: "https://cdn-icons-png.flaticon.com/512/174/174857.png"
    },
    {
      name: "Company Alumni",
      role: "Network Search",
      connection_degree: "3rd",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=${encodedCompany}&network=%5B%22F%22%2C%22S%22%5D` // 1st/2nd connections
    }
  ];
};
