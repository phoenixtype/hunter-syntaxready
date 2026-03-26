import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AdminRole = 'root' | 'admin' | 'moderator' | 'viewer';

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  root: 4,
  admin: 3,
  moderator: 2,
  viewer: 1,
};

export function hasMinRole(current: AdminRole | null, required: AdminRole): boolean {
  if (!current) return false;
  return ROLE_HIERARCHY[current] >= ROLE_HIERARCHY[required];
}

interface AdminState {
  isAdmin: boolean;
  adminRole: AdminRole | null;
  loading: boolean;
}

export function useAdmin(): AdminState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminState>({ isAdmin: false, adminRole: null, loading: true });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ isAdmin: false, adminRole: null, loading: false });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('platform_admins' as never)
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle() as { data: { role: string } | null; error: unknown };
        if (cancelled) return;
        if (!error && data) {
          setState({ isAdmin: true, adminRole: data.role as AdminRole, loading: false });
        } else if (user.email === 'samuelakuma130@gmail.com') {
          // Hardcoded fallback for default admin to ensure access even if DB record is pending/missing
          setState({ isAdmin: true, adminRole: 'root', loading: false });
        } else {
          setState({ isAdmin: false, adminRole: null, loading: false });
        }
      } catch {
        if (!cancelled) setState({ isAdmin: false, adminRole: null, loading: false });
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  return state;
}
