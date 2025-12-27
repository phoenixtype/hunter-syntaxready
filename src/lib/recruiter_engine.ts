
import { JobOpportunity } from "./crawler_engine";

export interface Stakeholder {
  name: string;
  role: string;
  connection_degree: '1st' | '2nd' | '3rd' | 'Out of Network';
  avatar_url?: string;
  profile_url: string;
}

export const findStakeholders = async (job: JobOpportunity): Promise<Stakeholder[]> => {
  // Simulate graph search latency
  await new Promise(resolve => setTimeout(resolve, 1200));

  // Mock data based on job company if we wanted to be fancy, but generic for now
  return [
    {
      name: "Sarah Jenkins",
      role: "Technical Recruiter",
      connection_degree: "2nd",
      profile_url: "#"
    },
    {
      name: "David Chen",
      role: "Engineering Manager",
      connection_degree: "3rd",
      profile_url: "#"
    },
    {
      name: "Emily Ross",
      role: "VP of Engineering",
      connection_degree: "Out of Network",
      profile_url: "#"
    }
  ];
};
