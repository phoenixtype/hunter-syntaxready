
import { CandidateProfile } from "./resume_engine";
import { JobOpportunity } from "./crawler_engine";
import { MatchingWeights } from "./learning_engine";

export interface MatchResult {
  overall_score: number; // 0-100
  skill_match: number; // 0-100
  culture_fit: number; // 0-100
  reasoning: string[];
}

export const calculateMatch = async (
  profile: CandidateProfile,
  job: JobOpportunity,
  weights?: MatchingWeights
): Promise<MatchResult> => {
  // Simulate processing time (Vector matching is heavy!)
  await new Promise(resolve => setTimeout(resolve, 600));

  // 0. Safety Checks (Learning Agent override)
  if (weights?.bannedCompanies.includes(job.company)) {
      return {
          overall_score: 0,
          skill_match: 0,
          culture_fit: 0,
          reasoning: ["Company marked as 'Not Interested' by user."]
      };
  }

  let skillScore = 0;
  let matches = 0;
  const reasoning: string[] = [];

  // 1. Skill Analysis (Mock)
  // Simple keyword matching against job content
  const jobLower = job.description.toLowerCase();
  profile.skills.forEach(skill => {
    if (jobLower.includes(skill.name.toLowerCase())) {
      matches++;
    }
  });

  // Learning Boost
  if (weights?.preferredSkills) {
      weights.preferredSkills.forEach(pref => {
          if (jobLower.includes(pref.toLowerCase())) {
              matches += 0.5; // Bonus for preferred skills
              if(!reasoning.includes(`Matches preferred skill: ${pref}`)) {
                  reasoning.push(`Matches preferred skill: ${pref}`);
              }
          }
      });
  }
  
  // Normalize checking against a baseline of expected skills (say 4 for this demo)
  const expectedSkills = 4; // Arbitrary complexity of job
  skillScore = Math.min(100, (matches / expectedSkills) * 100);

  // 2. Culture/Soft Signals
  // Random "AI" noise for variation in this mock, biased towards high for specific companies
  let cultureScore = 75; 
  if (job.company === "Linear" || job.company === "Stripe") {
    cultureScore = 95; // Everyone fits at Stripe in our dream world
  }
  
  // 3. Overall Weighted Score
  // Default: Skills 60%, Culture 20%, Freshness 20%
  const wSkill = weights?.skillWeight ?? 0.6;
  const wCulture = weights?.cultureWeight ?? 0.2;
  const wFreshness = weights?.freshnessWeight ?? 0.2;

  const overall = (skillScore * wSkill) + (cultureScore * wCulture) + (job.freshness_score * 100 * wFreshness);

  // 4. Generate Reasoning
  if (skillScore > 80) {
    reasoning.push("High skill overlap. Your skill set aligns perfectly.");
  } else if (skillScore < 50) {
    reasoning.push("Missing key requirement matches.");
  }
  
  if (job.source === 'Perplexity' || job.source === 'Firecrawl') {
    reasoning.push("Fresh opportunity discovered via AI agents.");
  }

  return {
    overall_score: Math.round(overall),
    skill_match: Math.round(skillScore),
    culture_fit: Math.round(cultureScore),
    reasoning
  };
};
