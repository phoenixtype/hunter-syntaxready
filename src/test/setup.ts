import { afterEach as _afterEach } from 'vitest'
import { cleanup as _cleanup } from '@testing-library/react'
void _afterEach; void _cleanup;

// In-memory localStorage for tests — returns null for non-existent keys but
// actually stores values so that Supabase auth sessions persist within a test run.
const makeInMemoryStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

Object.defineProperty(global, 'localStorage', {
  value: makeInMemoryStorage(),
  writable: true
});

Object.defineProperty(global, 'sessionStorage', {
  value: makeInMemoryStorage(),
  writable: true
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
