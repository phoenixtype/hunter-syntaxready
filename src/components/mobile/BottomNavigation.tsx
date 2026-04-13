import { Home, Search, FileText, MessageSquare, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  {
    icon: Home,
    label: "Home",
    path: "/dashboard",
  },
  {
    icon: Search,
    label: "Jobs",
    path: "/application-wizard",
  },
  {
    icon: FileText,
    label: "Resume",
    path: "/resume-builder",
  },
  {
    icon: MessageSquare,
    label: "Coach",
    path: "/interview-coach",
  },
  {
    icon: User,
    label: "Profile",
    path: "/profile",
  },
];

export const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  // Hide on certain pages — /dashboard has its own bottom nav bar so suppress
  // the global one to avoid two stacked navbars on mobile.
  const hiddenPaths = ["/login", "/signup", "/onboarding", "/dashboard"];
  if (hiddenPaths.some(path => location.pathname.startsWith(path))) {
    return null;
  }

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom md:hidden">
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center min-w-0 flex-1 py-2 px-1 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "w-6 h-6 mb-1",
                  active ? "stroke-2" : "stroke-1.5"
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium truncate",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
      {/* Safe area for iPhone bottom */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
};