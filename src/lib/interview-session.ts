export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PersistedSession {
  messages: unknown[];
  mode: string;
  savedAt?: number;
}

export function parseStoredSession(
  raw: string | null,
  ttlMs = SESSION_TTL_MS,
): PersistedSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) return null;
    if (parsed.savedAt !== undefined && Date.now() - parsed.savedAt > ttlMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeSession(messages: unknown[], mode: string): string {
  return JSON.stringify({ messages, mode, savedAt: Date.now() });
}
