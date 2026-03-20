/**
 * Standardized CORS handling for Hunter edge functions
 * Ensures consistent CORS headers across all endpoints
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, ' +
    'x-supabase-client-platform, x-supabase-client-platform-version, ' +
    'x-supabase-client-runtime, x-supabase-client-runtime-version',
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
 * Add CORS headers to any response
 */
export function withCors(response: Response): Response {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
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