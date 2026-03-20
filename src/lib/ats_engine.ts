import { CandidateProfile } from "./resume_engine";

export interface ATSResult {
  score: number;
  missing_keywords: string[];
  formatting_issues: string[];
  recommendations: string[];
  strengths: string[];
  keyword_coverage: number; // 0–100
  breakdown: {
    keywords: number;
    formatting: number;
    content_depth: number;
    contact_completeness: number;
  };
}

// Common ATS-unfriendly patterns
const _FORMATTING_RED_FLAGS = [
  /\btable\b/i,
  /\bcolumn\b/i,
  /\btext box\b/i,
  /\bheader\b.*\bfooter\b/i,
];
void _FORMATTING_RED_FLAGS;

// Strong action verbs — boost score if present
const ACTION_VERBS = new Set([
  "led","built","delivered","designed","scaled","automated","reduced","increased",
  "launched","architected","managed","owned","drove","negotiated","implemented",
  "developed","created","established","improved","optimized","streamlined",
  "generated","saved","grew","transformed","mentored","collaborated","shipped",
  "deployed","migrated","refactored","integrated","spearheaded","pioneered",
]);

// Extract meaningful keywords from job description (multi-strategy)
const extractJobKeywords = (text: string): string[] => {
  const found = new Set<string>();

  // 1. CamelCase / TitleCase skills: React, TypeScript, PostgreSQL, AWS
  const titleCase = text.match(/[A-Z][a-zA-Z0-9+#.]{1,20}/g) || [];
  titleCase.forEach(w => { if (w.length >= 2 && w.length <= 20) found.add(w); });

  // 2. ALL-CAPS acronyms: SQL, AWS, CI/CD, REST, GDPR
  const acronyms = text.match(/\b[A-Z]{2,8}\b/g) || [];
  acronyms.forEach(w => found.add(w));

  // 3. Hyphenated and slash terms: cross-functional, CI/CD, full-stack
  const hyphenated = text.match(/[a-zA-Z]+-[a-zA-Z]+(?:\/[a-zA-Z]+)?/g) || [];
  hyphenated.forEach(w => { if (w.length <= 25) found.add(w.toLowerCase()); });

  // 4. Common tech keywords (lowercase): python, node.js, kubernetes, docker
  const lowerTech = text.match(/\b(?:python|java(?:script)?|typescript|node\.?js|react|vue|angular|docker|kubernetes|terraform|graphql|redis|kafka|postgres(?:ql)?|mongodb|mysql|elasticsearch|swift|kotlin|rust|golang|ruby|php|scala|spark|hadoop|airflow|dbt|looker|tableau|salesforce|hubspot|jira|confluence|agile|scrum|devops|mlops|llm|rag|api|sdk|saas|paas|iaas)\b/gi) || [];
  lowerTech.forEach(w => found.add(w.toLowerCase()));

  return Array.from(found).slice(0, 30);
};

// Check if a keyword is covered by the candidate's profile text
const isCoveredByProfile = (keyword: string, profile: CandidateProfile): boolean => {
  const lk = keyword.toLowerCase();

  // Check skills list
  if (profile.skills.some(s =>
    s.name.toLowerCase().includes(lk) || lk.includes(s.name.toLowerCase())
  )) return true;

  // Check experience bullet content
  const allContent = profile.experience_atoms
    .map(e => e.content + ' ' + e.role + ' ' + e.company)
    .join(' ')
    .toLowerCase();

  if (allContent.includes(lk)) return true;

  // Check summary
  if ((profile.summary ?? '').toLowerCase().includes(lk)) return true;

  return false;
};

// Count quantified bullets (has a number/%)
const countQuantifiedBullets = (profile: CandidateProfile): number => {
  let count = 0;
  for (const exp of profile.experience_atoms) {
    const bullets = exp.content.split('\n');
    for (const b of bullets) {
      if (/\d+/.test(b)) count++;
    }
  }
  return count;
};

// Count bullets that start with strong action verbs
const countActionVerbBullets = (profile: CandidateProfile): number => {
  let count = 0;
  for (const exp of profile.experience_atoms) {
    const bullets = exp.content.split('\n');
    for (const b of bullets) {
      const firstWord = b.trim().replace(/^[•\-\*]\s*/, '').split(/\s+/)[0]?.toLowerCase();
      if (firstWord && ACTION_VERBS.has(firstWord)) count++;
    }
  }
  return count;
};

export const analyzeResumeForJob = async (
  profile: CandidateProfile,
  jobDescription: string
): Promise<ATSResult> => {
  const missingKeywords: string[] = [];
  const formattingIssues: string[] = [];
  const recommendations: string[] = [];
  const strengths: string[] = [];

  // ── 1. Keyword analysis ───────────────────────────────────────────────────
  const jobKeywords = extractJobKeywords(jobDescription);
  const matchedKeywords: string[] = [];

  jobKeywords.forEach(keyword => {
    if (isCoveredByProfile(keyword, profile)) {
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  });

  const keywordCoverage = jobKeywords.length > 0
    ? Math.round((matchedKeywords.length / jobKeywords.length) * 100)
    : 100;

  // ── 2. Content depth analysis ─────────────────────────────────────────────
  const totalBullets = profile.experience_atoms.reduce(
    (sum, e) => sum + e.content.split('\n').filter(l => l.trim().length > 2).length, 0
  );
  const quantifiedBullets = countQuantifiedBullets(profile);
  const actionVerbBullets = countActionVerbBullets(profile);

  const avgBulletsPerRole = profile.experience_atoms.length > 0
    ? totalBullets / profile.experience_atoms.length : 0;

  // ── 3. Formatting audit ───────────────────────────────────────────────────
  if (!profile.identity.email?.trim()) {
    formattingIssues.push("Missing email — required for ATS contact parsing");
  }
  if (!profile.identity.phone?.trim()) {
    formattingIssues.push("Missing phone number");
  }
  if (!profile.identity.name?.trim()) {
    formattingIssues.push("Missing full name");
  }
  if (profile.experience_atoms.length === 0) {
    formattingIssues.push("No work experience listed");
  }
  if (profile.education.length === 0) {
    formattingIssues.push("No education section — many ATS systems require this");
  }
  if (profile.skills.length === 0) {
    formattingIssues.push("No skills listed — skills section is heavily weighted in ATS");
  } else if (profile.skills.length < 5) {
    formattingIssues.push("Fewer than 5 skills listed — add more relevant skills");
  }
  if (!profile.summary?.trim()) {
    formattingIssues.push("No professional summary — ATS uses this for initial ranking");
  }
  if (avgBulletsPerRole < 2 && profile.experience_atoms.length > 0) {
    formattingIssues.push("Too few bullet points per role — aim for 3–5 per position");
  }

  // ── 4. Strengths ──────────────────────────────────────────────────────────
  if (keywordCoverage >= 70) {
    strengths.push(`Strong keyword match — ${keywordCoverage}% of required skills found`);
  }
  if (quantifiedBullets >= 3) {
    strengths.push(`${quantifiedBullets} quantified achievements — metrics boost ATS ranking`);
  }
  if (actionVerbBullets >= 4) {
    strengths.push(`${actionVerbBullets} bullets use strong action verbs`);
  }
  if (profile.experience_atoms.length >= 2) {
    strengths.push(`${profile.experience_atoms.length} distinct roles demonstrate career progression`);
  }
  if (profile.skills.length >= 10) {
    strengths.push(`${profile.skills.length} skills listed — comprehensive skills section`);
  }

  // ── 5. Recommendations ───────────────────────────────────────────────────
  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords.slice(0, 6).join(", ");
    recommendations.push(
      `Add these missing keywords naturally into your bullets: ${topMissing}`
    );
  }
  if (quantifiedBullets < 3) {
    recommendations.push(
      "Quantify more achievements — add numbers, percentages, or scale (e.g. 'Reduced load time by 40%', 'Managed team of 8')"
    );
  }
  if (actionVerbBullets < totalBullets * 0.5) {
    recommendations.push(
      "Start more bullets with strong action verbs: Led, Built, Delivered, Reduced, Scaled, Launched, Automated"
    );
  }
  if (!profile.summary) {
    recommendations.push(
      "Add a 2–3 sentence professional summary tailored to this role — it appears near the top and is one of the first things ATS parses"
    );
  }
  if (profile.skills.length < 8) {
    recommendations.push(
      "Expand your skills section to 8–15 items. Include both technical skills and domain-specific tools from the job description"
    );
  }

  // ── 6. Scoring breakdown ──────────────────────────────────────────────────
  // Keywords: 40 points
  const keywordScore = Math.round((keywordCoverage / 100) * 40);

  // Formatting: 25 points (deduct per issue)
  const maxFormattingIssues = 5;
  const formattingScore = Math.max(0,
    25 - Math.min(formattingIssues.length, maxFormattingIssues) * 5
  );

  // Content depth: 25 points
  let contentScore = 0;
  if (profile.experience_atoms.length >= 1) contentScore += 8;
  if (profile.experience_atoms.length >= 2) contentScore += 4;
  if (quantifiedBullets >= 2) contentScore += 6;
  if (quantifiedBullets >= 4) contentScore += 3;
  if (actionVerbBullets >= 3) contentScore += 4;
  contentScore = Math.min(contentScore, 25);

  // Contact completeness: 10 points
  let contactScore = 0;
  if (profile.identity.email) contactScore += 4;
  if (profile.identity.phone) contactScore += 2;
  if (profile.identity.name)  contactScore += 2;
  if ((profile.identity.links?.length ?? 0) > 0) contactScore += 2;
  contactScore = Math.min(contactScore, 10);

  const finalScore = Math.min(100, keywordScore + formattingScore + contentScore + contactScore);

  // Generic final push recommendation if score is still low
  if (finalScore < 60 && recommendations.length < 4) {
    recommendations.push(
      "Mirror the job description language closely — use the same terminology for tools and responsibilities"
    );
  }

  return {
    score: finalScore,
    missing_keywords: missingKeywords.slice(0, 10),
    formatting_issues: formattingIssues,
    recommendations,
    strengths,
    keyword_coverage: keywordCoverage,
    breakdown: {
      keywords: keywordScore,
      formatting: formattingScore,
      content_depth: contentScore,
      contact_completeness: contactScore,
    },
  };
};
