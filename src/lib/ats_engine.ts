
import { CandidateProfile } from "./resume_engine";

export interface ATSResult {
  score: number;
  missing_keywords: string[];
  formatting_issues: string[];
  recommendations: string[];
}

// Helper to extract keywords from a job description
const extractKeywords = (text: string): string[] => {
  const words = text.match(/[A-Z][a-z0-9#+.]+/g) || [];
  // Filter for unique, reasonably lengthed words that look like skills/tools
  const uniqueWords = Array.from(new Set(words));
  return uniqueWords.filter(w => w.length >= 2 && w.length <= 15).slice(0, 15);
};

export const analyzeResumeForJob = async (
  profile: CandidateProfile, 
  jobDescription: string
): Promise<ATSResult> => {
  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 800));

  const missingKeywords: string[] = [];
  const formattingIssues: string[] = [];
  const recommendations: string[] = [];

  // 1. Keyword Analysis (Dynamic Extraction)
  const jobKeywords = extractKeywords(jobDescription);
  
  jobKeywords.forEach(keyword => {
    // If keyword is in JD but not in Profile Skills
    const inProfile = profile.skills.some(s => 
      s.name.toLowerCase().includes(keyword.toLowerCase()) || 
      keyword.toLowerCase().includes(s.name.toLowerCase())
    );
    
    if (!inProfile) {
      missingKeywords.push(keyword);
    }
  });

  // 2. Formatting Audit (Real checks)
  if (profile.education.length === 0) {
    formattingIssues.push("Missing Education Section");
  }
  
  // Check for missing contact info
  if (!profile.identity.email || profile.identity.email.trim() === '') {
    formattingIssues.push("Missing email in contact information");
  }
  
  // Check for experience entries
  if (profile.experience_atoms.length === 0) {
    formattingIssues.push("Missing Work Experience Section");
  }
  
  // Check for skills
  if (profile.skills.length === 0) {
    formattingIssues.push("Missing Skills Section");
  } else if (profile.skills.length < 3) {
    formattingIssues.push("Consider adding more relevant skills");
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
