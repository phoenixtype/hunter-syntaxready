
import { CandidateProfile } from "./resume_engine";
import { JobOpportunity } from "./crawler_engine";

export interface TailoredContent {
  resume: CandidateProfile;
  coverLetter: string;
  changes_summary: string[];
}

export const generateTailoredContent = async (
  profile: CandidateProfile,
  job: JobOpportunity
): Promise<TailoredContent> => {
  // Simulate LLM latency
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Mock tailoring logic
  const changesReceived: string[] = [];
  
  // 1. Tailor Resume (Mock)
  // Clone profile to avoid mutation
  const tailoredResume = JSON.parse(JSON.stringify(profile)) as CandidateProfile;
  
  // Add job-specific keyword to first skill if missing
  const jobKeywords = job.description.split(" ").filter(w => w.length > 5);
  if (jobKeywords.length > 0) {
     const keyword = jobKeywords[0];
     if (!tailoredResume.skills.find(s => s.name === keyword)) {
         tailoredResume.skills.unshift({ name: keyword, proficiency: 0.8, evidence: ["Inferred from project experience"] });
         changesReceived.push(`Added high-priority keyword: "${keyword}"`);
     }
  }

  // Rewrite an experience atom
  if (tailoredResume.experience_atoms.length > 0) {
      tailoredResume.experience_atoms[0].content += ` Optimized for ${job.company}'s focus on ${job.title}.`;
      changesReceived.push("Refined recent experience to match role terminology.");
  }

  // 2. Generate Cover Letter
  const coverLetter = `
Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} role. With my background in ${profile.experience_atoms[0]?.role || "engineering"} and passion for ${job.company}'s mission, I believe I can make an immediate impact.

Specific matches to your requirements:
- ${tailoredResume.skills[0]?.name}: Proven track record.
- ${tailoredResume.skills[1]?.name}: Deep expertise.

I look forward to the possibility of discussing how I can contribute to the team.

Best regards,
${profile.identity.name}
  `.trim();

  return {
    resume: tailoredResume,
    coverLetter,
    changes_summary: changesReceived
  };
};
