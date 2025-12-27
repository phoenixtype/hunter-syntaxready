import { supabase } from "@/integrations/supabase/client";

export interface UserPreferences {
  target_roles: string[];
  min_salary_usd: number;
  locations: string[];
  remote_policy: 'remote' | 'hybrid' | 'onsite' | 'any';
  aggressiveness: number;
  safe_mode: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  target_roles: [],
  min_salary_usd: 100000,
  locations: [],
  remote_policy: 'any',
  aggressiveness: 5,
  safe_mode: true
};

export const getPreferences = async (userId: string): Promise<UserPreferences | null> => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn("Error fetching preferences:", error.message);
      // Fallback to local storage
      const local = localStorage.getItem(`hunter_prefs_${userId}`);
      return local ? JSON.parse(local) : null;
    }

    if (!data) {
      return null;
    }

    return {
      target_roles: data.target_roles || [],
      min_salary_usd: data.min_salary_usd || DEFAULT_PREFERENCES.min_salary_usd,
      locations: data.locations || [],
      remote_policy: data.remote_policy as UserPreferences['remote_policy'] || 'any',
      aggressiveness: data.aggressiveness || DEFAULT_PREFERENCES.aggressiveness,
      safe_mode: data.safe_mode ?? true
    };
  } catch (e) {
    console.error("Error in getPreferences:", e);
    const local = localStorage.getItem(`hunter_prefs_${userId}`);
    return local ? JSON.parse(local) : null;
  }
};

export const savePreferences = async (userId: string, prefs: UserPreferences): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        target_roles: prefs.target_roles,
        min_salary_usd: prefs.min_salary_usd,
        locations: prefs.locations,
        remote_policy: prefs.remote_policy,
        aggressiveness: prefs.aggressiveness,
        safe_mode: prefs.safe_mode
      }, { onConflict: 'user_id' });

    if (error) {
      console.warn("Error saving preferences:", error.message);
      localStorage.setItem(`hunter_prefs_${userId}`, JSON.stringify(prefs));
    } else {
      // Also save to local storage as backup
      localStorage.setItem(`hunter_prefs_${userId}`, JSON.stringify(prefs));
    }
  } catch (e) {
    console.error("Error saving preferences:", e);
    localStorage.setItem(`hunter_prefs_${userId}`, JSON.stringify(prefs));
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
