import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { getUserRole, UserRole } from "@/lib/recruiter_engine";

/**
 * Returns the current user's role (candidate | recruiter | admin).
 * Defaults to "candidate" until the DB query resolves.
 */
export const useRole = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>("candidate");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    getUserRole(user.id).then((r) => {
      if (!cancelled) { setRole(r); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [user]);

  return { role, loading, isRecruiter: role === "recruiter", isAdmin: role === "admin" };
};
