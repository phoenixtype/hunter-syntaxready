import { JobOpportunity } from "./crawler_engine";
import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────

export type LocationType = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship" | "freelance";
export type JobStatus = "draft" | "active" | "paused" | "closed" | "filled";
export type ExperienceLevel = "entry" | "junior" | "mid" | "senior" | "lead" | "principal" | "executive";
export type RecruiterApplicationStatus = "applied" | "screening" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn";
export type CompanySize = "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1001-5000" | "5000+";

export interface RecruiterProfile {
  id: string;
  user_id: string;
  company_name: string;
  company_website?: string;
  company_logo_url?: string;
  company_size?: CompanySize;
  industry?: string;
  headquarters?: string;
  about?: string;
  linkedin_url?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecruiterJob {
  id: string;
  recruiter_id: string;
  job_listing_id?: string;
  title: string;
  company: string;
  location?: string;
  location_type: LocationType;
  employment_type: EmploymentType;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  tech_stack?: string[];
  experience_level?: ExperienceLevel;
  visa_sponsorship: boolean;
  status: JobStatus;
  application_deadline?: string;
  application_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export type RecruiterJobInsert = Omit<RecruiterJob,
  "id" | "recruiter_id" | "job_listing_id" | "application_count" | "view_count" | "created_at" | "updated_at"
>;

export interface RecruiterApplication {
  id: string;
  recruiter_job_id: string;
  candidate_id: string;
  application_history_id?: string;
  match_score?: number;
  cover_letter?: string;
  resume_snapshot?: Record<string, unknown>;
  status: RecruiterApplicationStatus;
  recruiter_notes?: string;
  is_auto_applied: boolean;
  applied_at: string;
  updated_at: string;
  // Joined from candidate data
  candidate_name?: string;
  candidate_email?: string;
  candidate_location?: string;
  candidate_skills?: string[];
  candidate_experience_years?: number;
}

export interface RecruiterStats {
  active_jobs: number;
  total_applications: number;
  total_interviews: number;
  total_offers: number;
}

// ── Recruiter Profile ─────────────────────────────────────────────────────────

export const getRecruiterProfile = async (userId: string): Promise<RecruiterProfile | null> => {
  const { data, error } = await supabase
    .from("recruiter_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) { console.error("getRecruiterProfile:", error.message); return null; }
  return data as unknown as RecruiterProfile | null;
};

export const upsertRecruiterProfile = async (
  userId: string,
  profile: Partial<Omit<RecruiterProfile, "id" | "user_id" | "is_verified" | "created_at" | "updated_at">>
): Promise<RecruiterProfile> => {
  const { data, error } = await supabase
    .from("recruiter_profiles")
    .upsert({ user_id: userId, ...profile }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as RecruiterProfile;
};

// ── User Role ─────────────────────────────────────────────────────────────────

export type UserRole = "candidate" | "recruiter" | "admin";

export const getUserRole = async (userId: string): Promise<UserRole> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return "candidate";
  return ((data as unknown as { role: string }).role as UserRole) || "candidate";
};

export const setUserRole = async (userId: string, role: UserRole): Promise<void> => {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
};

// ── Recruiter Jobs ────────────────────────────────────────────────────────────

export const getMyJobs = async (recruiterId: string): Promise<RecruiterJob[]> => {
  const { data, error } = await supabase
    .from("recruiter_jobs")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false });

  if (error) { console.error("getMyJobs:", error.message); return []; }
  return (data || []) as unknown as RecruiterJob[];
};

export const getRecruiterJobById = async (jobId: string): Promise<RecruiterJob | null> => {
  const { data, error } = await supabase
    .from("recruiter_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) { console.error("getRecruiterJobById:", error.message); return null; }
  return data as unknown as RecruiterJob | null;
};

export const createJob = async (
  recruiterId: string,
  job: RecruiterJobInsert
): Promise<RecruiterJob> => {
  const { data, error } = await supabase
    .from("recruiter_jobs")
    .insert({ ...job, recruiter_id: recruiterId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  const created = data as unknown as RecruiterJob;

  if (job.status === "active") {
    await _mirrorToJobListings(created);
  }

  return created;
};

export const updateJob = async (
  jobId: string,
  updates: Partial<RecruiterJobInsert>
): Promise<RecruiterJob> => {
  const { data, error } = await supabase
    .from("recruiter_jobs")
    .update(updates)
    .eq("id", jobId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  const updated = data as unknown as RecruiterJob;

  if (updates.status === "active") {
    await _mirrorToJobListings(updated);
  } else if (updates.status === "paused" || updates.status === "closed" || updates.status === "filled") {
    if (updated.job_listing_id) {
      await supabase.from("job_listings").delete().eq("id", updated.job_listing_id);
      await supabase.from("recruiter_jobs").update({ job_listing_id: null }).eq("id", jobId);
    }
  }

  return updated;
};

export const deleteJob = async (jobId: string): Promise<void> => {
  const job = await getRecruiterJobById(jobId);
  if (job?.job_listing_id) {
    await supabase.from("job_listings").delete().eq("id", job.job_listing_id);
  }
  const { error } = await supabase.from("recruiter_jobs").delete().eq("id", jobId);
  if (error) throw new Error(error.message);
};

const _mirrorToJobListings = async (job: RecruiterJob): Promise<string | null> => {
  const salaryRange =
    job.salary_min && job.salary_max
      ? `$${(job.salary_min / 1000).toFixed(0)}k – $${(job.salary_max / 1000).toFixed(0)}k ${job.salary_currency}`
      : undefined;

  const fullDescription = [
    job.description,
    job.responsibilities ? `\n\n**Responsibilities:**\n${job.responsibilities}` : "",
    job.requirements ? `\n\n**Requirements:**\n${job.requirements}` : "",
    job.benefits ? `\n\n**Benefits:**\n${job.benefits}` : "",
  ].join("");

  const payload = {
    title: job.title,
    company: job.company,
    location: job.location ?? (job.location_type === "remote" ? "Remote" : ""),
    salary_range: salaryRange,
    description: fullDescription,
    source: "Direct",
    url: `https://usehunter.app/jobs/${job.id}`,
    posted_at: "Just now",
    tech_stack: job.tech_stack ?? [],
    job_hash: `direct_${job.id}`,
    freshness_score: 1.0,
    credibility_score: 1.0,
    raw_data: {
      recruiter_job_id: job.id,
      employment_type: job.employment_type,
      visa_sponsorship: job.visa_sponsorship,
    },
  };

  const { data, error } = await supabase
    .from("job_listings")
    .upsert(payload, { onConflict: "job_hash" })
    .select("id")
    .single();

  if (error) { console.error("_mirrorToJobListings:", error.message); return null; }

  await supabase.from("recruiter_jobs").update({ job_listing_id: (data as unknown as { id: string }).id }).eq("id", job.id);
  return (data as unknown as { id: string }).id;
};

// ── Applications ──────────────────────────────────────────────────────────────

export const getJobApplicants = async (recruiterJobId: string): Promise<RecruiterApplication[]> => {
  const { data, error } = await supabase
    .from("recruiter_job_applications")
    .select("*")
    .eq("recruiter_job_id", recruiterJobId)
    .order("applied_at", { ascending: false });

  if (error) { console.error("getJobApplicants:", error.message); return []; }
  return (data || []) as unknown as RecruiterApplication[];
};

export const updateRecruiterApplicationStatus = async (
  applicationId: string,
  status: RecruiterApplicationStatus,
  recruiterNotes?: string
): Promise<void> => {
  const updates: Record<string, unknown> = { status };
  if (recruiterNotes !== undefined) updates.recruiter_notes = recruiterNotes;
  const { error } = await supabase
    .from("recruiter_job_applications")
    .update(updates)
    .eq("id", applicationId);
  if (error) throw new Error(error.message);
};

export const applyToRecruiterJob = async (opts: {
  recruiterJobId: string;
  candidateId: string;
  matchScore?: number;
  coverLetter?: string;
  resumeSnapshot?: Record<string, unknown>;
}): Promise<void> => {
  const job = await getRecruiterJobById(opts.recruiterJobId);

  const { data: histRow } = await supabase
    .from("application_history")
    .insert({
      user_id: opts.candidateId,
      job_title: job?.title ?? "Position",
      company: job?.company ?? "Company",
      job_url: `https://usehunter.app/jobs/${opts.recruiterJobId}`,
      status: "applied",
      metadata: { source: "Direct", recruiter_job_id: opts.recruiterJobId },
    })
    .select("id")
    .maybeSingle();

  await supabase.from("recruiter_job_applications").insert({
    recruiter_job_id: opts.recruiterJobId,
    candidate_id: opts.candidateId,
    application_history_id: (histRow as unknown as { id: string } | null)?.id ?? null,
    match_score: opts.matchScore ?? null,
    cover_letter: opts.coverLetter ?? null,
    resume_snapshot: opts.resumeSnapshot ?? null,
    is_auto_applied: false,
  });
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getRecruiterStats = async (recruiterId: string): Promise<RecruiterStats> => {
  const { data: jobs } = await supabase
    .from("recruiter_jobs")
    .select("id, status, application_count")
    .eq("recruiter_id", recruiterId);

  const activeJobs = (jobs || []).filter((j) => (j as unknown as { status: string }).status === "active").length;
  const totalApplications = (jobs || []).reduce((s, j) => s + ((j as unknown as { application_count: number }).application_count || 0), 0);

  const jobIds = (jobs || []).map((j) => (j as unknown as { id: string }).id);
  let totalInterviews = 0;
  let totalOffers = 0;

  if (jobIds.length > 0) {
    const { data: apps } = await supabase
      .from("recruiter_job_applications")
      .select("status")
      .in("recruiter_job_id", jobIds);

    (apps || []).forEach((a) => {
      const s = (a as unknown as { status: string }).status;
      if (s === "interview") totalInterviews++;
      if (s === "offer" || s === "accepted") totalOffers++;
    });
  }

  return { active_jobs: activeJobs, total_applications: totalApplications, total_interviews: totalInterviews, total_offers: totalOffers };
};

// ── Labels / display helpers ──────────────────────────────────────────────────

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  freelance: "Freelance",
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
  filled: "Filled",
};

export const APPLICATION_STATUS_LABELS: Record<RecruiterApplicationStatus, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const APPLICATION_STATUS_COLORS: Record<RecruiterApplicationStatus, string> = {
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  screening: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  interview: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  offer: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  withdrawn: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export const formatSalary = (job: RecruiterJob): string => {
  if (!job.salary_min && !job.salary_max) return "Not specified";
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)} – ${fmt(job.salary_max)} ${job.salary_currency}`;
  if (job.salary_min) return `From ${fmt(job.salary_min)} ${job.salary_currency}`;
  return `Up to ${fmt(job.salary_max!)} ${job.salary_currency}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Legacy stakeholder lookup (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export interface Stakeholder {
  name: string;
  role: string;
  connection_degree: '1st' | '2nd' | '3rd' | 'Out of Network';
  avatar_url?: string;
  profile_url: string;
}

/**
 * Find stakeholders for a job by searching for relevant people at the company.
 * Uses Firecrawl search via the crawl-jobs edge function to find real LinkedIn profiles.
 * Falls back to LinkedIn search links if the search fails.
 */
export const findStakeholders = async (job: JobOpportunity): Promise<Stakeholder[]> => {
  const encodedCompany = encodeURIComponent(job.company);
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Use Firecrawl search to find real people at the company
    const { data, error } = await supabase.functions.invoke('crawl-jobs', {
      body: {
        mode: 'stakeholder_search',
        company: job.company,
        title: job.title,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!error && data?.stakeholders && data.stakeholders.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.stakeholders as any[]).map((s) => ({
        name: s.name || 'Unknown',
        role: s.role || s.title || 'Employee',
        connection_degree: 'Out of Network' as const,
        profile_url: s.profile_url || s.url || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(s.name + ' ' + job.company)}`,
        avatar_url: s.avatar_url || '',
      }));
    }
  } catch (err) {
    console.warn('[STAKEHOLDERS] AI search failed, falling back to LinkedIn links:', err);
  }

  // Fallback: provide useful LinkedIn search links
  return [
    {
      name: "Find Recruiters",
      role: `Recruiters at ${job.company}`,
      connection_degree: "Out of Network",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=Recruiter+at+${encodedCompany}`,
      avatar_url: ""
    },
    {
      name: "Find Hiring Managers",
      role: `Engineering Managers at ${job.company}`,
      connection_degree: "Out of Network",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=Engineering+Manager+at+${encodedCompany}`,
      avatar_url: ""
    },
    {
      name: "Connect with Employees",
      role: `People at ${job.company}`,
      connection_degree: "Out of Network",
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=${encodedCompany}&network=%5B%22F%22%2C%22S%22%5D`,
      avatar_url: ""
    }
  ];
};
