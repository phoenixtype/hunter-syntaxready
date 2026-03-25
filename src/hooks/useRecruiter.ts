import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  getRecruiterProfile,
  getMyJobs,
  getJobApplicants,
  getRecruiterStats,
  RecruiterProfile,
  RecruiterJob,
  RecruiterApplication,
  RecruiterStats,
} from "@/lib/recruiter_engine";

export const useRecruiterProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const p = await getRecruiterProfile(user.id);
    setProfile(p);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setLoading(false); return; }
    setLoading(true);
    getRecruiterProfile(user.id).then((p) => {
      if (!cancelled) { setProfile(p); setLoading(false); }
    }).catch((err) => {
      console.error('Failed to fetch recruiter profile:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  return { profile, loading, refresh, setProfile };
};

export const useMyJobs = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getMyJobs(user.id);
    setJobs(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setLoading(false); return; }
    setLoading(true);
    getMyJobs(user.id).then((data) => {
      if (!cancelled) { setJobs(data); setLoading(false); }
    }).catch((err) => {
      console.error('Failed to fetch recruiter jobs:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  return { jobs, loading, refresh, setJobs };
};

export const useJobApplicants = (recruiterJobId: string | null) => {
  const [applicants, setApplicants] = useState<RecruiterApplication[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!recruiterJobId) return;
    setLoading(true);
    const data = await getJobApplicants(recruiterJobId);
    setApplicants(data);
    setLoading(false);
  }, [recruiterJobId]);

  useEffect(() => {
    if (!recruiterJobId) return;
    let cancelled = false;
    setLoading(true);
    getJobApplicants(recruiterJobId).then((data) => {
      if (!cancelled) { setApplicants(data); setLoading(false); }
    }).catch((err) => {
      console.error('Failed to fetch job applicants:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [recruiterJobId]);

  return { applicants, loading, refresh, setApplicants };
};

export const useRecruiterStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<RecruiterStats>({
    active_jobs: 0,
    total_applications: 0,
    total_interviews: 0,
    total_offers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getRecruiterStats(user.id).then((s) => {
      if (!cancelled) { setStats(s); setLoading(false); }
    }).catch((err) => {
      console.error('Failed to fetch recruiter stats:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  return { stats, loading };
};
