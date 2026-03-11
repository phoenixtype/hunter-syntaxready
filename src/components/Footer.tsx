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
  "/tailored-resumes"
];

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const { pathname } = useLocation();

  if (HIDDEN_FOOTER_PATHS.includes(pathname)) return null;

  return (
    <footer className="py-8 border-t border-border mt-auto" role="contentinfo">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-[10px]">H</span>
            </div>
            <span className="font-semibold text-sm">Hunter</span>
          </div>
          <nav className="flex gap-6 text-sm text-muted-foreground" aria-label="Footer navigation">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Hunter AI</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
