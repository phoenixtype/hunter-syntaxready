import { ArrowLeft, Menu, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { MobileDrawer } from "./MobileDrawer";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  showMenu?: boolean;
  showNotifications?: boolean;
  showSearch?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const MobileHeader = ({
  title,
  showBack = false,
  showMenu = true,
  showNotifications = true,
  showSearch = false,
  onBack,
  rightAction
}: MobileHeaderProps) => {
  const navigate = useNavigate();
  const [showDrawer, setShowDrawer] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          {/* Left side */}
          <div className="flex items-center gap-2">
            {showBack && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {showMenu && !showBack && (
              <Button variant="ghost" size="sm" onClick={() => setShowDrawer(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Title */}
          <h1 className="font-semibold text-lg truncate px-2">{title}</h1>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {showSearch && (
              <Button variant="ghost" size="sm">
                <Search className="h-5 w-5" />
              </Button>
            )}
            {showNotifications && (
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5" />
              </Button>
            )}
            {rightAction}
          </div>
        </div>
      </header>

      <MobileDrawer open={showDrawer} onClose={() => setShowDrawer(false)} />
    </>
  );
};