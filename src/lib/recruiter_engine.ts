
import { JobOpportunity } from "./crawler_engine";

export interface Stakeholder {
  name: string;
  role: string;
  connection_degree: '1st' | '2nd' | '3rd' | 'Out of Network';
  avatar_url?: string;
  profile_url: string;
}

export const findStakeholders = async (job: JobOpportunity): Promise<Stakeholder[]> => {
  // Dynamic generation of search strategies
  const encodedCompany = encodeURIComponent(job.company);
  
  return [
    {
      name: "Identify Recruiters",
      role: "Click to search on LinkedIn",
      connection_degree: "1st",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=Recruiter+at+${encodedCompany}`,
      avatar_url: "" 
    },
    {
      name: "Find Hiring Managers",
      role: "Click to search on LinkedIn",
      connection_degree: "2nd",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=Engineering+Manager+at+${encodedCompany}`,
      avatar_url: ""
    },
    {
      name: "Connect with Alumni",
      role: "Click to search for Alumni",
      connection_degree: "3rd",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=${encodedCompany}&network=%5B%22F%22%2C%22S%22%5D`,
      avatar_url: ""
    }
  ];
};
