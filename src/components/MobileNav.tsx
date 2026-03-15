import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Menu,
  Home,
  LogIn,
  UserPlus,
  LayoutDashboard,
  User,
  Settings,
  FileText,
  GraduationCap,
  Bot,
  Search,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface MobileNavProps {
  isAuthenticated?: boolean;
  onSignOut?: () => void;
}

const MobileNav = ({ isAuthenticated = false, onSignOut }: MobileNavProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const publicNavItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Log In", href: "/login", icon: LogIn },
    { label: "Sign Up", href: "/signup", icon: UserPlus },
  ];

  const authNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Profile", href: "/profile", icon: User },
    { label: "Resume Builder", href: "/resume-builder", icon: FileText },
    { label: "Interview Coach", href: "/interview-coach", icon: GraduationCap },
    { label: "Application Wizard", href: "/application-wizard", icon: Search },
    { label: "Auto-Applier", href: "/auto-applier-settings", icon: Bot },
  ];

  const navItems = isAuthenticated ? authNavItems : publicNavItems;
  const isActive = (href: string) => location.pathname === href;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* MD3 Icon button — Menu */}
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10 rounded-full hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-muted-foreground" />
        </Button>
      </SheetTrigger>

      {/* MD3 Navigation Drawer */}
      <SheetContent side="right" className="w-[300px] p-0 bg-card border-border" aria-describedby="mobile-nav-desc">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div id="mobile-nav-desc" className="sr-only">Mobile navigation menu</div>

        <div className="flex flex-col h-full">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md-1">
                <span className="text-primary-foreground font-bold text-sm leading-none">H</span>
              </div>
              <span className="font-medium text-foreground">Hunter</span>
            </div>
            <ThemeToggle />
          </div>

          {/* MD3 Nav list */}
          <nav className="flex-1 px-3 py-2 overflow-y-auto" aria-label="Mobile navigation">
            <ul className="space-y-0.5">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm transition-colors ${
                      isActive(item.href)
                        ? "bg-secondary text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive(item.href) ? "text-primary" : ""}`} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Drawer footer CTAs */}
          <div className="px-4 py-4 border-t border-border space-y-2">
            {isAuthenticated ? (
              <Button
                variant="outline"
                className="w-full rounded-full border-border"
                onClick={() => { onSignOut?.(); setIsOpen(false); }}
              >
                Sign Out
              </Button>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full rounded-full border-border">
                    Log In
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setIsOpen(false)}>
                  <Button className="w-full rounded-full shadow-md-1">
                    Get Started Free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
