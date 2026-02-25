import { supabase } from "@/integrations/supabase/client";
import { CandidateProfile } from "./resume_engine";
import { TailoredContent } from "./writer_engine";
import { Json } from "@/integrations/supabase/types";
import { JobOpportunity } from "./crawler_engine";

/**
 * Save a tailored resume + cover letter to the database for later retrieval.
 */
export const saveTailoredResume = async (
  content: TailoredContent,
  job: { title: string; company: string; url?: string }
): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;

  const { error } = await supabase.from("tailored_resumes").insert([{
    user_id: session.user.id,
    job_title: job.title,
    company: job.company,
    job_url: job.url || null,
    cover_letter: content.coverLetter,
    changes_summary: content.changes_summary,
    tailored_profile: JSON.parse(JSON.stringify(content.resume)) as Json,
  }]);

  if (error) {
    console.error("Failed to save tailored resume:", error);
    return false;
  }
  return true;
};
