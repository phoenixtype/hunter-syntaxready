/**
 * Standardized CORS handling for Hunter edge functions
 * Ensures consistent CORS headers across all endpoints
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, ' +
    'x-supabase-client-platform, x-supabase-client-platform-version, ' +
    'x-supabase-client-runtime, x-supabase-client-runtime-version, ' +
    'x-connection-pool-size, x-postgrest-profile, x-supabase-project-ref, ' +
    'x-request-priority, x-retry-attempt',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, HEAD',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Handle OPTIONS preflight requests
 */
export function handleCorsPrelight(): Response {
  return new Response('ok', {
    status: 200,
    headers: corsHeaders
  });
}

/**
 * Add CORS headers to any response by creating a new Response
 * (Response.headers is immutable, so we must construct a new object)
 */
export function withCors(response: Response): Response {
  const merged = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => merged.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonWithCors(data: any, options: { status?: number } = {}): Response {
  return new Response(JSON.stringify(data), {
    status: options.status || 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response with CORS headers
 */
export function errorWithCors(error: string, status: number = 400): Response {
  return jsonWithCors({ error }, { status });
}