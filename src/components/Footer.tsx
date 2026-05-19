import { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";

/** Pages where the footer is suppressed (full-screen layouts with their own chrome) */
const HIDDEN_FOOTER_PATHS = [
  "/dashboard",
];
/** Prefixes: all sub-routes also suppress the footer */
const HIDDEN_FOOTER_PREFIXES = ["/admin"];

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { pathname } = useLocation();

  if (
    HIDDEN_FOOTER_PATHS.includes(pathname) ||
    HIDDEN_FOOTER_PREFIXES.some((p) => pathname.startsWith(p))
  ) return null;

  return (
    <footer ref={ref} className="border-t border-border bg-card/80 backdrop-blur-md mt-auto" role="contentinfo">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 SyntaxReady Inc. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <Link
              to="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;