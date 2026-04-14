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

    // ── Sequential fault-isolation probe (diag-v5) ──
    // Load each of App.tsx's direct imports one-by-one. Whichever probe
    // marker is the LAST to fire identifies the module whose body crashed
    // iOS Safari's JS stack during top-level evaluation.
    const probe = async (name: string, loader: () => Promise<unknown>) => {
      step(`probe:${name}:start`);
      await loader();
      step(`probe:${name}:ok`);
    };

    await probe("ui-sonner",       () => import("@/components/ui/sonner"));
    await probe("ui-tooltip",      () => import("@/components/ui/tooltip"));
    await probe("react-query",     () => import("@tanstack/react-query"));
    await probe("react-router",    () => import("react-router-dom"));
    await probe("helmet",          () => import("react-helmet-async"));
    await probe("scrolltotop",     () => import("@/components/ScrollToTop"));
    await probe("useAuth",         () => import("@/hooks/useAuth"));
    await probe("useGeo",          () => import("@/hooks/useGeo"));
    await probe("errorboundary",   () => import("@/components/ErrorBoundary"));
    await probe("page-index",      () => import("./pages/Index"));
    await probe("page-login",      () => import("./pages/Login"));
    await probe("page-signup",     () => import("./pages/SignUp"));
    await probe("page-onboarding", () => import("./pages/Onboarding"));
    await probe("page-dashboard",  () => import("./pages/Dashboard"));
    await probe("page-profile",    () => import("./pages/Profile"));
    await probe("page-privacy",    () => import("./pages/Privacy"));
    await probe("page-terms",      () => import("./pages/Terms"));
    await probe("page-forgot",     () => import("./pages/ForgotPassword"));
    await probe("page-reset",      () => import("./pages/ResetPassword"));
    await probe("page-verify",     () => import("./pages/EmailVerification"));
    await probe("page-notfound",   () => import("./pages/NotFound"));
    await probe("protected-route", () => import("./components/auth/ProtectedRoute"));
    await probe("public-route",    () => import("./components/auth/PublicRoute"));
    await probe("app-layout",      () => import("./layouts/AppLayout"));
    await probe("recruiter-layout",() => import("./layouts/RecruiterLayout"));
    await probe("admin-layout",    () => import("./layouts/AdminLayout"));
    await probe("require-admin",   () => import("./components/admin/RequireAdmin"));
    await probe("require-recruiter", () => import("./components/auth/RequireRecruiter"));
    await probe("page-recruiter-portal", () => import("./pages/RecruiterPortal"));
    await probe("page-recruiter-setup",  () => import("./pages/RecruiterSetup"));
    await probe("floating-theme", () => import("./components/FloatingThemeToggle"));
    await probe("cookie-consent", () => import("./components/CookieConsent"));
    await probe("command-palette",() => import("./components/CommandPalette"));
    await probe("footer",         () => import("./components/Footer"));
    await probe("env-validator",  () => import("./lib/env_validator"));
    await probe("db-health",      () => import("./lib/database_health"));
    await probe("mobile-safety",  () => import("./lib/mobile-safety"));
    await probe("page-loader",    () => import("./components/PageLoader"));
    await probe("mobile-init",    () => import("./mobile-app-init"));
    await probe("bottom-nav",     () => import("./components/mobile/BottomNavigation"));

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
