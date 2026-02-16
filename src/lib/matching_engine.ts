
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

  // 1. Skill Analysis
  // Match skills against both job description AND tech_stack for better accuracy
  const jobLower = job.description.toLowerCase();
  const techStackLower = (job.tech_stack || []).map(t => t.toLowerCase());
  
  profile.skills.forEach(skill => {
    const skillLower = skill.name.toLowerCase();
    // Match against both description AND tech_stack
    if (jobLower.includes(skillLower) || techStackLower.includes(skillLower)) {
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
  
  // Determine expected skills baseline dynamically
  // If job has tech_stack, use that length (min 3), otherwise use heuristic based on JD length
  const expectedSkills = job.tech_stack && job.tech_stack.length > 0 
    ? Math.max(3, job.tech_stack.length) 
    : Math.max(3, Math.floor(job.description.length / 300));

  skillScore = Math.min(100, Math.round((matches / expectedSkills) * 100));

  if (matches > 0) {
      reasoning.push(`Matched ${Math.floor(matches)} key requirements.`);
  }

  // 2. Culture/Soft Signals Analysis (Real keyword-based scoring)
  let cultureScore = 70; // Base score
  
  // Culture indicators to look for in job description
  const cultureKeywords = {
    positive: ['remote', 'flexible', 'work-life balance', 'inclusive', 'diverse', 'mentorship', 'growth', 'collaborative', 'transparent'],
    highValue: ['equity', 'unlimited pto', 'great benefits', 'competitive salary']
  };
  
  cultureKeywords.positive.forEach(keyword => {
    if (jobLower.includes(keyword)) {
      cultureScore += 3;
      reasoning.push(`Culture match: ${keyword}`);
    }
  });
  
  cultureKeywords.highValue.forEach(keyword => {
    if (jobLower.includes(keyword)) {
      cultureScore += 5;
    }
  });
  
  cultureScore = Math.min(100, cultureScore); // Cap at 100
  
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
