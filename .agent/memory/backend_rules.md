# Backend Development Guidelines (Supabase)

## Technology Stack
- **Runtime**: Deno (Supabase Edge Functions)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth (JWT)

## Edge Function Pattern
Every function located in `supabase/functions/[name]` must follow this strict structure:

### 1. CORS Headers
Always handle `OPTIONS` requests and return CORS headers.
```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

### 2. Security & Validation
- **Environment Variables**: Validate existence of `SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc. immediately.
- **Authorization**: Verify the JWT from the `Authorization` header using `getUser()`.
- **Rate Limiting**: Call the `checkRateLimit` RPC before executing expensive logic.
- **Error Masking**: Do NOT return raw stack traces or internal error details to the client. Use generic messages like "Service unavailable".

### 3. Utility Functions
- **Health Checks**: Return 200 OK immediately for health probes (User-Agent check or HEAD request).
- **Type Safety**: Use `// eslint-disable-next-line @typescript-eslint/no-explicit-any` sparingly, only where Deno typing is fundamentally broken.

## Database Rules
- **RLS (Row Level Security)**: ENABLED on every table.
    - Users can only `SELECT/UPDATE/DELETE` their own rows (`auth.uid() = user_id`).
- **RPCs**: Use Postgres functions for complex server-side logic (e.g., `match_jobs` vector search).
- **Service Role**: Only use `SUPABASE_SERVICE_ROLE_KEY` inside Edge Functions for admin tasks (like rate limiting). Never expose it to the client.

## Logging
- Use `console.log` for info (auth success, flow completion).
- Use `console.error` for errors (exceptions, missing keys).
- Structure logs with prefixes: `[AUTH]`, `[CRAWL]`, `[DB]`.
