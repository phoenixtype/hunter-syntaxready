/**
 * CSRF Protection utilities for Hunter
 * Provides client-side CSRF token generation and validation
 */

const CSRF_TOKEN_KEY = 'hunter_csrf_token';
const CSRF_TOKEN_HEADER = 'X-CSRF-Token';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the current CSRF token from sessionStorage, or generate a new one
 */
export function getCSRFToken(): string {
  let token = sessionStorage.getItem(CSRF_TOKEN_KEY);
  if (!token) {
    token = generateCSRFToken();
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  }
  return token;
}

/**
 * Get headers with CSRF token included
 */
export function getCSRFHeaders(): Record<string, string> {
  return {
    [CSRF_TOKEN_HEADER]: getCSRFToken()
  };
}

/**
 * Validate CSRF token (for client-side validation)
 */
export function validateCSRFToken(token: string): boolean {
  const storedToken = sessionStorage.getItem(CSRF_TOKEN_KEY);
  return storedToken !== null && storedToken === token;
}

/**
 * Clear CSRF token (call on logout)
 */
export function clearCSRFToken(): void {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
}

/**
 * Hook to automatically include CSRF protection in Supabase calls
 */
export function withCSRFHeaders(headers?: Record<string, string>): Record<string, string> {
  return {
    ...headers,
    ...getCSRFHeaders()
  };
}