import "./index.css";

// Step-tracked, fault-isolated boot. Each phase is logged via __HUNTER_STEP__
// so the panic overlay can show exactly how far we got before crashing.
// Errors during module load or render are caught and reported with full
// stack info instead of relying on window.onerror (which strips location
// info on iOS Safari).
declare global {
  interface Window {
    __HUNTER_STEP__?: (name: string) => void;
    __HUNTER_PANIC__?: (info: {
      source: string;
      message: string;
      filename?: string;
      lineno?: number;
      colno?: number;
      stack?: string;
    }) => void;
  }
}

const step = (name: string) => {
  try { window.__HUNTER_STEP__?.(name); } catch { /* ignore */ }
};
const panic = (source: string, err: unknown) => {
  const e = err as Error;
  try {
    window.__HUNTER_PANIC__?.({
      source,
      message: e?.message || String(err),
      stack: e?.stack || '',
    });
  } catch { /* ignore */ }
};

step("main.tsx:loaded");

(async () => {
  try {
    step("main.tsx:importing-react");
    const [{ StrictMode, createElement }, { createRoot }] = await Promise.all([
      import("react"),
      import("react-dom/client"),
    ]);
    step("main.tsx:react-imported");

    step("main.tsx:importing-app");
    const { default: App } = await import("./App.tsx");
    step("main.tsx:app-imported");

    const rootEl = document.getElementById("root");
    if (!rootEl) throw new Error("#root element not found in DOM");
    step("main.tsx:root-found");

    const root = createRoot(rootEl);
    step("main.tsx:root-created");

    root.render(createElement(StrictMode, null, createElement(App)));
    step("main.tsx:render-called");
  } catch (err) {
    panic("main.tsx:boot", err);
    // eslint-disable-next-line no-console
    console.error("[HUNTER BOOT FAILURE]", err);
  }
})();
