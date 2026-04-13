import { useState, useEffect } from "react";
import { getUserRole, UserRole } from "@/lib/recruiter_engine";

/**
 * Returns the role for a specific userId (candidate | recruiter | admin).
 * Defaults to "candidate" until the DB query resolves.
 */
export const useRole = (userId?: string) => {
  const [role, setRole] = useState<UserRole>("candidate");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { 
      setLoading(false); 
      setRole("candidate");
      return; 
    }
    
    let cancelled = false;
    setLoading(true);

    getUserRole(userId).then((r) => {
      if (!cancelled) { 
        setRole(r); 
        setLoading(false); 
      }
    }).catch((err) => {
      console.error('[ROLE] Failed to fetch user role:', err);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId]);

  return { role, loading, isRecruiter: role === "recruiter" || role === "admin", isAdmin: role === "admin" };
};
