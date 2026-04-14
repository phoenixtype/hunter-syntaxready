import * as Sentry from '@sentry/react';

try { (globalThis as { __HUNTER_STEP__?: (n: string) => void }).__HUNTER_STEP__?.('logger:body-start'); } catch { /* ignore */ }

/**
 * Unified logger that automatically pipes warnings and exceptions to Sentry 
 * while maintaining console output for local development.
 */
export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    console.info(message, context || '');
    Sentry.addBreadcrumb({
      category: 'log',
      message,
      level: 'info',
      data: context,
    });
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(message, context || '');
    Sentry.captureMessage(message, { level: 'warning', extra: context });
  },
  error: (error: Error | string, context?: Record<string, unknown>) => {
    console.error(error, context || '');
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: context });
    } else {
      Sentry.captureException(new Error(error), { extra: context });
    }
  },
  setUser: (userId: string, email?: string) => {
    Sentry.setUser({ id: userId, email });
  },
  clearUser: () => {
    Sentry.setUser(null);
  }
};
