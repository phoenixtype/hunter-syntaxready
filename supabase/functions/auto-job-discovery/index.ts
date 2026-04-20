import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders, jsonWithCors } from '../_shared/cors.ts';

/**
 * Auto Job Discovery Service
 *
 * Automatically crawls for jobs based on user profiles and preferences.
 * Runs periodically to keep the job feed fresh without user intervention.
 */

const BATCH_SIZE = 5; // Process a few users at a time to avoid overload

interface UserProfile {
  id: string;
  user_id: string;
  target_roles: string[];
  locations: string[];
  remote_policy: string;
  skills: Array<{ name: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonWithCors({ success: false, error: 'Service configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get users who need fresh job matches (haven't been updated in last 6 hours)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    // Pull users from profiles (for last_job_sync) and join with user_preferences/candidate_profiles
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('id, last_job_sync')
      .or(`last_job_sync.is.null,last_job_sync.lt.${sixHoursAgo}`)
      .limit(BATCH_SIZE * 4); // over-select; we filter by target_roles below

    if (profilesError) {
      console.error('[AUTO_DISCOVERY] Error fetching profiles:', profilesError);
      return jsonWithCors({ success: false, error: 'Failed to fetch user profiles' });
    }

    if (!profileRows || profileRows.length === 0) {
      console.log('[AUTO_DISCOVERY] No profiles need job updates');
      return jsonWithCors({ success: true, message: 'No profiles need updates', processed: 0 });
    }

    const userIds = profileRows.map((p: { id: string }) => p.id);

    const [{ data: prefs }, { data: candidateProfiles }] = await Promise.all([
      supabase
        .from('user_preferences')
        .select('user_id, target_roles, locations, remote_policy')
        .in('user_id', userIds)
        .not('target_roles', 'is', null),
      supabase
        .from('candidate_profiles')
        .select('user_id, skills')
        .in('user_id', userIds),
    ]);

    const skillsByUser = new Map<string, Array<{ name: string }>>(
      (candidateProfiles || []).map((c: { user_id: string; skills: unknown }) => [
        c.user_id,
        Array.isArray(c.skills) ? (c.skills as Array<{ name: string }>) : [],
      ])
    );

    const profiles = (prefs || [])
      .filter((p: { target_roles: string[] | null }) => Array.isArray(p.target_roles) && p.target_roles.length > 0)
      .slice(0, BATCH_SIZE)
      .map((p: { user_id: string; target_roles: string[] | null; locations: string[] | null; remote_policy: string | null }) => ({
        user_id: p.user_id,
        target_roles: p.target_roles || [],
        locations: p.locations || [],
        remote_policy: p.remote_policy || 'flexible',
        skills: skillsByUser.get(p.user_id) || [],
      }));

    if (profiles.length === 0) {
      console.log('[AUTO_DISCOVERY] No profiles with target_roles need updates');
      return jsonWithCors({ success: true, message: 'No eligible profiles', processed: 0 });
    }

    console.log(`[AUTO_DISCOVERY] Processing ${profiles.length} profiles`);

    let totalJobsFound = 0;
    let processedUsers = 0;

    for (const profile of profiles) {
      try {
        // Extract keywords from profile
        const keywords = profile.skills?.slice(0, 5)?.map((s: { name: string }) => s.name) || [];
        const targetRoles = profile.target_roles || [];
        const locations = profile.locations || [];

        if (targetRoles.length === 0) continue;

        // Call the crawl-jobs function for this user
        const { data: crawlResult, error: crawlError } = await supabase.functions.invoke('crawl-jobs', {
          body: {
            keywords,
            targetRoles,
            locations,
            remotePolicy: profile.remote_policy
          }
        });

        if (crawlError) {
          console.error(`[AUTO_DISCOVERY] Crawl failed for user ${profile.user_id}:`, crawlError);
          continue;
        }

        if (crawlResult?.success) {
          totalJobsFound += crawlResult.inserted || 0;
          console.log(`[AUTO_DISCOVERY] Found ${crawlResult.inserted} new jobs for user ${profile.user_id}`);

          // Update the last sync time
          await supabase
            .from('profiles')
            .update({ last_job_sync: new Date().toISOString() })
            .eq('id', profile.user_id);

          processedUsers++;
        }

        // Small delay between users to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`[AUTO_DISCOVERY] Error processing user ${profile.user_id}:`, error);
      }
    }

    console.log(`[AUTO_DISCOVERY] Complete: ${processedUsers} users processed, ${totalJobsFound} total jobs found`);

    return jsonWithCors({
      success: true,
      processed: processedUsers,
      totalJobsFound,
      message: `Auto-discovery complete: ${processedUsers} users processed`
    });

  } catch (error) {
    console.error('[AUTO_DISCOVERY] Unhandled error:', error);
    return jsonWithCors({
      success: false,
      error: 'Auto job discovery service error',
      debug: error instanceof Error ? error.message : String(error)
    });
  }
});