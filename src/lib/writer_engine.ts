import { supabase } from "@/integrations/supabase/client";
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
  const { data: { session } } = await supabase.auth.getSession();
  const authHeader = session ? { Authorization: `Bearer ${session.access_token}` } : {};

  // Run cover letter + resume rewrite in parallel for speed
  const [coverLetterResult, rewriteResult] = await Promise.allSettled([
    supabase.functions.invoke('generate-content', {
      body: { profile, job, type: 'cover_letter' },
      headers: authHeader,
    }),
    supabase.functions.invoke('generate-content', {
      body: { profile, job, type: 'resume_rewrite' },
      headers: authHeader,
    }),
  ]);

  const coverLetterData = coverLetterResult.status === 'fulfilled' ? coverLetterResult.value.data : null;
  const coverLetterError = coverLetterResult.status === 'fulfilled' ? coverLetterResult.value.error : null;

  if (coverLetterError) {
    console.error('Cover letter generation error:', coverLetterError);
  }

  const rewriteData = rewriteResult.status === 'fulfilled' ? rewriteResult.value.data : null;

  // Deep-clone the profile so we never mutate the original
  const tailoredResume = JSON.parse(JSON.stringify(profile)) as CandidateProfile;
  const changesSummary: string[] = [];

  // Apply AI-rewritten bullets to experience atoms
  if (rewriteData?.content) {
    try {
      // Strip markdown code fences the AI sometimes adds (```json ... ```)
      const rawJson = rewriteData.content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      const rewrites: Array<{ id: string; rewritten_content: string }> = JSON.parse(rawJson);
      let rewriteCount = 0;
      rewrites.forEach((rewrite, idx) => {
        if (!rewrite.rewritten_content) return;
        // Try ID match first; fall back to positional match so atoms without IDs still get rewritten
        let atomIdx = rewrite.id
          ? tailoredResume.experience_atoms.findIndex(a => a.id === rewrite.id)
          : -1;
        if (atomIdx < 0 && idx < tailoredResume.experience_atoms.length) {
          atomIdx = idx;
        }
        if (atomIdx >= 0) {
          tailoredResume.experience_atoms[atomIdx] = {
            ...tailoredResume.experience_atoms[atomIdx],
            content: rewrite.rewritten_content,
          };
          rewriteCount++;
        }
      });
      if (rewriteCount > 0) {
        changesSummary.push(`Rewrote ${rewriteCount} experience section${rewriteCount > 1 ? 's' : ''} to match ${job.company}'s language and keywords`);
      }
    } catch (err) {
      console.warn('Failed to parse resume_rewrite response, skipping bullet rewrites:', err);
    }
  }

  // Merge job keywords into skills (only ones not already present)
  const jobKeywords = (job.tech_stack || []).slice(0, 5);
  const newSkills: string[] = [];
  jobKeywords.forEach(keyword => {
    if (keyword && !tailoredResume.skills.find(s => s.name.toLowerCase() === keyword.toLowerCase())) {
      tailoredResume.skills.push({
        name: keyword,
        proficiency: 0.7,
        evidence: [`Required for ${job.company} role`],
      });
      newSkills.push(keyword);
    }
  });

  if (newSkills.length > 0) {
    changesSummary.push(`Added ${newSkills.length} skill${newSkills.length > 1 ? 's' : ''} from job requirements: ${newSkills.join(', ')}`);
  }

  // Always add a summary note about ATS tailoring
  if (job.tech_stack && job.tech_stack.length > 0) {
    changesSummary.push(`Resume is ATS-optimised for ${job.title} at ${job.company}`);
  }

  return {
    resume: tailoredResume,
    coverLetter: coverLetterData?.content || generateFallbackCoverLetter(profile, job),
    changes_summary: changesSummary,
  };
};

// Optimize resume for a specific job URL - crawl + tailor
export const optimizeResumeForJobUrl = async (
  profile: CandidateProfile,
  jobUrl: string,
  jobDescriptionText?: string
): Promise<TailoredContent> => {
  const { data: { session } } = await supabase.auth.getSession();

  // If JD text is provided directly, build a synthetic job and generate content
  if (jobDescriptionText) {
    const syntheticJob: JobOpportunity = {
      id: crypto.randomUUID(),
      title: "Target Role",
      company: "Target Company",
      location: "",
      salary_range: "",
      description: jobDescriptionText,
      source: "Direct" as const,
      freshness_score: 1,
      credibility_score: 1,
      url: jobUrl || "",
      posted_at: new Date().toISOString(),
    };
    return generateTailoredContent(profile, syntheticJob);
  }

  // Crawl the job URL to extract details
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crawl-jobs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: jobUrl })
  });

  const result = await response.json();

  if (!result.success || !result.jobs || result.jobs.length === 0) {
    throw new Error(result.error || 'Could not extract job details from URL');
  }

  const job = result.jobs[0] as JobOpportunity;
  return generateTailoredContent(profile, job);
};

// Generate LinkedIn profile optimization suggestions
export const generateLinkedInOptimization = async (
  profile: CandidateProfile,
  job: JobOpportunity
): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke('generate-content', {
    body: { profile, job, type: 'linkedin_optimization' },
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}
  });

  if (error) {
    console.error('LinkedIn optimization error:', error);
    throw new Error(error.message || 'Failed to generate LinkedIn suggestions');
  }

  return data?.content || generateFallbackLinkedInSuggestions(profile, job);
};

// Generate interview prep content
export const generateInterviewPrep = async (
  profile: CandidateProfile,
  job: JobOpportunity
): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke('generate-content', {
    body: { profile, job, type: 'interview_prep' },
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {}
  });

  if (error) {
    console.error('Interview prep error:', error);
    throw new Error(error.message || 'Failed to generate interview prep');
  }

  return data?.content || '';
};

function generateFallbackCoverLetter(profile: CandidateProfile, job: JobOpportunity): string {
  return `
Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} role. With my background in ${profile.experience_atoms[0]?.role || "software engineering"} and expertise in ${profile.skills.slice(0, 3).map(s => s.name).join(', ')}, I believe I can make an immediate impact on your team.

Key qualifications that match your requirements:
${profile.skills.slice(0, 3).map(s => `• ${s.name}: ${s.evidence?.[0] || 'Proven track record'}`).join('\n')}

In my recent role at ${profile.experience_atoms[0]?.company || 'my previous company'}, I ${profile.experience_atoms[0]?.content || 'delivered significant results'}.

I am excited about the opportunity to contribute to ${job.company} and would welcome the chance to discuss how my skills align with your team's needs.

Best regards,
${profile.identity.name}
  `.trim();
}

function generateFallbackLinkedInSuggestions(profile: CandidateProfile, job: JobOpportunity): string {
  const skills = profile.skills.slice(0, 5).map(s => s.name).join(', ');
  return `
## LinkedIn Profile Optimization Suggestions

### Headline
Update your headline to: "${profile.experience_atoms[0]?.role || 'Professional'} | ${skills}"

### About Section
- Lead with your unique value proposition
- Include keywords: ${job.tech_stack?.slice(0, 5).join(', ') || skills}
- Quantify achievements from your experience

### Experience
- Mirror the language used in ${job.company}'s job description
- Add measurable outcomes to each role
- Include relevant projects and technologies

### Skills & Endorsements
- Add: ${job.tech_stack?.slice(0, 5).join(', ') || 'relevant skills from target roles'}
- Reorder skills to match target role requirements
- Request endorsements for top skills

### Activity
- Engage with ${job.company}'s content
- Share industry-relevant articles
- Comment on posts from hiring managers
  `.trim();
}
