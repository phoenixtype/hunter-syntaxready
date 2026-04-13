import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Small delay to let the initial AuthListener settle
    const timer = setTimeout(() => setHasHydrated(true), 10);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !hasHydrated) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
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
