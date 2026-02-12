import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface SessionState {
    session: Session | null;
    isValid: boolean;
    isRefreshing: boolean;
    expiresAt: number | null;
    lastRefreshAttempt: number | null;
    refreshAttempts: number;
}

// Mutex to prevent simultaneous refresh attempts
let refreshMutex = false;

export const useSession = () => {
    const [state, setState] = useState<SessionState>({
        session: null,
        isValid: false,
        isRefreshing: false,
        expiresAt: null,
        lastRefreshAttempt: null,
        refreshAttempts: 0
    });

    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check if session is about to expire (within 5 minutes)
    const isSessionExpiringSoon = useCallback((expiresAt: number | null): boolean => {
        if (!expiresAt) return true;
        const fiveMinutes = 5 * 60 * 1000;
        return Date.now() + fiveMinutes >= expiresAt * 1000;
    }, []);

    // Refresh session with mutex and exponential backoff
    const refreshSession = useCallback(async (): Promise<boolean> => {
        const now = Date.now();

        // Prevent multiple simultaneous refresh attempts
        if (refreshMutex) {
            console.log(`[SESSION ${new Date(now).toISOString()}] Refresh already in progress, skipping`);
            return false;
        }

        // Exponential backoff: don't retry too quickly
        if (state.lastRefreshAttempt && (now - state.lastRefreshAttempt) < 1000 * Math.pow(2, state.refreshAttempts)) {
            console.log(`[SESSION ${new Date(now).toISOString()}] Backoff period active, skipping refresh`);
            return false;
        }

        try {
            refreshMutex = true;
            setState(prev => ({
                ...prev,
                isRefreshing: true,
                lastRefreshAttempt: now,
                refreshAttempts: prev.refreshAttempts + 1
            }));

            console.log(`[SESSION ${new Date(now).toISOString()}] Starting refresh (attempt ${state.refreshAttempts + 1})`);

            const { data, error } = await supabase.auth.refreshSession();

            if (error || !data.session) {
                console.error(`[SESSION ${new Date(now).toISOString()}] Refresh failed:`, error?.message || 'No session returned');
                setState(prev => ({
                    ...prev,
                    session: null,
                    isValid: false,
                    isRefreshing: false,
                    expiresAt: null
                }));
                return false;
            }

            console.log(`[SESSION ${new Date(now).toISOString()}] ✅ Refresh successful, expires at:`, new Date(data.session.expires_at! * 1000).toISOString());

            setState({
                session: data.session,
                isValid: true,
                isRefreshing: false,
                expiresAt: data.session.expires_at || null,
                lastRefreshAttempt: now,
                refreshAttempts: 0 // Reset on success
            });

            return true;
        } catch (err) {
            console.error(`[SESSION ${new Date(now).toISOString()}] Refresh exception:`, err);
            setState(prev => ({ ...prev, isRefreshing: false, isValid: false }));
            return false;
        } finally {
            refreshMutex = false;
        }
    }, [state.lastRefreshAttempt, state.refreshAttempts]);

    // Validate and refresh if needed
    const ensureValidSession = useCallback(async (): Promise<boolean> => {
        const now = Date.now();
        console.log(`[SESSION ${new Date(now).toISOString()}] Validating session`);

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.log(`[SESSION ${new Date(now).toISOString()}] No session found`);
            setState({
                session: null,
                isValid: false,
                isRefreshing: false,
                expiresAt: null,
                lastRefreshAttempt: null,
                refreshAttempts: 0
            });
            return false;
        }

        // Check if session is expiring soon
        if (isSessionExpiringSoon(session.expires_at || null)) {
            console.log(`[SESSION ${new Date(now).toISOString()}] Session expiring soon, refreshing...`);
            return await refreshSession();
        }

        console.log(`[SESSION ${new Date(now).toISOString()}] Session valid until:`, new Date(session.expires_at! * 1000).toISOString());
        setState({
            session,
            isValid: true,
            isRefreshing: false,
            expiresAt: session.expires_at || null,
            lastRefreshAttempt: null,
            refreshAttempts: 0
        });

        return true;
    }, [isSessionExpiringSoon, refreshSession]);

    // Initialize and listen for auth changes
    useEffect(() => {
        // Get initial session
        ensureValidSession();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const now = Date.now();
            console.log(`[SESSION ${new Date(now).toISOString()}] Auth state changed:`, event);

            setState(prev => ({
                ...prev,
                session,
                isValid: !!session,
                isRefreshing: false,
                expiresAt: session?.expires_at || null,
                refreshAttempts: 0 // Reset on auth change
            }));
        });

        return () => {
            subscription.unsubscribe();
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [ensureValidSession]);

    // Auto-refresh before expiry
    useEffect(() => {
        if (!state.expiresAt || !state.isValid) {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
                refreshTimeoutRef.current = null;
            }
            return;
        }

        const timeUntilExpiry = (state.expiresAt * 1000) - Date.now();
        const refreshTime = Math.max(timeUntilExpiry - (5 * 60 * 1000), 0); // 5 min before expiry

        console.log(`[SESSION ${new Date().toISOString()}] Scheduling auto-refresh in ${Math.round(refreshTime / 1000)}s`);

        refreshTimeoutRef.current = setTimeout(() => {
            console.log(`[SESSION ${new Date().toISOString()}] Auto-refresh triggered`);
            refreshSession();
        }, refreshTime);

        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [state.expiresAt, state.isValid, refreshSession]);

    return {
        session: state.session,
        isValid: state.isValid,
        isRefreshing: state.isRefreshing,
        ensureValidSession,
        refreshSession
    };
};
