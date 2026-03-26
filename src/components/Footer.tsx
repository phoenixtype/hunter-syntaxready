import { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";

/** Pages where the footer is suppressed (full-screen layouts with their own chrome) */
const HIDDEN_FOOTER_PATHS = [
  "/dashboard",
  "/interview-coach",
  "/resume-builder",
  "/application-wizard",
  "/auto-applier-settings",
  "/onboarding",
  "/tailored-resumes",
];
/** Prefixes: all sub-routes also suppress the footer */
const HIDDEN_FOOTER_PREFIXES = ["/recruiter", "/admin"];

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { pathname } = useLocation();

  if (
    HIDDEN_FOOTER_PATHS.includes(pathname) ||
    HIDDEN_FOOTER_PREFIXES.some((p) => pathname.startsWith(p))
  ) return null;

  return (
    /* MD3 Footer — thin divider, surface background, muted text */
    <footer ref={ref} className="border-t border-border bg-card/80 backdrop-blur-md mt-auto reveal" role="contentinfo">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md-1">
              <span className="text-primary-foreground font-bold text-xs leading-none">H</span>
            </div>
            <span className="font-medium text-sm text-foreground">Hunter</span>
          </div>

          {/* Legal links */}
          <nav className="flex gap-6 text-sm" aria-label="Footer navigation">
            <Link
              to="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors rounded-full px-2 py-1 hover:bg-muted"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-muted-foreground hover:text-foreground transition-colors rounded-full px-2 py-1 hover:bg-muted"
            >
              Terms
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Hunter AI
          </p>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
