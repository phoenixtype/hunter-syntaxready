import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Sentry.init() intentionally NOT called here.
//
// Why: Sentry v8's `enabled: false` only short-circuits event sending — it
// does NOT prevent integrations from running. `browserTracingIntegration()`
// and `replayIntegration()` still install their monkey-patches on fetch,
// XHR, history, and DOM mutation observers, which triggered
// "RangeError: Maximum call stack size exceeded" at boot on iOS Safari /
// mobile Chrome. Without an explicit init, any `Sentry.captureException`
// calls elsewhere in the app become no-ops (safe).

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
