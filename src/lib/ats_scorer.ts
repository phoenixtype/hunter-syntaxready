import { CandidateProfile } from "./resume_engine";

// ATS Scorer
// Analyzes the "health" of the profile structure.
// Checks for "red flags" that ATS systems hate (missing email, bad phone format, lack of metrics).

export interface ATSHealthCheck {
  totalScore: number;
  checks: {
    identity: { score: number; issues: string[] };
    skills: { score: number; issues: string[] };
    experience: { score: number; issues: string[] };
    education: { score: number; issues: string[] };
  };
  recommendation: string;
}

export const scoreProfileHealth = (profile: CandidateProfile): ATSHealthCheck => {
  const health: ATSHealthCheck = {
    totalScore: 100,
    checks: {
      identity: { score: 100, issues: [] },
      skills: { score: 100, issues: [] },
      experience: { score: 100, issues: [] },
      education: { score: 100, issues: [] }
    },
    recommendation: ""
  };

  // 1. Identity Check
  if (!profile.identity.email) {
    health.checks.identity.score -= 40;
    health.checks.identity.issues.push("Missing email address");
  } else if (!/@/.test(profile.identity.email)) {
    health.checks.identity.score -= 20;
    health.checks.identity.issues.push("Invalid email format");
  }

  if (!profile.identity.name || profile.identity.name === "Unknown Candidate") {
    health.checks.identity.score -= 30;
    health.checks.identity.issues.push("Could not detect full name");
  }

  if (profile.identity.links.length === 0) {
    health.checks.identity.score -= 10;
    health.checks.identity.issues.push("No professional links (LinkedIn/Github) found");
  }

  // 2. Skills Check
  if (profile.skills.length === 0) {
    health.checks.skills.score -= 50;
    health.checks.skills.issues.push("No detectable technical skills found");
  } else if (profile.skills.length < 5) {
    health.checks.skills.score -= 20;
    health.checks.skills.issues.push("Skill list is too thin (aim for 8+ skills)");
  }

  // 3. Experience Check
  if (profile.experience_atoms.length === 0) {
    health.checks.experience.score -= 50;
    health.checks.experience.issues.push("No work experience detected");
  } else {
    profile.experience_atoms.forEach(exp => {
      // Check for quantifiers (numbers, %, $)
      if (!/\d+|%|\$|increased|reduced|improved/i.test(exp.content)) {
        health.checks.experience.score -= 5;
        health.checks.experience.issues.push(`Role at ${exp.company || 'Unknown'} lacks measurable impact (numbers/metrics)`);
      }
      if (exp.content.length < 50) {
        health.checks.experience.score -= 5;
        health.checks.experience.issues.push(`Description for ${exp.company || 'Unknown'} is too short`);
      }
    });
  }

  // 4. Education Check
  if (profile.education.length === 0) {
    health.checks.education.score -= 20;
    health.checks.education.issues.push("No education history found (optional but recommended)");
  }

  // Calculate Total Weighted Score
  // Identity: 20%, Skills: 30%, Experience: 40%, Education: 10%
  health.totalScore = Math.round(
    (health.checks.identity.score * 0.2) +
    (health.checks.skills.score * 0.3) +
    (health.checks.experience.score * 0.4) +
    (health.checks.education.score * 0.1)
  );

  // Recommendation
  if (health.totalScore >= 90) health.recommendation = "Excellent! Your resume is ATS-ready.";
  else if (health.totalScore >= 70) health.recommendation = "Good, but add more metrics to your experience.";
  else health.recommendation = "Needs improvement. Focus on parsing errors and adding keywords.";

  return health;
};
