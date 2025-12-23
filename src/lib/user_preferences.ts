
import { supabase } from "@/integrations/supabase/client";

export interface UserPreferences {
  target_roles: string[];
  min_salary_usd: number;
  locations: string[];
  remote_policy: 'remote' | 'hybrid' | 'onsite' | 'any';
  aggressiveness: number; // 1-10 scale
}

const DEFAULT_PREFERENCES: UserPreferences = {
  target_roles: [],
  min_salary_usd: 100000,
  locations: [],
  remote_policy: 'any',
  aggressiveness: 5
};

export const getPreferences = async (userId: string): Promise<UserPreferences | null> => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.warn("Supabase error fetching preferences (may describe missing table):", error.message);
      // Fallback to local storage for demo/dev purposes if table is missing
      const local = localStorage.getItem(`hunter_prefs_${userId}`);
      return local ? JSON.parse(local) : null;
    }

    return data as UserPreferences;
  } catch (e) {
    console.error("Error in getPreferences:", e);
    return null;
  }
};

export const savePreferences = async (userId: string, prefs: UserPreferences): Promise<void> => {
  try {
    // Attempt Supabase save
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, ...prefs });

    if (error) {
      console.warn("Supabase error saving preferences (falling back to local):", error.message);
      localStorage.setItem(`hunter_prefs_${userId}`, JSON.stringify(prefs));
    }
  } catch (e) {
    console.error("Error saving preferences:", e);
    // Fallback
    localStorage.setItem(`hunter_prefs_${userId}`, JSON.stringify(prefs));
  }
};
