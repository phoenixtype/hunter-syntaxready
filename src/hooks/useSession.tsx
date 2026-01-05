import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface SessionState {
    session: Session | null;
    isValid: boolean;
    isRefreshing: boolean;
    expiresAt: number | null;
}

export const useSession = () => {
    const [state, setState] = useState<SessionState>({
        session: null,
        isValid: false,
        isRefreshing: false,
        expiresAt: null
    });

    // Check if session is about to expire (within 5 minutes)
    const isSessionExpiringSoon = useCallback((expiresAt: number | null): boolean => {
        if (!expiresAt) return true;
        const fiveMinutes = 5 * 60 * 1000;
        return Date.now() + fiveMinutes >= expiresAt * 1000;
    }, []);

    // Refresh session if needed
    const refreshSession = useCallback(async (): Promise<boolean> => {
        try {
            setState(prev => ({ ...prev, isRefreshing: true }));

            const { data, error } = await supabase.auth.refreshSession();

            if (error || !data.session) {
                console.error('[SESSION] Refresh failed:', error);
                setState({
                    session: null,
                    isValid: false,
                    isRefreshing: false,
                    expiresAt: null
                });
                return false;
            }

            setState({
                session: data.session,
                isValid: true,
                isRefreshing: false,
                expiresAt: data.session.expires_at || null
            });

            return true;
        } catch (err) {
            console.error('[SESSION] Refresh exception:', err);
            setState(prev => ({ ...prev, isRefreshing: false, isValid: false }));
            return false;
        }
    }, []);

    // Validate and refresh if needed
    const ensureValidSession = useCallback(async (): Promise<boolean> => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            setState({
                session: null,
                isValid: false,
                isRefreshing: false,
                expiresAt: null
            });
            return false;
        }

        // Check if session is expiring soon
        if (isSessionExpiringSoon(session.expires_at || null)) {
            console.log('[SESSION] Session expiring soon, refreshing...');
            return await refreshSession();
        }

        setState({
            session,
            isValid: true,
            isRefreshing: false,
            expiresAt: session.expires_at || null
        });

        return true;
    }, [isSessionExpiringSoon, refreshSession]);

    // Initialize and listen for auth changes
    useEffect(() => {
        // Get initial session
        ensureValidSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setState({
                session,
                isValid: !!session,
                isRefreshing: false,
                expiresAt: session?.expires_at || null
            });
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [ensureValidSession]);

    // Auto-refresh before expiry
    useEffect(() => {
        if (!state.expiresAt || !state.isValid) return;

        const timeUntilExpiry = (state.expiresAt * 1000) - Date.now();
        const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 0); // 5 min before expiry

        const timer = setTimeout(() => {
            console.log('[SESSION] Auto-refreshing session');
            refreshSession();
        }, refreshTime);

        return () => clearTimeout(timer);
    }, [state.expiresAt, state.isValid, refreshSession]);

    return {
        session: state.session,
        isValid: state.isValid,
        isRefreshing: state.isRefreshing,
        ensureValidSession,
        refreshSession
    };
};
