import { supabase } from "@/integrations/supabase/client";

export type LogType = 'info' | 'success' | 'warning' | 'error' | 'action';

// Log levels for filtering - higher number = more important
export const LOG_LEVELS: Record<LogType, number> = {
  'info': 1,
  'action': 2,
  'success': 3,
  'warning': 4,
  'error': 5
};

export interface LogEntry {
  id: string;
  timestamp: number;
  agent: string;
  action: string;
  details: string;
  type: LogType;
}

// In-memory cache for real-time updates
let activityLogCache: LogEntry[] = [];
const subscribers: (() => void)[] = [];
let currentUserId: string | null = null;
let minLogLevel: number = LOG_LEVELS.info;

/**
 * SECURITY: Sanitize log details to remove PII
 * Masks emails, phone numbers, and other sensitive patterns
 */
const sanitizeLogDetails = (details: string): string => {
  if (!details) return '';
  
  let sanitized = details;
  
  // Mask email addresses (show first 2 chars + domain)
  sanitized = sanitized.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (match, localPart, domain) => {
      const masked = localPart.substring(0, 2) + '***';
      return `${masked}@${domain}`;
    }
  );
  
  // Mask phone numbers
  sanitized = sanitized.replace(
    /(\+?[\d\s-]{10,})/g,
    (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 10) {
        return '***-***-' + digits.slice(-4);
      }
      return match;
    }
  );
  
  // Mask potential SSN patterns
  sanitized = sanitized.replace(
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    '***-**-****'
  );
  
  // Mask credit card numbers
  sanitized = sanitized.replace(
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    '****-****-****-****'
  );
  
  // Mask IP addresses
  sanitized = sanitized.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    '***.***.***.***'
  );
  
  return sanitized;
};

/**
 * Set the minimum log level to record
 */
export const setMinLogLevel = (level: LogType) => {
  minLogLevel = LOG_LEVELS[level];
};

/**
 * SECURITY: Logs activity with PII sanitization
 * Does not log sensitive user data to console in production
 */
export const logActivity = async (
  agent: string, 
  action: string, 
  details: string, 
  type: LogType = 'info',
  userId?: string
): Promise<void> => {
  // Skip logs below minimum level
  if (LOG_LEVELS[type] < minLogLevel) {
    return;
  }

  // Sanitize details before storing
  const sanitizedDetails = sanitizeLogDetails(details);
  
  const entry: LogEntry = {
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    agent,
    action,
    details: sanitizedDetails,
    type,
  };
  
  // Add to cache immediately for real-time feel
  activityLogCache.unshift(entry);
  if (activityLogCache.length > 50) {
    activityLogCache.pop();
  }
  notifySubscribers();
  
  // SECURITY: Only log non-sensitive info to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${type.toUpperCase()}] [${agent}] ${action}`);
  }

  // Persist to database
  try {
    const effectiveUserId = userId || currentUserId;
    
    await supabase
      .from('agent_activity_logs')
      .insert({
        user_id: effectiveUserId,
        agent,
        action,
        details: sanitizedDetails,
        log_type: type,
        metadata: {}
      });
  } catch (err) {
    // SECURITY: Don't expose error details to console
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to persist log');
    }
  }
};

// Set the current user for logging
export const setLoggerUserId = (userId: string | null) => {
  currentUserId = userId;
};

// Get logs from cache (real-time)
export const getLogs = (): LogEntry[] => {
  return [...activityLogCache];
};

// Fetch logs from database
export const fetchLogsFromDatabase = async (userId: string, limit: number = 50): Promise<LogEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('agent_activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching logs');
      }
      return [];
    }

    const logs: LogEntry[] = (data || []).map((log: any) => ({
      id: log.id,
      timestamp: new Date(log.created_at).getTime(),
      agent: log.agent,
      action: log.action,
      details: log.details || '',
      type: log.log_type as LogType
    }));

    // Update cache
    activityLogCache = logs;
    notifySubscribers();

    return logs;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching logs');
    }
    return [];
  }
};

// Subscribe to log updates
export const subscribeToLogs = (callback: () => void) => {
  subscribers.push(callback);
  return () => {
    const index = subscribers.indexOf(callback);
    if (index > -1) {
      subscribers.splice(index, 1);
    }
  };
};

const notifySubscribers = () => {
  subscribers.forEach(cb => cb());
};

// Initialize with default logs (no PII)
export const initializeDefaultLogs = () => {
  if (activityLogCache.length === 0) {
    activityLogCache = [
      {
        id: 'init-1',
        timestamp: Date.now(),
        agent: 'System',
        action: 'Initialization',
        details: 'Security Layer active',
        type: 'success'
      },
      {
        id: 'init-2',
        timestamp: Date.now() - 1000,
        agent: 'Crawler',
        action: 'Idle',
        details: 'Waiting for triggers',
        type: 'info'
      }
    ];
    notifySubscribers();
  }
};

// Auto-initialize
initializeDefaultLogs();
