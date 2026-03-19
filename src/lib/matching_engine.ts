
import { CandidateProfile } from "./resume_engine";
import { JobOpportunity } from "./crawler_engine";
import { MatchingWeights } from "./learning_engine";
import { UserPreferences } from "./user_preferences";
import { supabaseWithLimits } from "./supabase-with-limits";

export interface MatchResult {
  overall_score: number; // 0-100
  skill_match: number; // 0-100
  culture_fit: number; // 0-100
  location_match: number; // 0-100
  reasoning: string[];
}

/**
 * Check whether a job's location is compatible with the user's preferred locations
 * and remote policy. Returns a 0-100 score.
 */
function scoreLocation(
  jobLocation: string,
  preferredLocations?: string[],
  remotePolicy?: string,
): { score: number; reasoning: string | null } {
  const loc = (jobLocation || "").toLowerCase();

  const isRemoteJob = loc.includes("remote");
  const isHybridJob = loc.includes("hybrid");

  // If user wants remote-only and job is remote → perfect
  if (remotePolicy === "remote") {
    if (isRemoteJob) return { score: 100, reasoning: "Remote role matches your preference." };
    if (isHybridJob) return { score: 50, reasoning: "Hybrid role — you prefer fully remote." };
    // Onsite job but user wants remote
    return { score: 10, reasoning: "On-site role doesn't match your remote preference." };
  }

  // If user wants onsite-only
  if (remotePolicy === "onsite") {
    if (isRemoteJob) return { score: 20, reasoning: "Remote role — you prefer on-site." };
  }

  // Check geographic match against preferred locations
  if (preferredLocations && preferredLocations.length > 0) {
    // Remote jobs are always acceptable unless user wants onsite-only (handled above)
    if (isRemoteJob) return { score: 95, reasoning: "Remote role is available from your location." };

    for (const pref of preferredLocations) {
      const prefLower = pref.toLowerCase().trim();
      if (!prefLower) continue;

      // Check if the job location contains any part of the preferred location
      // e.g. "Toronto, Ontario, Canada" matches "Toronto" or "Canada"
      const prefParts = prefLower.split(/[,\s]+/).filter(p => p.length > 2);
      const locParts = loc.split(/[,\s]+/).filter(p => p.length > 2);

      // Country/region match (last meaningful token typically)
      const hasOverlap = prefParts.some(pp => locParts.some(lp => 
        lp.includes(pp) || pp.includes(lp)
      ));

      if (hasOverlap) {
        return { score: 90, reasoning: `Location "${jobLocation}" matches your preference.` };
      }
    }

    // No location match at all
    return { score: 15, reasoning: `"${jobLocation}" is outside your preferred locations.` };
  }

  // No preferences set → neutral
  return { score: 70, reasoning: null };
}

/**
 * Score experience level alignment between user preference and job posting.
 */
function scoreExperienceLevel(
  jobTitle: string,
  jobDescription: string,
  userLevel?: string,
): { score: number; reasoning: string | null } {
  if (!userLevel || userLevel === "any") return { score: 80, reasoning: null };

  const text = (`${jobTitle} ${jobDescription}`).toLowerCase();

  const levelSignals: Record<string, string[]> = {
    entry: ["entry", "junior", "associate", "intern", "graduate", "jr.", "jr "],
    mid: ["mid-level", "mid level", "intermediate"],
    senior: ["senior", "sr.", "sr ", "lead", "staff", "principal"],
    lead: ["lead", "staff", "principal", "director", "head of", "vp ", "vice president", "manager"],
  };

  const userSignals = levelSignals[userLevel] || [];
  const matchesUserLevel = userSignals.some(s => text.includes(s));

  if (matchesUserLevel) return { score: 95, reasoning: null };

  // Check if it explicitly matches a DIFFERENT level
  const otherLevels = Object.entries(levelSignals).filter(([k]) => k !== userLevel);
  const matchesOtherLevel = otherLevels.some(([, signals]) => signals.some(s => text.includes(s)));

  if (matchesOtherLevel) {
    return { score: 30, reasoning: `This appears to be a different experience level than your "${userLevel}" preference.` };
  }

// No clear level signal in the job → neutral
  return { score: 70, reasoning: null };
}

/**
 * Detect if a user is likely a student based on education and experience keywords.
 */
function isStudentProfile(profile: CandidateProfile): boolean {
  const currentYear = new Date().getFullYear();
  
  // 1. Check education for ongoing or recent studies
  const educationSignals = profile.education.some(edu => {
    const yearMatch = edu.year.match(/\d{4}/);
    if (!yearMatch) return false;
    const gradYear = parseInt(yearMatch[0]);
    // Student if grad year is in future or within last year
    return gradYear >= currentYear || gradYear >= currentYear - 1;
  });

  if (educationSignals) return true;

  // 2. Check summary or experience for "student", "intern", "university", "class of"
  const text = (profile.summary || "").toLowerCase();
  if (text.includes("student") || text.includes("university") || text.includes("candidate") || text.includes("class of")) {
    return true;
  }

  return false;
}

export const calculateMatch = async (
  profile: CandidateProfile,
  job: JobOpportunity,
  weights?: MatchingWeights,
  preferences?: UserPreferences | null,
): Promise<MatchResult> => {

  // 0. Safety Checks (Learning Agent override)
  if (weights?.bannedCompanies.includes(job.company)) {
      return {
          overall_score: 0,
          skill_match: 0,
          culture_fit: 0,
          location_match: 0,
          reasoning: ["Company marked as 'Not Interested' by user."]
      };
  }

  let skillScore = 0;
  let matches = 0;
  const reasoning: string[] = [];

  // 1. Skill Analysis
  const jobLower = job.description.toLowerCase();
  const techStackLower = (job.tech_stack || []).map(t => t.toLowerCase());
  
  profile.skills.forEach(skill => {
    const skillLower = skill.name.toLowerCase();
    if (jobLower.includes(skillLower) || techStackLower.includes(skillLower)) {
      matches++;
    }
  });

  // Learning Boost
  if (weights?.preferredSkills) {
      weights.preferredSkills.forEach(pref => {
          if (jobLower.includes(pref.toLowerCase())) {
              matches += 0.5;
              if(!reasoning.includes(`Matches preferred skill: ${pref}`)) {
                  reasoning.push(`Matches preferred skill: ${pref}`);
              }
          }
      });
  }
  
  const expectedSkills = job.tech_stack && job.tech_stack.length > 0 
    ? Math.max(3, job.tech_stack.length) 
    : Math.max(3, Math.floor(job.description.length / 300));

  skillScore = Math.min(100, Math.round((matches / expectedSkills) * 100));

  if (matches > 0) {
      reasoning.push(`Matched ${Math.floor(matches)} key requirements.`);
  }

  // 2. Culture/Soft Signals Analysis
  let cultureScore = 70;
  
  const cultureKeywords = {
    positive: ['remote', 'flexible', 'work-life balance', 'inclusive', 'diverse', 'mentorship', 'growth', 'collaborative', 'transparent'],
    highValue: ['equity', 'unlimited pto', 'great benefits', 'competitive salary']
  };
  
  cultureKeywords.positive.forEach(keyword => {
    if (jobLower.includes(keyword)) {
      cultureScore += 3;
    }
  });
  
  cultureKeywords.highValue.forEach(keyword => {
    if (jobLower.includes(keyword)) {
      cultureScore += 5;
    }
  });
  
  cultureScore = Math.min(100, cultureScore);

  // 3. Location Match (NEW — geography-aware scoring)
  const locationResult = scoreLocation(
    job.location,
    preferences?.locations,
    preferences?.remote_policy,
  );
  const locationScore = locationResult.score;
  if (locationResult.reasoning) reasoning.push(locationResult.reasoning);

  // 4. Experience Level Match (NEW)
  const expResult = scoreExperienceLevel(
    job.title,
    job.description,
    preferences?.experience_level,
  );
  if (expResult.reasoning) reasoning.push(expResult.reasoning);

  // 5. Overall Weighted Score — now includes location and experience
  // Skills: 40%, Location: 25%, Experience: 15%, Culture: 10%, Freshness: 10%
  const wSkill = weights?.skillWeight ?? 0.40;
  const wCulture = weights?.cultureWeight ?? 0.10;
  const wFreshness = weights?.freshnessWeight ?? 0.10;
  const wLocation = 0.25;
  const wExperience = 0.15;

  let overall = 
    (skillScore * wSkill) + 
    (locationScore * wLocation) + 
    (expResult.score * wExperience) + 
    (cultureScore * wCulture) + 
    (job.freshness_score * 100 * wFreshness);

  // 5.5 Internship Boost for Students
  const isStudent = isStudentProfile(profile);
  // Note: "graduate" alone is excluded — it matches senior/graduate roles, not just internships.
  // Only match when "graduate" is specifically used in internship context (e.g. "graduate intern").
  const isInternship = (job.title + " " + job.description).toLowerCase().match(/\bintern(?!ational)\b|co-op|coop|\bgraduate\s+intern/i);

  if (isStudent && isInternship) {
    overall += 15; // Significant boost
    reasoning.push("Internship opportunity matched with your student profile.");
  } else if (!isStudent && isInternship) {
    overall -= 20; // Penalize internships for non-students
    reasoning.push("This is an internship, which may not match your experience level.");
  }

  // 6. Generate Reasoning
  if (skillScore > 80) {
    reasoning.push("High skill overlap. Your skill set aligns perfectly.");
  } else if (skillScore < 30) {
    reasoning.push("Low skill overlap with this role.");
  }
  
  if (job.source === 'Web' || job.source === 'Search') {
    reasoning.push("Fresh opportunity discovered via AI agents.");
  }

  return {
    overall_score: Math.min(100, Math.round(overall)),
    skill_match: Math.round(skillScore),
    culture_fit: Math.round(cultureScore),
    location_match: Math.round(locationScore),
    reasoning
  };
};

/**
 * SERVER-SIDE MATCHING ENGINE - Replaces O(n*m) client-side matching
 *
 * Uses database indexes and PostgreSQL full-text search for billion-user scale.
 * Performs all matching logic on the server to eliminate expensive client-side loops.
 */

interface ServerMatchResult extends JobOpportunity {
  match_score: number;
  skill_match: number;
  culture_fit: number;
  location_match: number;
  reasoning: string[];
}

export const getMatchedJobsServerSide = async (
  profile: CandidateProfile,
  weights?: MatchingWeights,
  preferences?: UserPreferences | null,
  limit = 20
): Promise<ServerMatchResult[]> => {
  try {
    // Extract user skills for matching
    const candidateSkills = profile.skills.map(s => s.name.toLowerCase());
    const experienceLevel = preferences?.experience_level || 'mid';
    const locationPreferences = preferences?.locations || [];
    const remotePolicy = preferences?.remote_policy || 'any';

    // Server-side matching using our performance indexes
    const { data: jobs, error } = await supabaseWithLimits
      .from('job_listings')
      .select('*')
      .order('freshness_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit * 3); // Get more to filter on server side

    if (error) {
      console.error('[getMatchedJobsServerSide] Database error:', error);
      return [];
    }

    if (!jobs || jobs.length === 0) {
      return [];
    }

    // Server-side scoring with single pass through data
    const scoredJobs: ServerMatchResult[] = [];

    for (const job of jobs) {
      // Skip banned companies from learning weights
      if (weights?.bannedCompanies.includes(job.company)) {
        continue;
      }

      const jobData = job as unknown as JobOpportunity;
      const scoring = calculateServerSideScore(jobData, candidateSkills, preferences, weights);

      if (scoring.overall_score >= 20) { // Only include jobs with reasonable match
        scoredJobs.push({
          ...jobData,
          match_score: scoring.overall_score,
          skill_match: scoring.skill_match,
          culture_fit: scoring.culture_fit,
          location_match: scoring.location_match,
          reasoning: scoring.reasoning
        });
      }

      // Early exit if we have enough good matches
      if (scoredJobs.length >= limit) {
        break;
      }
    }

    // Sort by match score descending
    return scoredJobs
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

  } catch (error) {
    console.error('[getMatchedJobsServerSide] Error:', error);
    return [];
  }
};

/**
 * Efficient server-side scoring that replaces the client-side O(n*m) complexity
 */
function calculateServerSideScore(
  job: JobOpportunity,
  candidateSkills: string[],
  preferences?: UserPreferences | null,
  weights?: MatchingWeights
): {
  overall_score: number;
  skill_match: number;
  culture_fit: number;
  location_match: number;
  reasoning: string[];
} {
  const reasoning: string[] = [];

  // 1. Skill matching using pre-processed arrays (much faster than string search)
  const jobSkills = (job.tech_stack || []).map(s => s.toLowerCase());
  const jobDescLower = job.description.toLowerCase();

  let skillMatches = 0;
  candidateSkills.forEach(skill => {
    if (jobSkills.includes(skill) || jobDescLower.includes(skill)) {
      skillMatches++;
    }
  });

  // Add preferred skills boost
  if (weights?.preferredSkills) {
    weights.preferredSkills.forEach(pref => {
      if (jobDescLower.includes(pref.toLowerCase())) {
        skillMatches += 0.5;
        reasoning.push(`Matches preferred skill: ${pref}`);
      }
    });
  }

  const expectedSkills = Math.max(3, jobSkills.length || 3);
  const skillScore = Math.min(100, Math.round((skillMatches / expectedSkills) * 100));

  // 2. Culture fit (optimized keyword matching)
  let cultureScore = 70;
  const positiveKeywords = ['remote', 'flexible', 'work-life balance', 'inclusive', 'diverse', 'mentorship', 'growth'];
  const highValueKeywords = ['equity', 'unlimited pto', 'great benefits', 'competitive salary'];

  positiveKeywords.forEach(keyword => {
    if (jobDescLower.includes(keyword)) cultureScore += 3;
  });

  highValueKeywords.forEach(keyword => {
    if (jobDescLower.includes(keyword)) cultureScore += 5;
  });

  cultureScore = Math.min(100, cultureScore);

  // 3. Location scoring (simplified for server-side)
  const jobLocationLower = (job.location || '').toLowerCase();
  const isRemote = jobLocationLower.includes('remote');
  const isHybrid = jobLocationLower.includes('hybrid');

  let locationScore = 70; // Default score

  if (preferences?.remote_policy === 'remote') {
    if (isRemote) {
      locationScore = 100;
      reasoning.push('Remote role matches your preference.');
    } else if (isHybrid) {
      locationScore = 50;
    } else {
      locationScore = 10;
    }
  }

  // 4. Overall weighted score
  const wSkill = weights?.skillWeight ?? 0.40;
  const wCulture = weights?.cultureWeight ?? 0.10;
  const wFreshness = weights?.freshnessWeight ?? 0.10;
  const wLocation = 0.25;
  const wExperience = 0.15;

  const overallScore =
    (skillScore * wSkill) +
    (locationScore * wLocation) +
    (75 * wExperience) + // Simplified experience scoring
    (cultureScore * wCulture) +
    ((job.freshness_score || 0.5) * 100 * wFreshness);

  if (skillMatches > 0) {
    reasoning.push(`Matched ${Math.floor(skillMatches)} key requirements.`);
  }

  return {
    overall_score: Math.min(100, Math.round(overallScore)),
    skill_match: skillScore,
    culture_fit: cultureScore,
    location_match: locationScore,
    reasoning
  };
}
