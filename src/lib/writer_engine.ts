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

  const { data: coverLetterData, error: coverLetterError } = await supabase.functions.invoke('generate-content', {
    body: { profile, job, type: 'cover_letter' },
    headers: authHeader
  });

  if (coverLetterError) {
    console.error('Cover letter generation error:', coverLetterError);
    throw new Error(coverLetterError.message || 'Failed to generate cover letter');
  }

  const { data: optimizationData, error: optimizationError } = await supabase.functions.invoke('generate-content', {
    body: { profile, job, type: 'resume_optimization' },
    headers: authHeader
  });

  if (optimizationError) {
    console.error('Resume optimization error:', optimizationError);
  }

  const changesReceived: string[] = [];
  if (optimizationData?.content) {
    const suggestions = optimizationData.content.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => /^[-•*\d+\.\)]/.test(line) && line.length > 10)
      .slice(0, 5)
      .map((line: string) => line.replace(/^[-•*\d+\.\)]+\s*/, '').trim())
      .filter((line: string) => line.length > 0);
    changesReceived.push(...suggestions);
  }

  const tailoredResume = JSON.parse(JSON.stringify(profile)) as CandidateProfile;
  const jobKeywords = (job.tech_stack || []).slice(0, 5);

  jobKeywords.forEach(keyword => {
    if (keyword && !tailoredResume.skills.find(s =>
      s.name.toLowerCase() === keyword.toLowerCase()
    )) {
      tailoredResume.skills.push({
        name: keyword,
        proficiency: 0.7,
        evidence: [`Inferred from ${job.company} requirements`]
      });
    }
  });

  return {
    resume: tailoredResume,
    coverLetter: coverLetterData?.content || generateFallbackCoverLetter(profile, job),
    changes_summary: changesReceived
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
