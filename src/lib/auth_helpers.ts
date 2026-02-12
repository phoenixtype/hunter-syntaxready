import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

/**
 * Ensures that a user has a corresponding row in public.profiles and public.user_preferences.
 * This is a "self-healing" function to handle cases where the database trigger might have failed
 * or for users created before the triggers were added.
 */
export async function ensureUserProfile(user: User) {
  if (!user) return;

  try {
    // 1. Check/Create Profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      console.log('[AUTH_HELPER] Profile missing, creating default profile for:', user.id);
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Hunter User',
          avatar_url: user.user_metadata?.avatar_url || '',
        });
      
      if (insertError) {
        console.error('[AUTH_HELPER] Failed to create default profile:', insertError);
      }
    }

    // 2. Check/Create Preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!prefs) {
      console.log('[AUTH_HELPER] Preferences missing, creating default preferences for:', user.id);
      const { error: insertError } = await supabase
        .from('user_preferences')
        .insert({
          user_id: user.id,
          target_roles: [],
          locations: [],
          remote_policy: 'any'
        });

        if (insertError) {
            console.error('[AUTH_HELPER] Failed to create default preferences:', insertError);
        }
    }
  } catch (error) {
    console.error('[AUTH_HELPER] Unexpected error in ensureUserProfile:', error);
  }
}
