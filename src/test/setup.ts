// import "@testing-library/jest-dom";

// Mock localStorage for Supabase tests
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => {},
    removeItem: (_key: string) => {},
    clear: () => {},
    length: 0,
    key: (_index: number) => null,
  },
  writable: true
});

// Mock sessionStorage
Object.defineProperty(global, 'sessionStorage', {
  value: {
    getItem: (key: string) => null,
    setItem: (key: string, value: string) => {},
    removeItem: (key: string) => {},
    clear: () => {},
    length: 0,
    key: (index: number) => null,
  },
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
