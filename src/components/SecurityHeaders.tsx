import { useEffect } from 'react';

/**
 * Component to set client-side security configurations
 * Note: These should ideally be set at the server level, but this provides fallback protection
 */
export function SecurityHeaders() {
  useEffect(() => {
    // Set CSP for inline scripts (development fallback)
    if (import.meta.env.DEV) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://www.googletagmanager.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com;
        img-src 'self' data: https: blob:;
        connect-src 'self' https://api.paystack.co https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com;
        frame-src 'self' https://js.paystack.co;
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        upgrade-insecure-requests;
      `.replace(/\s+/g, ' ').trim();

      // Only add if not already present
      if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        document.head.appendChild(meta);
      }
    }

    // Disable right-click in production (optional - can be removed if too restrictive)
    const handleContextMenu = (e: MouseEvent) => {
      if (import.meta.env.PROD) {
        e.preventDefault();
        return false;
      }
    };

    // Disable F12, Ctrl+Shift+I, etc. in production (optional)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (import.meta.env.PROD) {
        // F12
        if (e.key === 'F12') {
          e.preventDefault();
          return false;
        }

        // Ctrl+Shift+I (Inspector)
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
          e.preventDefault();
          return false;
        }

        // Ctrl+Shift+C (Console)
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
          e.preventDefault();
          return false;
        }

        // Ctrl+U (View source)
        if (e.ctrlKey && e.key === 'u') {
          e.preventDefault();
          return false;
        }
      }
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null; // This component doesn't render anything
}

/**
 * Security utilities
 */
export const SecurityUtils = {
  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput: (input: string): string => {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  },

  /**
   * Validate URL to prevent open redirects
   */
  validateRedirectURL: (url: string): boolean => {
    try {
      const parsedUrl = new URL(url, window.location.origin);
      // Only allow same-origin redirects
      return parsedUrl.origin === window.location.origin;
    } catch {
      return false;
    }
  },

  /**
   * Generate secure random string
   */
  generateSecureToken: (length: number = 32): string => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Hash sensitive data (for client-side hashing only - not for passwords!)
   */
  hashData: async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

export default SecurityHeaders;