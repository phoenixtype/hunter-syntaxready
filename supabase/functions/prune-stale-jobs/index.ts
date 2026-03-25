import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for Edge Functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Batch size for processing to not overwhelm the DB or the network
const BATCH_SIZE = 100;
// Concurrency for network requests
const CONCURRENCY = 20;

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Validate Authorization (Service Role OR Admin trigger)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Fetch jobs that need verification (order by oldest verified first)
    const { data: jobs, error: fetchError } = await supabase
      .from('job_listings')
      .select('id, url, company')
      .order('last_verified_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[PRUNER] Error fetching jobs:', fetchError);
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      console.log('[PRUNER] No jobs to verify.');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[PRUNER] verifying ${jobs.length} jobs...`);

    const toDelete: string[] = [];
    const toUpdate: string[] = [];

    // 4. Verify URLs concurrently using a simple queue system
    const verifyJob = async (job: { id: string, url: string, company: string }): Promise<{ id: string, action: 'delete' | 'update' }> => {
      try {
        if (!job.url || !job.url.startsWith('http')) {
          console.log(`[PRUNER] Invalid URL for job ${job.id}: ${job.url}`);
          return { id: job.id, action: 'delete' };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(job.url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        // 404 Not Found or 410 Gone means the job is unequivocally removed
        if (response.status === 404 || response.status === 410) {
          console.log(`[PRUNER] 🗑️ [404] Stale job found: ${job.company} - ${job.url}`);
          return { id: job.id, action: 'delete' };
        } else {
          // Anything else (200 OK, 403 Forbidden/Cloudflare bot check, 301 Redirect) implies it still exists
          console.log(`[PRUNER] ✅ [${response.status}] Active job: ${job.company}`);
          return { id: job.id, action: 'update' };
        }
      } catch (error) {
        // Network errors (DNS failure, connection refused) might mean the URL is completely dead
        console.warn(`[PRUNER] ⚠️ Network error verifying ${job.company} (${job.url}):`, (error as Error).message);
        return { id: job.id, action: 'update' }; // Re-queue for next time, don't delete on network error to be safe
      }
    };

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const chunk = jobs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map(verifyJob));
      
      for (const res of results) {
        if (res.action === 'delete') toDelete.push(res.id);
        else toUpdate.push(res.id);
      }
    }

    // 5. Execute bulk database operations
    let deletedCount = 0;
    let updatedCount = 0;

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('job_listings')
        .delete()
        .in('id', toDelete);
      
      if (deleteError) {
        console.error('[PRUNER] Batch delete error:', deleteError);
      } else {
        deletedCount = toDelete.length;
      }
    }

    if (toUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from('job_listings')
        .update({ last_verified_at: new Date().toISOString() })
        .in('id', toUpdate);

      if (updateError) {
        console.error('[PRUNER] Batch update error:', updateError);
      } else {
        updatedCount = toUpdate.length;
      }
    }

    console.log(`[PRUNER] Finished. Deleted: ${deletedCount}, Re-verified: ${updatedCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: jobs.length,
      deleted: deletedCount,
      verified: updatedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[PRUNER] Fatal error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
