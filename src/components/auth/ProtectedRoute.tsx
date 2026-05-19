import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    // Small delay to let the initial AuthListener settle
    const timer = setTimeout(() => setHasHydrated(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Session timeout handling (24 hours)
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

    const checkSessionTimeout = () => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT) {
        // Session expired, redirect to login
        localStorage.removeItem('app_session');
        window.location.href = '/login?reason=session_expired';
      }
    };

    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Check session timeout periodically
    const interval = setInterval(checkSessionTimeout, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
    };
  }, [lastActivity]);

  if (loading || !hasHydrated) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background" role="status" aria-label="Loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect to login but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
