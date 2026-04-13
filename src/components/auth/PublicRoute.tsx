import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading: authLoading } = useAuth();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHasHydrated(true), 20);
    return () => clearTimeout(timer);
  }, []);

  if (authLoading || !hasHydrated) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // NOTE: Logic to redirect away from public pages if user is logged in
  // has been moved to AppGatekeeper in App.tsx for stability.
  return <>{children}</>;
};
