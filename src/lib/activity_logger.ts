import { supabase } from "@/integrations/supabase/client";

export type LogType = 'info' | 'success' | 'warning' | 'error' | 'action';

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

// Log activity to database
export const logActivity = async (
  agent: string, 
  action: string, 
  details: string, 
  type: LogType = 'info',
  userId?: string
): Promise<void> => {
  const entry: LogEntry = {
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    agent,
    action,
    details,
    type,
  };
  
  // Add to cache immediately for real-time feel
  activityLogCache.unshift(entry);
  if (activityLogCache.length > 50) {
    activityLogCache.pop();
  }
  notifySubscribers();
  
  console.log(`[${agent}] ${action}: ${details}`);

  // Persist to database
  try {
    const effectiveUserId = userId || currentUserId;
    
    await supabase
      .from('agent_activity_logs')
      .insert({
        user_id: effectiveUserId,
        agent,
        action,
        details,
        log_type: type,
        metadata: {}
      });
  } catch (err) {
    console.error('Failed to persist log:', err);
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
      console.error('Error fetching logs:', error);
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
    console.error('Error fetching logs:', err);
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

// Initialize with default logs
export const initializeDefaultLogs = () => {
  if (activityLogCache.length === 0) {
    activityLogCache = [
      {
        id: 'init-1',
        timestamp: Date.now(),
        agent: 'System',
        action: 'Initialization',
        details: 'Hunter AI Security Layer active',
        type: 'success'
      },
      {
        id: 'init-2',
        timestamp: Date.now() - 1000,
        agent: 'Crawler',
        action: 'Idle',
        details: 'Waiting for job search triggers',
        type: 'info'
      }
    ];
    notifySubscribers();
  }
};

// Auto-initialize
initializeDefaultLogs();
