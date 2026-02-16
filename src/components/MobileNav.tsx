import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, X, Home, LogIn, UserPlus, LayoutDashboard, Settings } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface MobileNavProps {
  isAuthenticated?: boolean;
  onSignOut?: () => void;
}

const MobileNav = ({ isAuthenticated = false, onSignOut }: MobileNavProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const publicNavItems: NavItem[] = [
    { label: "Home", href: "/", icon: <Home className="w-5 h-5" /> },
    { label: "Log In", href: "/login", icon: <LogIn className="w-5 h-5" /> },
    { label: "Sign Up", href: "/signup", icon: <UserPlus className="w-5 h-5" /> },
  ];

  const authNavItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "Settings", href: "/onboarding", icon: <Settings className="w-5 h-5" /> },
  ];

  const navItems = isAuthenticated ? authNavItems : publicNavItems;

  const isActive = (href: string) => location.pathname === href;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10 touch-manipulation"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-[300px] sm:w-[350px] p-0"
        aria-describedby="mobile-nav-description"
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div id="mobile-nav-description" className="sr-only">
          Main navigation menu for mobile devices
        </div>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-foreground font-bold text-xl">
                h.
              </div>
              <span className="font-bold tracking-tight">hunter.</span>
            </div>
            <ThemeToggle />
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4" aria-label="Mobile navigation">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-4 px-4 py-4 rounded-lg transition-colors min-h-[56px] ${
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted active:bg-muted/80"
                    }`}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border space-y-3">
            {isAuthenticated ? (
              <Button
                variant="outline"
                className="w-full h-12 touch-manipulation"
                onClick={() => {
                  onSignOut?.();
                  setIsOpen(false);
                }}
              >
                Sign Out
              </Button>
            ) : (
              <Link to="/signup" onClick={() => setIsOpen(false)}>
                <Button className="w-full h-12 touch-manipulation">
                  Get Started Free
                </Button>
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
