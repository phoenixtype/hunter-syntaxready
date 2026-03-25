import AppSidebar from "@/components/AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Persistent app shell for all authenticated pages.
 * Renders the collapsible sidebar alongside the page content.
 */
const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="flex min-h-screen bg-background text-foreground" data-hide-footer>
      <AppSidebar />

      {/* Page content — scrolls independently of the sticky sidebar */}
      <div className="flex-1 min-w-0 flex flex-col app-content">
        {children}
      </div>
    </div>
  );
};

export default AppLayout;
