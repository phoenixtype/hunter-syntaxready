import { supabase } from "@/integrations/supabase/client";

export interface UserPreferences {
  target_roles: string[];
  min_salary_usd: number;
  locations: string[];
  remote_policy: 'remote' | 'hybrid' | 'onsite' | 'any';
  experience_level: string;
  aggressiveness: number;
  safe_mode: boolean;
  require_sponsorship: boolean;
  has_clearance: boolean;
  notice_period_days: number;
  email_alerts_enabled: boolean;
  sms_alerts_enabled: boolean;
  tracker_view: 'board' | 'list';
}

const ALLOWED_EXPERIENCE_LEVELS = ['entry', 'mid', 'senior', 'lead', 'executive'] as const;
type AllowedExperienceLevel = typeof ALLOWED_EXPERIENCE_LEVELS[number];

const EXPERIENCE_LEVEL_ALIASES: Record<string, AllowedExperienceLevel> = {
  intern: 'entry',
  internship: 'entry',
  junior: 'entry',
  jr: 'entry',
  entry: 'entry',
  mid: 'mid',
  'mid-level': 'mid',
  midlevel: 'mid',
  senior: 'senior',
  sr: 'senior',
  lead: 'lead',
  executive: 'executive',
  expert: 'executive',
  director: 'executive',
};

const normalizeExperienceLevel = (value: unknown): AllowedExperienceLevel => {
  if (typeof value !== 'string') return 'mid';
  const normalized = value.trim().toLowerCase();
  if ((ALLOWED_EXPERIENCE_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as AllowedExperienceLevel;
  }
  return EXPERIENCE_LEVEL_ALIASES[normalized] || 'mid';
};

const DEFAULT_PREFERENCES: UserPreferences = {
  target_roles: [],
  min_salary_usd: 100000,
  locations: [],
  remote_policy: 'any',
  experience_level: 'mid',
  aggressiveness: 5,
  safe_mode: true,
  require_sponsorship: false,
  has_clearance: false,
  notice_period_days: 14,
  email_alerts_enabled: false,
  sms_alerts_enabled: false,
  tracker_view: 'list'
};

export const getPreferences = async (userId: string): Promise<UserPreferences | null> => {
  if (!userId || typeof userId !== 'string' || userId.length > 128) {
    console.error("Invalid userId provided");
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn("Error fetching preferences:", error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      target_roles: Array.isArray(data.target_roles) ? data.target_roles.slice(0, 20) : [],
      min_salary_usd: typeof data.min_salary_usd === 'number' ? Math.max(0, Math.min(data.min_salary_usd, 10000000)) : DEFAULT_PREFERENCES.min_salary_usd,
      locations: Array.isArray(data.locations) ? data.locations.slice(0, 20) : [],
      remote_policy: ['remote', 'hybrid', 'onsite', 'any'].includes(data.remote_policy ?? '') 
        ? data.remote_policy as UserPreferences['remote_policy'] 
        : 'any',
      experience_level: normalizeExperienceLevel(data.experience_level),
      aggressiveness: typeof data.aggressiveness === 'number' ? Math.max(1, Math.min(data.aggressiveness, 10)) : DEFAULT_PREFERENCES.aggressiveness,
      safe_mode: typeof data.safe_mode === 'boolean' ? data.safe_mode : true,
      require_sponsorship: typeof data.require_sponsorship === 'boolean' ? data.require_sponsorship : false,
      has_clearance: typeof data.has_clearance === 'boolean' ? data.has_clearance : false,
      notice_period_days: typeof data.notice_period_days === 'number' ? data.notice_period_days : 14,
      email_alerts_enabled: typeof data.email_alerts_enabled === 'boolean' ? data.email_alerts_enabled : false,
      sms_alerts_enabled: typeof data.sms_alerts_enabled === 'boolean' ? data.sms_alerts_enabled : false,
      // tracker_view is app-only (not in DB), default to 'list'
      tracker_view: 'list'
    };
  } catch (e) {
    console.error("Error in getPreferences:", e);
    return null;
  }
};

export const savePreferences = async (userId: string, prefs: UserPreferences): Promise<void> => {
  if (!userId || typeof userId !== 'string' || userId.length > 128) {
    throw new Error("Invalid userId");
  }
  
  // Build the DB payload — omit tracker_view since it's not a DB column
  const dbPayload = {
    user_id: userId,
    target_roles: Array.isArray(prefs.target_roles) 
      ? prefs.target_roles.slice(0, 20).map(r => String(r).slice(0, 100)) 
      : [],
    min_salary_usd: typeof prefs.min_salary_usd === 'number' 
      ? Math.max(0, Math.min(prefs.min_salary_usd, 10000000)) 
      : DEFAULT_PREFERENCES.min_salary_usd,
    locations: Array.isArray(prefs.locations) 
      ? prefs.locations.slice(0, 20).map(l => String(l).slice(0, 100)) 
      : [],
    remote_policy: ['remote', 'hybrid', 'onsite', 'any'].includes(prefs.remote_policy)
      ? prefs.remote_policy
      : 'any',
    experience_level: normalizeExperienceLevel(prefs.experience_level),
    aggressiveness: typeof prefs.aggressiveness === 'number' 
      ? Math.max(1, Math.min(prefs.aggressiveness, 10)) 
      : DEFAULT_PREFERENCES.aggressiveness,
    safe_mode: typeof prefs.safe_mode === 'boolean' ? prefs.safe_mode : true,
    require_sponsorship: typeof prefs.require_sponsorship === 'boolean' ? prefs.require_sponsorship : false,
    has_clearance: typeof prefs.has_clearance === 'boolean' ? prefs.has_clearance : false,
    notice_period_days: typeof prefs.notice_period_days === 'number' ? prefs.notice_period_days : 14,
    email_alerts_enabled: typeof prefs.email_alerts_enabled === 'boolean' ? prefs.email_alerts_enabled : false,
    sms_alerts_enabled: typeof prefs.sms_alerts_enabled === 'boolean' ? prefs.sms_alerts_enabled : false,
  };
  
  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert(dbPayload, { onConflict: 'user_id' });

    if (error) {
      console.error("Error saving preferences:", error.message);
      throw error;
    }
  } catch (e) {
    console.error("Error saving preferences:", e);
    throw e;
  }
};

export const getDefaultPreferences = (): UserPreferences => {
  return { ...DEFAULT_PREFERENCES };
};

// Check if user has completed onboarding
export const hasCompletedOnboarding = async (userId: string): Promise<boolean> => {
  try {
    const prefs = await getPreferences(userId);
    return prefs !== null && prefs.target_roles.length > 0;
  } catch {
    return false;
  }
};
