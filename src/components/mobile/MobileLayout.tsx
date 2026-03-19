import { ReactNode } from "react";
import { MobileHeader } from "./MobileHeader";
import { BottomNavigation } from "./BottomNavigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  showBottomNav?: boolean;
  className?: string;
  headerProps?: {
    showMenu?: boolean;
    showNotifications?: boolean;
    showSearch?: boolean;
    rightAction?: ReactNode;
    onBack?: () => void;
  };
}

export const MobileLayout = ({
  children,
  title = "Hunter AI",
  showBack = false,
  showBottomNav = true,
  className = "",
  headerProps = {}
}: MobileLayoutProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (!isMobile) {
    // On desktop, use the existing layout
    return <div className={className}>{children}</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <MobileHeader
        title={title}
        showBack={showBack}
        {...headerProps}
      />

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto ${showBottomNav ? 'pb-20' : 'pb-4'} ${className}`}>
        <div className="container max-w-md mx-auto px-4 py-4">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && <BottomNavigation />}
    </div>
  );
};