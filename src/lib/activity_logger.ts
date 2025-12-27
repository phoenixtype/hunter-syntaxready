
export type LogType = 'info' | 'success' | 'warning' | 'error' | 'action';

export interface LogEntry {
  id: string;
  timestamp: number;
  agent: string;
  action: string;
  details: string;
  type: LogType;
}

// In-memory log store
const activityLog: LogEntry[] = [];
const subscribers: (() => void)[] = [];

export const logActivity = (agent: string, action: string, details: string, type: LogType = 'info') => {
  const entry: LogEntry = {
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    agent,
    action,
    details,
    type,
  };
  
  activityLog.unshift(entry); // Add to beginning
  
  // Cap log size
  if (activityLog.length > 50) {
    activityLog.pop();
  }

  notifySubscribers();
  console.log(`[${agent}] ${action}: ${details}`);
};

export const getLogs = (): LogEntry[] => {
  return [...activityLog];
};

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

// Initial logs to not show empty state
logActivity('System', 'Initialization', 'Hunter AI Security Layer active', 'success');
logActivity('Crawler', 'Idle', 'Waiting for job search triggers', 'info');
