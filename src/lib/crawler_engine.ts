
export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  description: string;
  source: 'Firecrawl' | 'Perplexity' | 'LinkedIn' | 'Direct';
  freshness_score: number; // 0-1 (1 is brand new)
  credibility_score: number; // 0-1
  url: string;
  posted_at: string;
}

// Mock Job Data Source
const MOCK_JOBS: JobOpportunity[] = [
  {
    id: "job-1",
    title: "Senior Full Stack Engineer",
    company: "TechFlow AI",
    location: "Remote",
    salary_range: "$160k - $220k",
    description: "We are looking for a Senior Engineer with React, TypeScript, and Node.js experience to lead our core platform team.",
    source: "Perplexity",
    freshness_score: 0.98,
    credibility_score: 0.95,
    url: "https://example.com/job1",
    posted_at: "2 hours ago"
  },
  {
    id: "job-2",
    title: "Founding Engineer",
    company: "Stealth Startup",
    location: "San Francisco / Hybrid",
    salary_range: "$180k - $250k + Equity",
    description: "Early stage startup building the future of generative UI. Needs strong System Design and graphics programming skills.",
    source: "Firecrawl",
    freshness_score: 0.95,
    credibility_score: 0.8,
    url: "https://example.com/job2",
    posted_at: "5 hours ago"
  },
  {
    id: "job-3",
    title: "Product Engineer",
    company: "Linear",
    location: "Remote",
    salary_range: "$170k - $210k",
    description: "Join the team building the best issue tracking tool. Focus on craft, polish, and performance.",
    source: "Direct",
    freshness_score: 0.85,
    credibility_score: 0.99,
    url: "https://example.com/job3",
    posted_at: "1 day ago"
  },
    {
    id: "job-4",
    title: "Frontend Architect",
    company: "Stripe",
    location: "New York",
    salary_range: "$220k - $320k",
    description: "Architect the next generation of Stripe's dashboard. Deep expertise in React and Performance required.",
    source: "LinkedIn",
    freshness_score: 0.7,
    credibility_score: 0.99,
    url: "https://example.com/job4",
    posted_at: "3 days ago"
  }
];

export const searchJobs = async (query: string): Promise<JobOpportunity[]> => {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Return mocked data, maybe filter if we wanted to be fancy but currently just returning the feed
  return MOCK_JOBS;
};

export const getJobById = async (id: string): Promise<JobOpportunity | undefined> => {
  return MOCK_JOBS.find(j => j.id === id);
};
