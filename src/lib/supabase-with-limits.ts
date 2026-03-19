import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Limit concurrent requests to prevent overwhelming Supabase
const requestLimit = pLimit(10); // Max 10 concurrent database operations
const functionLimit = pLimit(3); // Edge functions have lower limits (max 3 concurrent)

// Custom fetch wrapper with rate limiting
const rateLimitedFetch = (url: RequestInfo | URL, options: RequestInit = {}) => {
  // Route to appropriate limiter based on endpoint
  const urlString = url.toString();
  const isFunction = urlString.includes('/functions/');
  const limiter = isFunction ? functionLimit : requestLimit;

  return limiter(() => fetch(url, options));
};

/**
 * Rate-limited Supabase client that prevents overwhelming the database
 * and edge functions with concurrent requests.
 *
 * Uses p-limit to queue requests:
 * - Database operations: max 10 concurrent
 * - Edge functions: max 3 concurrent
 */
export const supabaseWithLimits = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public'
    },
    global: {
      fetch: rateLimitedFetch,
      headers: {
        // Configure connection pooling hints
        'x-connection-pool-size': '20',
        'x-client-info': 'hunter-ai-rate-limited'
      }
    }
  }
);

/**
 * Get current rate limiter queue status for monitoring
 */
export const getRateLimiterStatus = () => ({
  database: {
    activeCount: requestLimit.activeCount,
    pendingCount: requestLimit.pendingCount,
    limit: 10
  },
  functions: {
    activeCount: functionLimit.activeCount,
    pendingCount: functionLimit.pendingCount,
    limit: 3
  }
});

/**
 * Wait for all pending requests to complete (useful for testing)
 */
export const waitForRateLimiters = async () => {
  await Promise.all([
    requestLimit.onEmpty(),
    functionLimit.onEmpty()
  ]);
};

export default supabaseWithLimits;