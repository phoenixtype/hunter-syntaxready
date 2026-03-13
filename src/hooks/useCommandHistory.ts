import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "command_palette_history";
const MAX_RECENT = 5;
const MAX_FREQUENT = 5;

interface CommandEntry {
  id: string;
  count: number;
  lastUsed: number;
}

const loadHistory = (): CommandEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("[HISTORY] Failed to load command history", e);
    return [];
  }
};

const saveHistory = (entries: CommandEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn("[HISTORY] Failed to save command history", e);
  }
};

export const useCommandHistory = () => {
  const [history, setHistory] = useState<CommandEntry[]>(loadHistory);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const recordUsage = useCallback((id: string) => {
    setHistory((prev) => {
      const existing = prev.find((e) => e.id === id);
      if (existing) {
        return prev.map((e) =>
          e.id === id ? { ...e, count: e.count + 1, lastUsed: Date.now() } : e
        );
      }
      return [...prev, { id, count: 1, lastUsed: Date.now() }];
    });
  }, []);

  const recentIds = [...history]
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, MAX_RECENT)
    .map((e) => e.id);

  const frequentIds = [...history]
    .sort((a, b) => b.count - a.count)
    .filter((e) => e.count >= 2)
    .slice(0, MAX_FREQUENT)
    .map((e) => e.id);

  return { recentIds, frequentIds, recordUsage };
};
