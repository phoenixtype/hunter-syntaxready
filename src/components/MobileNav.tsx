import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, Home, LogIn, UserPlus, LayoutDashboard, User, Settings, FileText, GraduationCap, Bot, Search } from "lucide-react";
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
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10" aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px] p-0" aria-describedby="mobile-nav-desc">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div id="mobile-nav-desc" className="sr-only">Mobile navigation menu</div>

        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">H</span>
              </div>
              <span className="font-bold">Hunter</span>
            </div>
            <ThemeToggle />
          </div>

          <nav className="flex-1 p-3" aria-label="Mobile navigation">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-3 border-t border-border">
            {isAuthenticated ? (
              <Button variant="outline" className="w-full" onClick={() => { onSignOut?.(); setIsOpen(false); }}>
                Sign Out
              </Button>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full mb-2">Log In</Button>
                </Link>
                <Link to="/signup" onClick={() => setIsOpen(false)}>
                  <Button className="w-full">Get Started Free</Button>
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
