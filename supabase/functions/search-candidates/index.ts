import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-connection-pool-size',
};

interface ExperienceAtom {
  company: string;
  title: string;
  start: string;
  end: string;
  bullets?: string[];
}

interface EducationItem {
  school?: string;
  institution?: string;
  degree?: string;
  field?: string;
  year?: string;
  end?: string;
}

interface IdentityLink {
  type: string;
  url?: string;
  value?: string;
}

interface Identity {
  name: string;
  email: string;
  links: IdentityLink[];
}

// Compute total years of experience from experience_atoms
function computeExperienceYears(atoms: ExperienceAtom[]): number {
  if (!atoms?.length) return 0;
  let totalMonths = 0;
  const now = new Date();

  for (const atom of atoms) {
    try {
      const parseDate = (s: string): Date => {
        if (!s || /present|current|now/i.test(s)) return now;
        // "Jan 2020", "January 2020", "2020-01", "2020"
        const d = new Date(s);
        return isNaN(d.getTime()) ? now : d;
      };
      const start = parseDate(atom.start);
      const end = parseDate(atom.end);
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      if (months > 0) totalMonths += months;
    } catch { /* skip malformed entry */ }
  }

  return Math.max(0, Math.round(totalMonths / 12));
}

// Compute match score (0-100) between candidate skills and job tech stack
function computeMatchScore(skills: string[], techStack: string[]): number {
  if (!techStack?.length || !skills?.length) return 0;
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidateSet = new Set(skills.map(normalise));
  const matches = techStack.filter(t => candidateSet.has(normalise(t))).length;
  return Math.round((matches / techStack.length) * 100);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the calling user is a recruiter
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await authClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = (profile as { role: string } | null)?.role;
    if (role !== 'recruiter' && role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Recruiter access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const {
      skills: skillFilter = [],
      remotePolicy,
      jobId,
      limit = 50,
      offset = 0,
    } = body as {
      skills?: string[];
      remotePolicy?: string;
      jobId?: string;
      limit?: number;
      offset?: number;
    };

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find candidates who opted in
    const { data: rawPrefs } = await admin
      .from('user_preferences')
      .select('user_id, target_roles, min_salary_usd, locations, remote_policy')
      .eq('auto_apply_enabled', true);

    const prefs = (rawPrefs ?? []) as Array<{
      user_id: string;
      target_roles: string[];
      min_salary_usd: number;
      locations: string[];
      remote_policy: string;
    }>;

    if (!prefs.length) {
      return new Response(JSON.stringify({ candidates: [], total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apply remote policy filter early to reduce data fetched
    const filteredPrefs = remotePolicy
      ? prefs.filter(p => p.remote_policy === remotePolicy || p.remote_policy === 'any' || remotePolicy === 'any')
      : prefs;

    const userIds = filteredPrefs.map(p => p.user_id);
    const prefsByUserId = Object.fromEntries(filteredPrefs.map(p => [p.user_id, p]));

    // 2. Get their candidate profiles (has skills + experience)
    const { data: rawCandidateProfiles } = await admin
      .from('candidate_profiles')
      .select('user_id, identity, skills, experience_atoms, education')
      .in('user_id', userIds);

    const candidateProfiles = (rawCandidateProfiles ?? []) as Array<{
      user_id: string;
      identity: Identity;
      skills: string[] | Record<string, unknown>[];
      experience_atoms: ExperienceAtom[];
      education: EducationItem[];
    }>;

    // 3. Get their display profiles (name, avatar)
    const { data: rawProfiles } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', userIds)
      .eq('role', 'candidate');

    const displayProfiles = (rawProfiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      avatar_url: string | null;
      role: string;
    }>;

    const profilesByUserId = Object.fromEntries(displayProfiles.map(p => [p.id, p]));

    // 4. Optionally get job's tech_stack for match scoring
    let jobTechStack: string[] = [];
    if (jobId) {
      const { data: job } = await admin
        .from('recruiter_jobs')
        .select('tech_stack, title, description')
        .eq('id', jobId)
        .maybeSingle();
      if (job) {
        const j = job as { tech_stack: string[] | null; title: string; description: string };
        jobTechStack = j.tech_stack ?? [];
      }
    }

    // 5. Merge, filter, and shape results
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const candidates = candidateProfiles
      .filter(cp => profilesByUserId[cp.user_id]) // must have a display profile
      .map(cp => {
        const displayProfile = profilesByUserId[cp.user_id];
        const prefs = prefsByUserId[cp.user_id];

        // Normalise skills (could be string[] or object[])
        const skills: string[] = Array.isArray(cp.skills)
          ? cp.skills.map((s: unknown) => typeof s === 'string' ? s : (s as Record<string, unknown>)?.name as string ?? '').filter(Boolean)
          : [];

        const identity: Identity = cp.identity ?? { name: '', email: '', links: [] };
        const name = displayProfile.full_name || identity.name || 'Candidate';
        const atoms = cp.experience_atoms ?? [];
        const mostRecentAtom = atoms[0];
        const headline = mostRecentAtom
          ? `${mostRecentAtom.title} at ${mostRecentAtom.company}`
          : (prefs?.target_roles?.[0] ?? null);

        const experienceYears = computeExperienceYears(atoms);
        const matchScore = jobTechStack.length ? computeMatchScore(skills, jobTechStack) : undefined;

        return {
          user_id: cp.user_id,
          full_name: name,
          avatar_url: displayProfile.avatar_url,
          headline,
          experience_years: experienceYears,
          skills,
          experience_atoms: atoms.slice(0, 10), // cap for payload size
          education: cp.education ?? [],
          links: identity.links ?? [],
          target_roles: prefs?.target_roles ?? [],
          min_salary_usd: prefs?.min_salary_usd ?? 0,
          locations: prefs?.locations ?? [],
          remote_policy: prefs?.remote_policy ?? 'any',
          match_score: matchScore,
        };
      })
      .filter(c => {
        // Apply skill filter
        if (!skillFilter.length) return true;
        const cSkills = new Set(c.skills.map(normalise));
        return skillFilter.some((f: string) => cSkills.has(normalise(f)));
      })
      .sort((a, b) => {
        // Sort by match score desc, then experience desc
        if (a.match_score !== undefined && b.match_score !== undefined) {
          return b.match_score - a.match_score;
        }
        return b.experience_years - a.experience_years;
      });

    const total = candidates.length;
    const page = candidates.slice(offset, offset + limit);

    return new Response(JSON.stringify({ candidates: page, total }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[SEARCH-CANDIDATES] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
