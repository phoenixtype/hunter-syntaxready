import { useEffect, useState } from "react";
import AppSidebar from "@/components/AppSidebar";
import PostInterviewModal from "@/components/PostInterviewModal";
import LinkedInOptimizer from "@/components/LinkedInOptimizer";
import { useResume } from "@/hooks/useResume";

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Persistent app shell for all authenticated pages.
 * Renders the collapsible sidebar alongside the page content.
 * Hosts global modals (Post-Interview, LinkedIn Optimizer) so they
 * remain available regardless of which page is active.
 */
const AppLayout = ({ children }: AppLayoutProps) => {
  const { profile } = useResume();
  const [showPostInterview, setShowPostInterview] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);

  // Listen for modal triggers dispatched from AppSidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const modal = (e as CustomEvent<string>).detail;
      if (modal === "postInterview") setShowPostInterview(true);
      else if (modal === "linkedin") setShowLinkedIn(true);
    };
    window.addEventListener("hunter:modal", handler);
    return () => window.removeEventListener("hunter:modal", handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground" data-hide-footer>
      <AppSidebar />

      {/* Page content — scrolls independently of the sticky sidebar */}
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>

      {/* Global modals */}
      <PostInterviewModal
        isOpen={showPostInterview}
        onClose={() => setShowPostInterview(false)}
        companyName=""
        profile={profile}
      />
      <LinkedInOptimizer
        isOpen={showLinkedIn}
        onClose={() => setShowLinkedIn(false)}
        profile={profile}
      />
    </div>
  );
};

export default AppLayout;
