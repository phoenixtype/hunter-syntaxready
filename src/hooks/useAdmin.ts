import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AdminState {
  isAdmin: boolean;
  adminRole: 'root' | 'admin' | null;
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
          setState({ isAdmin: true, adminRole: data.role as 'root' | 'admin', loading: false });
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
