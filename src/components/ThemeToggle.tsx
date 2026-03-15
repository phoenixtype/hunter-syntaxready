import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * MD3-style theme toggle.
 * The no-flicker inline script in index.html sets the `dark` class on <html>
 * before React hydrates, so initial state reads directly from the DOM.
 */
const ThemeToggle = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Read the class set by the inline no-flicker script — works on first render.
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    // Only follow OS preference changes when the user has an explicit "dark"
    // preference stored — default is always light.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" && !e.matches) {
        // OS switched back to light while user had dark stored — respect stored
        setIsDark(true);
      }
      // No action otherwise; light is the app default.
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch (_) {}
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={`
        relative inline-flex h-8 w-14 items-center rounded-full border-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${isDark
          ? "bg-primary border-primary"
          : "bg-muted border-border"}
      `}
    >
      {/* MD3 Switch thumb */}
      <span
        className={`
          absolute flex h-6 w-6 items-center justify-center rounded-full shadow-md-1 transition-all duration-200
          ${isDark
            ? "translate-x-6 bg-primary-foreground"
            : "translate-x-0.5 bg-card border border-border"}
        `}
        aria-hidden="true"
      >
        {isDark
          ? <Moon className="h-3 w-3 text-primary" />
          : <Sun className="h-3 w-3 text-muted-foreground" />
        }
      </span>
    </button>
  );
};

export default ThemeToggle;
