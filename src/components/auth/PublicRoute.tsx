import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Loader2 } from "lucide-react";

export const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isRecruiter, loading: roleLoading } = useRole();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Small delay to let initial Auth settle
    const timer = setTimeout(() => setHasHydrated(true), 10);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !hasHydrated || (user && roleLoading)) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    // Route recruiters to their dashboard, candidates to the applicant dashboard
    return <Navigate to={isRecruiter ? "/recruiter" : "/dashboard"} replace />;
  }

  return <>{children}</>;
};
