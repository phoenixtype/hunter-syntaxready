import { useState, useCallback } from "react";

const STORAGE_KEY = "hunter_saved_jobs";

function loadSaved(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function persist(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* quota */
  }
}

export function useSavedJobs() {
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(loadSaved);

  const toggleSave = useCallback((jobId: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      persist(next);
      return next;
    });
  }, []);

  const isSaved = useCallback(
    (jobId: string) => savedJobIds.has(jobId),
    [savedJobIds]
  );

  return { savedJobIds, toggleSave, isSaved, savedCount: savedJobIds.size };
}
