
import { CandidateProfile } from "./resume_engine";

export interface ATSResult {
  score: number;
  missing_keywords: string[];
  formatting_issues: string[];
  recommendations: string[];
}

// Mock database of keywords often found in tech job descriptions
const TECH_KEYWORDS = [
  "React", "TypeScript", "Node.js", "AWS", "Docker", "Kubernetes", "CI/CD",
  "GraphQL", "PostgreSQL", "System Design", "Microservices", "Agile"
];

export const analyzeResumeForJob = async (
  profile: CandidateProfile, 
  jobDescription: string
): Promise<ATSResult> => {
  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 800));

  const missingKeywords: string[] = [];
  const formattingIssues: string[] = [];
  const recommendations: string[] = [];

  // 1. Keyword Analysis (Mock Logic)
  // In a real system, we'd use NLP to extract keywords from JD and compare with profile atoms
  // Here we just check against our static list and simulated "missing" ones based on the JD string
  
  TECH_KEYWORDS.forEach(keyword => {
    // If keyword is in JD but not in Profile Skills
    const inJD = jobDescription.toLowerCase().includes(keyword.toLowerCase());
    const inProfile = profile.skills.some(s => s.name.toLowerCase() === keyword.toLowerCase());
    
    if (inJD && !inProfile) {
      missingKeywords.push(keyword);
    }
  });

  // 2. Formatting Audit (Mock)
  // Check if "Education" is present but maybe simulated issues
  if (profile.education.length === 0) {
    formattingIssues.push("Missing Education Section");
  }

  // 3. Scoring
  // Base score 100, deduct for missing keywords
  let score = 100;
  score -= (missingKeywords.length * 5);
  score -= (formattingIssues.length * 10);
  score = Math.max(0, score); // Clamp to 0

  // 4. Recommendations
  if (missingKeywords.length > 0) {
    recommendations.push(`Integrate the following keywords into your experience bullets: ${missingKeywords.join(", ")}`);
  }
  if (score < 70) {
    recommendations.push("Your resume formatting may be causing parsing errors. Consider using a standard PDF layout.");
  } else {
    recommendations.push("Strong ATS visibility. Good luck!");
  }

  return {
    score,
    missing_keywords: missingKeywords,
    formatting_issues: formattingIssues,
    recommendations
  };
};
