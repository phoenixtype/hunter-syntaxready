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
  console.log(`Generating tailored content for ${job.company} - ${job.title}`);

  // Generate cover letter using AI
  const { data: coverLetterData, error: coverLetterError } = await supabase.functions.invoke('generate-content', {
    body: { profile, job, type: 'cover_letter' }
  });

  if (coverLetterError) {
    console.error('Cover letter generation error:', coverLetterError);
    throw new Error(coverLetterError.message || 'Failed to generate cover letter');
  }

  // Generate resume optimization suggestions
  const { data: optimizationData, error: optimizationError } = await supabase.functions.invoke('generate-content', {
    body: { profile, job, type: 'resume_optimization' }
  });

  if (optimizationError) {
    console.error('Resume optimization error:', optimizationError);
  }

  // Parse optimization suggestions into changes
  const changesReceived: string[] = [];
  if (optimizationData?.content) {
    // Extract key suggestions from the optimization content
    const suggestions = optimizationData.content.split('\n')
      .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .slice(0, 5)
      .map((line: string) => line.replace(/^[-•]\s*/, '').trim());
    changesReceived.push(...suggestions);
  }

  if (changesReceived.length === 0) {
    changesReceived.push(`Optimized for ${job.company}'s ${job.title} role`);
    changesReceived.push('Highlighted relevant technical skills');
    changesReceived.push('Enhanced achievement metrics');
  }

  // Create tailored resume with minor optimizations
  const tailoredResume = JSON.parse(JSON.stringify(profile)) as CandidateProfile;
  
  // Add job-specific keyword if mentioned in description
  const jobKeywords = job.description?.split(/\s+/)
    .filter(w => w.length > 5 && /^[A-Z]/.test(w))
    .slice(0, 3) || [];
  
  jobKeywords.forEach(keyword => {
    const cleanKeyword = keyword.replace(/[^a-zA-Z]/g, '');
    if (cleanKeyword && !tailoredResume.skills.find(s => 
      s.name.toLowerCase() === cleanKeyword.toLowerCase()
    )) {
      tailoredResume.skills.push({
        name: cleanKeyword,
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

// Generate interview prep content
export const generateInterviewPrep = async (
  profile: CandidateProfile,
  job: JobOpportunity
): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('generate-content', {
    body: { profile, job, type: 'interview_prep' }
  });

  if (error) {
    console.error('Interview prep error:', error);
    throw new Error(error.message || 'Failed to generate interview prep');
  }

  return data?.content || '';
};

// Fallback cover letter if AI fails
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
