import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkUsageWarnings, scheduleUsageWarning } from "../_shared/usage-tracker.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-connection-pool-size'
      }
    });
  }

  try {
    const { userId, featureName, newUsage } = await req.json();

    if (!userId || !featureName || typeof newUsage !== 'number') {
      return new Response('Missing required parameters', { status: 400 });
    }

    const warningCheck = await checkUsageWarnings(userId, featureName, newUsage);

    if (warningCheck?.shouldWarn) {
      await scheduleUsageWarning(userId, warningCheck);
    }

    return new Response(JSON.stringify({
      success: true,
      warning: warningCheck ? true : false
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[CHECK_USAGE_WARNINGS] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});