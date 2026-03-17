import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Building2,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Plus,
  BarChart3,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useRecruiterProfile } from "@/hooks/useRecruiter";
import { toast } from "sonner";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",   icon: LayoutDashboard, route: "/recruiter" },
  { id: "my-jobs",   label: "My Jobs",     icon: Briefcase,       route: "/recruiter/jobs" },
  { id: "analytics", label: "Analytics",   icon: BarChart3,       route: "/recruiter/analytics" },
] as const;

const RecruiterSidebar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const { profile } = useRecruiterProfile();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("hunter_recruiter_sidebar_collapsed") === "true"; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("hunter_recruiter_sidebar_collapsed", String(next)); } catch { /* */ }
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/");
  };

  const companyName = profile?.company_name || user?.email?.split("@")[0] || "Company";
  const initials = companyName.split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "R";

  const isActive = (route: string) => pathname === route || (route !== "/recruiter" && pathname.startsWith(route));

  return (
    <aside
      className={`hidden sm:flex flex-col border-r border-border bg-card h-screen sticky top-0 z-30 shrink-0 transition-all duration-300 ${
        collapsed ? "w-[60px]" : "w-[240px]"
      }`}
    >
      {/* Logo / collapse */}
      <div className={`h-14 flex items-center border-b border-border shrink-0 ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
        {collapsed ? (
          <Link to="/" aria-label="Home">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md-1">
              <span className="text-primary-foreground font-bold text-sm leading-none">H</span>
            </div>
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md-1">
              <span className="text-primary-foreground font-bold text-sm leading-none">H</span>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">Hunter</span>
              <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Recruiter</span>
            </div>
          </Link>
        )}
        {!collapsed && (
          <button onClick={toggleCollapsed} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors" title="Collapse sidebar">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Company info */}
      {!collapsed ? (
        <div className="px-3 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 ring-2 ring-border shrink-0">
              <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate leading-tight">{companyName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-3 border-b border-border shrink-0">
          <Avatar className="h-8 w-8 ring-2 ring-border">
            <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Post Job CTA */}
      <div className={`${collapsed ? "flex justify-center py-2 px-1.5" : "px-2 py-2"} border-b border-border shrink-0`}>
        <button
          onClick={() => navigate("/recruiter/post-job")}
          title={collapsed ? "Post a Job" : undefined}
          className={`flex items-center gap-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-all hover:bg-primary/90 shadow-md-1 ${
            collapsed ? "p-2 justify-center" : "w-full px-3 py-2"
          }`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && "Post a Job"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-1.5 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.route);
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.route)}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`w-full flex items-center gap-2 rounded-md text-sm transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"} ${
                active ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-normal"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </button>
          );
        })}

        {/* Separator + company section */}
        <div className={`${collapsed ? "w-6 mx-auto" : "mx-2"} border-t border-border my-2`} />
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">Company</p>
        )}
        <button
          onClick={() => navigate("/recruiter/company")}
          title={collapsed ? "Company Profile" : undefined}
          aria-current={pathname === "/recruiter/company" ? "page" : undefined}
          className={`w-full flex items-center gap-2 rounded-md text-sm transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"} ${
            pathname === "/recruiter/company" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-normal"
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          {!collapsed && "Company Profile"}
        </button>
        <button
          onClick={() => navigate("/recruiter/candidates")}
          title={collapsed ? "Candidates" : undefined}
          aria-current={pathname.startsWith("/recruiter/candidates") ? "page" : undefined}
          className={`w-full flex items-center gap-2 rounded-md text-sm transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"} ${
            pathname.startsWith("/recruiter/candidates") ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-normal"
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          {!collapsed && "Candidates"}
        </button>
      </nav>

      {/* Footer */}
      <div className="px-1.5 py-3 border-t border-border space-y-0.5 shrink-0">
        {collapsed && (
          <button onClick={toggleCollapsed} title="Expand sidebar" className="w-full flex justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors mb-1">
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => navigate("/settings")}
          title={collapsed ? "Settings" : undefined}
          className={`w-full flex items-center gap-2 rounded-md text-sm transition-colors ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"} text-muted-foreground hover:text-foreground hover:bg-muted/60 font-normal`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && "Settings"}
        </button>
        <button
          onClick={handleSignOut}
          title={collapsed ? "Sign out" : undefined}
          className={`w-full flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors font-normal ${collapsed ? "justify-center p-2" : "px-2.5 py-1.5"}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
};

export default RecruiterSidebar;
