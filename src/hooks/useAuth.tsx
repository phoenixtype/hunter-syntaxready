import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

try { (globalThis as { __HUNTER_STEP__?: (n: string) => void }).__HUNTER_STEP__?.('useAuth:body-start'); } catch { /* ignore */ }

interface SignUpResult {
  error: Error | null;
  data: { user: User | null; session: Session | null } | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentSession: Session | null = null;

    // 1. Set up listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Prevent infinite loops: only update if session actually changed
        if (session?.access_token !== currentSession?.access_token) {
          currentSession = session;
          setSession(session);
          setUser(session?.user ?? null);
        }
        setLoading(false);
      }
    );

    // 2. Initial seed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token !== currentSession?.access_token) {
        currentSession = session;
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string): Promise<SignUpResult> => {
    // Point to /verify-email so the token_hash in the confirmation link is handled
    // correctly by EmailVerification.tsx (supports both PKCE and implicit flows).
    const redirectUrl = `${window.location.origin}/verify-email`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { 
      error, 
      data: data ? { user: data.user, session: data.session } : null 
    };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out request failed (possibly offline):', err);
    } finally {
      setUser(null);
      setSession(null);
      // Clean up any cached user data
      try {
        localStorage.removeItem('hunter_dashboard_view');
      } catch { /* localStorage may be unavailable */ }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      signUp, 
      signIn, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
