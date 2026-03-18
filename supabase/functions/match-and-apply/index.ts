/**
 * match-and-apply Edge Function
 *
 * Called when a recruiter publishes a job (status → 'active').
 * Scans all candidates with auto_apply_enabled = true, calculates
 * a match score, and auto-applies for those meeting the threshold.
 *
 * Payload:
 *   { recruiter_job_id: string }
 *
 * Auth: Requires valid JWT (recruiter's session).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  tech_stack: string[] | null;
  experience_level: string | null;
  visa_sponsorship: boolean;
  location_type: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  max_applicants: number | null;
}

interface CandidateRow {
  user_id: string;
  identity: Record<string, unknown> | null;
  skills: Array<{ name: string }> | null;
  experience_atoms: Array<{ title?: string; description?: string }> | null;
  education: Array<{ year?: string }> | null;
}

interface PreferencesRow {
  user_id: string;
  auto_apply_enabled: boolean;
  auto_apply_min_match_score: number;
  locations: string[] | null;
  remote_policy: string | null;
  experience_level: string | null;
  require_sponsorship: boolean | null;
  min_salary_usd: number | null;
}

/** Lightweight JS match score (mirrors matching_engine.ts logic) */
function calculateMatchScore(
  candidate: CandidateRow,
  prefs: PreferencesRow,
  job: JobRow,
): number {
  const descLower = (job.description ?? "").toLowerCase();
  const stackLower = (job.tech_stack ?? []).map((t: string) => t.toLowerCase());
  const skills = candidate.skills ?? [];

  // Skill score (0-100)
  let matches = 0;
  for (const skill of skills) {
    const n = skill.name.toLowerCase();
    if (descLower.includes(n) || stackLower.includes(n)) matches++;
  }
  const expectedSkills = Math.max(3, job.tech_stack?.length ?? 3);
  const skillScore = Math.min(100, Math.round((matches / expectedSkills) * 100));

  // Location score (0-100)
  let locationScore = 70;
  const locLower = (job.location ?? "").toLowerCase();
  const isRemoteJob = locLower.includes("remote") || job.location_type === "remote";
  const remotePolicy = prefs.remote_policy ?? "any";
  if (remotePolicy === "remote") {
    locationScore = isRemoteJob ? 100 : 20;
  } else if (isRemoteJob) {
    locationScore = 90;
  } else if ((prefs.locations ?? []).length > 0) {
    const hasMatch = (prefs.locations ?? []).some((pl: string) =>
      locLower.includes(pl.toLowerCase().trim())
    );
    locationScore = hasMatch ? 90 : 20;
  }

  // Visa gate: if candidate requires sponsorship but job doesn't offer it → 0
  if (prefs.require_sponsorship && !job.visa_sponsorship) return 0;

  // Salary gate: if job max < candidate min → 0
  if (prefs.min_salary_usd && job.salary_max && job.salary_max < prefs.min_salary_usd) return 0;

  // Culture score (static 70 base)
  const cultureScore = 70;

  // Weighted overall (mirrors frontend engine weights)
  const overall =
    skillScore * 0.40 +
    locationScore * 0.25 +
    70 * 0.15 + // experience (simplified)
    cultureScore * 0.10 +
    1.0 * 100 * 0.10; // freshness = 1.0 (always new)

  return Math.min(100, Math.round(overall));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Service role client for reading across users
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // User client to verify the calling user is a recruiter
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { recruiter_job_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { recruiter_job_id } = body;
  if (!recruiter_job_id) {
    return new Response(JSON.stringify({ error: "recruiter_job_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Load the recruiter job (verify ownership)
  const { data: jobData, error: jobErr } = await adminClient
    .from("recruiter_jobs")
    .select("*")
    .eq("id", recruiter_job_id)
    .eq("recruiter_id", user.id)
    .maybeSingle();

  if (jobErr || !jobData) {
    return new Response(JSON.stringify({ error: "Job not found or not owned by you" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const job = jobData as unknown as JobRow;

  // 2. Load all candidates with auto_apply_enabled = true
  const { data: prefsData, error: prefsErr } = await adminClient
    .from("user_preferences")
    .select("user_id, auto_apply_enabled, auto_apply_min_match_score, locations, remote_policy, experience_level, require_sponsorship, min_salary_usd")
    .eq("auto_apply_enabled", true);

  if (prefsErr) {
    console.error("Error fetching preferences:", prefsErr.message);
    return new Response(JSON.stringify({ error: "Failed to fetch candidates" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prefs = (prefsData ?? []) as unknown as PreferencesRow[];
  if (prefs.length === 0) {
    return new Response(JSON.stringify({ matched: 0, auto_applied: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Load candidate profiles for those users
  const userIds = prefs.map((p) => p.user_id);
  const { data: candidatesData } = await adminClient
    .from("candidate_profiles")
    .select("user_id, identity, skills, experience_atoms, education")
    .in("user_id", userIds);

  const candidates = (candidatesData ?? []) as unknown as CandidateRow[];
  const candidateMap = new Map(candidates.map((c) => [c.user_id, c]));

  // 4. Check existing applications to avoid duplicates
  const { data: existingApps } = await adminClient
    .from("recruiter_job_applications")
    .select("candidate_id")
    .eq("recruiter_job_id", recruiter_job_id);

  const alreadyApplied = new Set((existingApps ?? []).map((a: Record<string, string>) => a.candidate_id));

  // 5. Score all eligible candidates (above threshold), collect into array
  const eligible: Array<{ pref: PreferencesRow; candidate: CandidateRow; score: number }> = [];

  for (const pref of prefs) {
    if (alreadyApplied.has(pref.user_id)) continue;
    if (pref.user_id === user.id) continue; // don't apply recruiter to their own job

    const candidate = candidateMap.get(pref.user_id);
    if (!candidate) continue;

    const score = calculateMatchScore(candidate, pref, job);
    const threshold = pref.auto_apply_min_match_score ?? 80;

    if (score >= threshold) {
      eligible.push({ pref, candidate, score });
    }
  }

  const matched = eligible.length;

  // Sort by score DESC so the best candidates are inserted first
  eligible.sort((a, b) => b.score - a.score);

  // Apply the recruiter's applicant cap
  let slotsRemaining: number | null = null;
  if (job.max_applicants !== null && job.max_applicants !== undefined) {
    const existingCount = alreadyApplied.size;
    slotsRemaining = Math.max(0, job.max_applicants - existingCount);
  }

  const toInsert = slotsRemaining !== null ? eligible.slice(0, slotsRemaining) : eligible;

  // 6. Insert applications for top-scored candidates
  let autoApplied = 0;

  for (const { pref, candidate, score } of toInsert) {
    try {
      // Create application_history entry for candidate's tracker
      const { data: histRow } = await adminClient
        .from("application_history")
        .insert({
          user_id: pref.user_id,
          job_title: job.title,
          company: job.company,
          job_url: `https://usehunter.app/jobs/${recruiter_job_id}`,
          status: "applied",
          metadata: {
            source: "Auto-Applied",
            recruiter_job_id,
            match_score: score,
          },
        })
        .select("id")
        .maybeSingle();

      // Create recruiter pipeline entry
      await adminClient.from("recruiter_job_applications").insert({
        recruiter_job_id,
        candidate_id: pref.user_id,
        application_history_id: (histRow as unknown as { id: string } | null)?.id ?? null,
        match_score: score,
        resume_snapshot: candidate as unknown as Record<string, unknown>,
        is_auto_applied: true,
        status: "applied",
      });

      autoApplied++;
    } catch (insertErr) {
      // Silently skip duplicates or RLS errors
      console.warn("Auto-apply insert failed for user", pref.user_id, insertErr);
    }
  }

  return new Response(
    JSON.stringify({ matched, auto_applied: autoApplied, capped: slotsRemaining !== null }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
