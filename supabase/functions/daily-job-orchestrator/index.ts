/**
 * Daily Job Discovery Orchestrator
 *
 * Coordinates automated daily job discovery across 4 waves:
 * - 6am UTC (Morning wave)
 * - 12pm UTC (Midday wave)
 * - 6pm UTC (Evening wave)
 * - 12am UTC (Midnight wave)
 *
 * Prioritizes Pro users in first 2 hours of each wave (75% of capacity).
 * Integrates source prioritization, deduplication, and profile matching.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  crawl_priority: number;
  pro_user: boolean;
  last_crawl_wave: string | null;
  target_roles?: string[];
  skills?: string[];
  industries?: string[];
  preferred_locations?: string[];
  experience_level?: string;
}

interface CrawlTarget {
  company: string;
  users: string[];
  priority: number;
  estimatedJobs: number;
}

interface WaveResult {
  waveId: string;
  waveType: string;
  startTime: string;
  endTime: string;
  usersProcessed: number;
  jobsDiscovered: number;
  proUsersProcessed: number;
  freeUsersProcessed: number;
  errors: string[];
  stats: {
    companiesCrawled: number;
    duplicatesFiltered: number;
    matchesGenerated: number;
    digestsQueued: number;
  };
}

serve(async (req) => {
  console.log(`[ORCHESTRATOR] ${req.method} request received`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check
  if (req.method === 'GET' && new URL(req.url).pathname.includes('/health')) {
    return new Response(
      JSON.stringify({ status: 'healthy', service: 'daily-job-orchestrator' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { mode = 'scheduled_wave', waveType = 'morning', maxUsers = 1000, testMode = false } = body;

    if (mode === 'scheduled_wave') {
      const result = await executeScheduledWave(supabase, waveType, maxUsers, testMode);
      return new Response(
        JSON.stringify({ success: true, result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'manual_trigger') {
      const { userIds, companies } = body;
      const result = await executeManualCrawl(supabase, userIds, companies);
      return new Response(
        JSON.stringify({ success: true, result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'cleanup') {
      const result = await performCleanup(supabase);
      return new Response(
        JSON.stringify({ success: true, result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid mode specified' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ORCHESTRATOR] Unhandled error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Execute a scheduled daily wave
 */
async function executeScheduledWave(
  supabase: any,
  waveType: string,
  maxUsers: number,
  testMode: boolean
): Promise<WaveResult> {
  const startTime = new Date().toISOString();
  console.log(`[WAVE] Starting ${waveType} wave at ${startTime}`);

  // Create wave record
  const { data: wave, error: waveError } = await supabase
    .from('daily_crawl_waves')
    .insert({
      wave_time: startTime,
      wave_type: waveType,
      status: 'running',
      started_at: startTime
    })
    .select()
    .single();

  if (waveError || !wave) {
    throw new Error(`Failed to create wave record: ${waveError?.message}`);
  }

  const waveId = wave.id;
  const result: WaveResult = {
    waveId,
    waveType,
    startTime,
    endTime: '',
    usersProcessed: 0,
    jobsDiscovered: 0,
    proUsersProcessed: 0,
    freeUsersProcessed: 0,
    errors: [],
    stats: {
      companiesCrawled: 0,
      duplicatesFiltered: 0,
      matchesGenerated: 0,
      digestsQueued: 0
    }
  };

  try {
    // Get eligible users for this wave
    const users = await getEligibleUsers(supabase, maxUsers, testMode);
    console.log(`[WAVE] Found ${users.length} eligible users`);

    if (users.length === 0) {
      await updateWaveStatus(supabase, waveId, 'completed', result);
      return result;
    }

    // Split into Pro and Free users
    const proUsers = users.filter(u => u.pro_user || u.crawl_priority >= 2);
    const freeUsers = users.filter(u => !u.pro_user && u.crawl_priority < 2);

    console.log(`[WAVE] Pro users: ${proUsers.length}, Free users: ${freeUsers.length}`);

    // Phase 1: Process Pro users first (first 2 hours of wave)
    if (proUsers.length > 0) {
      console.log('[WAVE] Phase 1: Processing Pro users');
      const proResult = await processUserBatch(supabase, waveId, proUsers, 'pro', testMode);

      result.proUsersProcessed = proResult.usersProcessed;
      result.jobsDiscovered += proResult.jobsDiscovered;
      result.stats.companiesCrawled += proResult.companiesCrawled;
      result.stats.duplicatesFiltered += proResult.duplicatesFiltered;
      result.stats.matchesGenerated += proResult.matchesGenerated;
      result.stats.digestsQueued += proResult.digestsQueued;
      result.errors.push(...proResult.errors);
    }

    // Phase 2: Process Free users (remaining time)
    if (freeUsers.length > 0 && !testMode) {
      console.log('[WAVE] Phase 2: Processing Free users');
      const freeResult = await processUserBatch(supabase, waveId, freeUsers, 'free', testMode);

      result.freeUsersProcessed = freeResult.usersProcessed;
      result.jobsDiscovered += freeResult.jobsDiscovered;
      result.stats.companiesCrawled += freeResult.companiesCrawled;
      result.stats.duplicatesFiltered += freeResult.duplicatesFiltered;
      result.stats.matchesGenerated += freeResult.matchesGenerated;
      result.stats.digestsQueued += freeResult.digestsQueued;
      result.errors.push(...freeResult.errors);
    }

    result.usersProcessed = result.proUsersProcessed + result.freeUsersProcessed;
    result.endTime = new Date().toISOString();

    // Update wave status
    await updateWaveStatus(supabase, waveId, 'completed', result);

    console.log(`[WAVE] Completed ${waveType} wave: ${result.usersProcessed} users, ${result.jobsDiscovered} jobs`);
    return result;

  } catch (error) {
    console.error(`[WAVE] Error in ${waveType} wave:`, error);
    result.errors.push(error.message);
    result.endTime = new Date().toISOString();

    await updateWaveStatus(supabase, waveId, 'failed', result);
    throw error;
  }
}

/**
 * Get eligible users for the current wave
 */
async function getEligibleUsers(supabase: any, maxUsers: number, testMode: boolean): Promise<UserProfile[]> {
  // In test mode, limit to first 10 users
  const limit = testMode ? 10 : maxUsers;

  // Get users who haven't been crawled in the last 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const { data: users, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      crawl_priority,
      pro_user,
      last_crawl_wave,
      user_preferences (
        target_roles,
        preferred_locations,
        experience_level
      )
    `)
    .or(`last_crawl_wave.is.null,last_crawl_wave.lt.${oneDayAgo.toISOString()}`)
    .eq('role', 'candidate')
    .limit(limit);

  if (error) {
    console.error('[USERS] Error fetching eligible users:', error);
    return [];
  }

  return (users || []).map((user: any) => ({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    crawl_priority: user.crawl_priority || 1,
    pro_user: user.pro_user || false,
    last_crawl_wave: user.last_crawl_wave,
    target_roles: user.user_preferences?.target_roles || ['software engineer'],
    preferred_locations: user.user_preferences?.preferred_locations || ['Remote'],
    experience_level: user.user_preferences?.experience_level || 'mid'
  }));
}

/**
 * Process a batch of users (Pro or Free)
 */
async function processUserBatch(
  supabase: any,
  waveId: string,
  users: UserProfile[],
  userType: 'pro' | 'free',
  testMode: boolean
): Promise<{
  usersProcessed: number;
  jobsDiscovered: number;
  companiesCrawled: number;
  duplicatesFiltered: number;
  matchesGenerated: number;
  digestsQueued: number;
  errors: string[];
}> {
  const result = {
    usersProcessed: 0,
    jobsDiscovered: 0,
    companiesCrawled: 0,
    duplicatesFiltered: 0,
    matchesGenerated: 0,
    digestsQueued: 0,
    errors: []
  };

  // Generate target companies based on user preferences
  const companies = generateTargetCompanies(users);
  console.log(`[BATCH_${userType.toUpperCase()}] Processing ${companies.length} companies for ${users.length} users`);

  // Process companies with rate limiting
  for (const company of companies) {
    if (testMode && result.companiesCrawled >= 2) break; // Limit in test mode

    try {
      console.log(`[BATCH_${userType.toUpperCase()}] Crawling: ${company}`);

      // Call enhanced crawl-jobs function with company_focused mode
      const crawlResult = await supabase.functions.invoke('crawl-jobs', {
        body: {
          mode: 'company_focused',
          company,
          limit: userType === 'pro' ? 50 : 30 // Pro users get more jobs per company
        }
      });

      if (crawlResult.error) {
        throw new Error(crawlResult.error.message);
      }

      const { data } = crawlResult;
      if (data.success) {
        result.companiesCrawled++;
        result.jobsDiscovered += data.total || 0;

        // Process profile matching for relevant users
        const relevantUsers = users.filter(user =>
          isUserInterestedInCompany(user, company)
        );

        for (const user of relevantUsers) {
          try {
            const matchResult = await processProfileMatching(supabase, waveId, user, data.jobs || []);
            result.matchesGenerated += matchResult.matches;
            result.digestsQueued += matchResult.queued;
          } catch (matchError) {
            console.error(`[MATCHING] Error for user ${user.id}:`, matchError);
            result.errors.push(`Matching error for ${user.id}: ${matchError.message}`);
          }
        }

        // Update user's last crawl wave timestamp
        for (const user of relevantUsers) {
          await supabase
            .from('profiles')
            .update({ last_crawl_wave: new Date().toISOString() })
            .eq('id', user.id);
        }

        result.usersProcessed += relevantUsers.length;
      } else {
        result.errors.push(`Crawl failed for ${company}: ${data.error}`);
      }

      // Rate limiting between companies
      if (!testMode) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }

    } catch (error) {
      console.error(`[BATCH_${userType.toUpperCase()}] Error crawling ${company}:`, error);
      result.errors.push(`${company}: ${error.message}`);
    }
  }

  return result;
}

/**
 * Generate target companies based on user preferences
 */
function generateTargetCompanies(users: UserProfile[]): string[] {
  // High-value companies that frequently post jobs
  const topTechCompanies = [
    'Google', 'Apple', 'Microsoft', 'Amazon', 'Meta',
    'Netflix', 'Tesla', 'Uber', 'Airbnb', 'Stripe',
    'Coinbase', 'Shopify', 'Slack', 'Zoom', 'Atlassian',
    'Salesforce', 'Adobe', 'Intel', 'NVIDIA', 'Oracle'
  ];

  const financeTechCompanies = [
    'JPMorgan Chase', 'Goldman Sachs', 'Morgan Stanley',
    'American Express', 'PayPal', 'Square', 'Robinhood',
    'Plaid', 'Affirm', 'Klarna'
  ];

  const startupUnicorns = [
    'Databricks', 'Canva', 'Discord', 'Figma', 'Notion',
    'Airtable', 'Vercel', 'Linear', 'Retool', 'Supabase'
  ];

  // Combine and prioritize based on user preferences
  const allCompanies = [...topTechCompanies, ...financeTechCompanies, ...startupUnicorns];

  // Shuffle for variety across waves
  const shuffled = allCompanies.sort(() => Math.random() - 0.5);

  // Return first 15 companies to crawl in this wave
  return shuffled.slice(0, 15);
}

/**
 * Check if user is interested in a company based on their profile
 */
function isUserInterestedInCompany(user: UserProfile, company: string): boolean {
  // For now, assume all users are interested in all companies
  // This could be enhanced with industry matching, company size preferences, etc.
  return true;
}

/**
 * Process profile matching for a user against crawled jobs and persist
 * fresh matches into both job_matches (for the dashboard feed) and
 * daily_job_queue (for email digest delivery).
 */
async function processProfileMatching(
  supabase: any,
  waveId: string,
  user: UserProfile,
  jobs: any[]
): Promise<{ matches: number; queued: number }> {
  let matches = 0;
  let queued = 0;

  const now = new Date().toISOString();
  const today = now.split('T')[0];

  for (const job of jobs) {
    try {
      const score = calculateSimpleMatchScore(user, job);

      if (score >= 70) {
        matches++;

        // Skip jobs that don't have a real UUID (may have been inserted
        // with a temp ID by the in-process crawl).
        const jobId: string | null = job.id || null;
        if (!jobId) continue;

        // ── 1. Upsert into job_matches so the dashboard feed stays fresh ──
        // On conflict (same user + job) we update matched_at and scores so
        // the 12-hour freshness gate in cached-job-engine lets these through.
        const skillMatch = score >= 90 ? 85 : score >= 70 ? 70 : 50;
        const locationMatch =
          (user.preferred_locations || []).some(loc =>
            (job.location || '').toLowerCase().includes(loc.toLowerCase()) ||
            loc.toLowerCase() === 'remote'
          ) ? 90 : 60;

        await supabase
          .from('job_matches')
          .upsert(
            {
              user_id:        user.id,
              job_id:         jobId,
              match_score:    score,
              skill_match:    skillMatch,
              culture_fit:    70,
              location_match: locationMatch,
              reasoning:      [`Wave match: ${score}%`, `Wave: ${waveId}`],
              matched_at:     now,
              status:         'pending',
            },
            { onConflict: 'user_id,job_id', ignoreDuplicates: false }
          );

        // ── 2. Queue for daily digest email (existing behaviour) ──────────
        const { error: queueError } = await supabase
          .from('daily_job_queue')
          .upsert({
            user_id:       user.id,
            job_id:        jobId,
            match_score:   score,
            match_reasons: [`Simple match: ${score}%`],
            wave_id:       waveId,
            queued_at:     now,
            digest_date:   today,
          }, {
            onConflict: 'user_id,job_id,digest_date'
          });

        if (!queueError) {
          queued++;
        }
      }
    } catch (error) {
      console.error(`[MATCHING] Error processing job for user ${user.id}:`, error);
    }
  }

  return { matches, queued };
}

/**
 * Simple match score calculation (placeholder)
 */
function calculateSimpleMatchScore(user: UserProfile, job: any): number {
  let score = 50; // Base score

  // Title matching
  const userRoles = user.target_roles || [];
  const jobTitle = (job.title || '').toLowerCase();

  for (const role of userRoles) {
    if (jobTitle.includes(role.toLowerCase())) {
      score += 25;
      break;
    }
  }

  // Experience level matching
  if (job.experience_level === user.experience_level) {
    score += 15;
  }

  // Location preference
  const userLocations = user.preferred_locations || [];
  const jobLocation = (job.location || '').toLowerCase();

  if (userLocations.some(loc =>
    jobLocation.includes(loc.toLowerCase()) ||
    loc.toLowerCase() === 'remote'
  )) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Update wave status in database
 */
async function updateWaveStatus(supabase: any, waveId: string, status: string, result: WaveResult): Promise<void> {
  const { error } = await supabase
    .from('daily_crawl_waves')
    .update({
      status,
      users_processed: result.usersProcessed,
      jobs_discovered: result.jobsDiscovered,
      completed_at: result.endTime || new Date().toISOString(),
      errors: result.errors
    })
    .eq('id', waveId);

  if (error) {
    console.error('[WAVE_UPDATE] Error updating wave status:', error);
  }
}

/**
 * Execute manual crawl for specific users/companies
 */
async function executeManualCrawl(
  supabase: any,
  userIds: string[],
  companies: string[]
): Promise<any> {
  console.log(`[MANUAL] Processing ${userIds.length} users for ${companies.length} companies`);

  // Implementation would be similar to processUserBatch but with specific targets
  return {
    message: 'Manual crawl functionality not fully implemented in this version',
    userIds,
    companies
  };
}

/**
 * Perform cleanup of old data
 */
async function performCleanup(supabase: any): Promise<any> {
  console.log('[CLEANUP] Starting cleanup operations');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Clean up old fingerprints
  const { count: fingerprintCount } = await supabase
    .from('job_fingerprints')
    .delete({ count: 'exact' })
    .lt('last_seen_at', sevenDaysAgo.toISOString());

  // Clean up old wave records (keep last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: waveCount } = await supabase
    .from('daily_crawl_waves')
    .delete({ count: 'exact' })
    .lt('created_at', thirtyDaysAgo.toISOString());

  console.log(`[CLEANUP] Cleaned ${fingerprintCount || 0} fingerprints, ${waveCount || 0} old waves`);

  return {
    cleanedFingerprints: fingerprintCount || 0,
    cleanedWaves: waveCount || 0,
    message: 'Cleanup completed successfully'
  };
}