import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Briefcase,
  FileText,
  MessageSquare,
  Settings,
  LogOut,
  Bot,
  GraduationCap,
  FolderOpen,
  TrendingUp,
  PanelLeftClose,
  PanelLeft,
  Building2,
} from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useSubscription } from "@/hooks/useSubscription";
import { ProLockBadge } from "@/components/ProGate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useResume } from "@/hooks/useResume";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { id: "jobs",         label: "Jobs",    icon: Briefcase,  tab: "jobs" },
  { id: "applications", label: "Tracker", icon: FileText,   tab: "applications" },
  { id: "insights",     label: "Insights",icon: TrendingUp, tab: "insights" },
] as const;

const SIDEBAR_SECTIONS = [
  {
    label: "Apply",
    tools: [
      { icon: FileText,   title: "Resume",        route: "/resume-builder",       compact: "Resume",   proGated: false },
      { icon: FolderOpen, title: "Tailored",       route: "/tailored-resumes",    compact: "Tailored", proGated: true  },
      { icon: Building2,  title: "Apply Wizard",   route: "/application-wizard",  compact: "Wizard",   proGated: false },
    ],
  },
  {
    label: "Prepare",
    tools: [
      { icon: GraduationCap, title: "Interview",  route: "/interview-coach", compact: "Interview", proGated: true },
      { icon: MessageSquare, title: "Follow-up",  route: "/post-interview",  compact: "Follow-up", proGated: true },
    ],
  },
  {
    label: "Optimize",
    tools: [
      { icon: Bot, title: "Hunt Planner", route: "/auto-applier-settings", compact: "Planner", proGated: true },
    ],
  },
] as const;

const AppSidebar = () => {
  const navigate   = useNavigate();
  const { pathname, search } = useLocation();
  const { user, signOut } = useAuth();
  const { profile } = useResume();
  useRole(user?.id);
  const { isPro } = useSubscription();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { const v = localStorage.getItem("hunter_sidebar_collapsed"); return v === null ? true : v === "true"; } catch { return true; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("hunter_sidebar_collapsed", String(next)); } catch { /* */ }
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/");
  };

  const initials = profile?.identity?.name
    ? profile.identity.name.split(/\s+/).filter(Boolean).map(n => n[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?"
    : (user?.email?.charAt(0) ?? "").toUpperCase() || "?";

  // Active state helpers
  const dashTab = new URLSearchParams(search).get("tab") ?? "jobs";
  const isDashboard = pathname === "/dashboard";

  const isNavActive = (tab: string) => isDashboard && dashTab === tab;
  const isRouteActive = (route?: string) => !!route && pathname === route;

  const handleNavClick = (tab: string) => {
    navigate(tab === "jobs" ? "/dashboard" : `/dashboard?tab=${tab}`);
  };

  const handleToolClick = (route: string) => {
    navigate(route);
  };

  return (
    <aside
      className={`hidden sm:flex flex-col border-r border-border/30 bg-card/95 backdrop-blur-lg h-screen sticky top-0 z-30 shrink-0 transition-all duration-500 ease-out shadow-premium-sm ${
        collapsed ? "w-14" : "w-56"
      }`}
      style={{
        background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)/0.3) 100%)'
      }}
    >
      {/* ── Logo / collapse ─────────────────────────── */}
      <div
        className={`h-14 flex items-center border-b border-border/20 shrink-0 ${
          collapsed ? "justify-center px-3" : "justify-between px-4"
        }`}
      >
        {collapsed ? (
          <Link to="/" aria-label="Hunter Home">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-premium-md hover:shadow-premium-lg transition-all duration-300 hover:scale-105">
              <span className="text-primary-foreground font-bold text-lg leading-none">H</span>
            </div>
          </Link>
        ) : (
          <Link to="/" aria-label="Hunter Home" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-premium-md group-hover:shadow-premium-lg transition-all duration-300 group-hover:scale-105">
              <span className="text-primary-foreground font-bold text-lg leading-none">H</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-gradient">hunter</span>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── User info ───────────────────────────────── */}
      {!collapsed ? (
        <div className="px-4 py-2.5 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 ring-1 ring-border/30 shrink-0">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate leading-tight">
                {profile?.identity?.name || user?.email?.split("@")[0] || "Guest"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-2.5 border-b border-border/20 shrink-0">
          <Avatar className="h-7 w-7 ring-1 ring-border/30">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* ── Navigation ──────────────────────────────── */}
      <nav className="flex-1 px-2 py-2 space-y-2.5 overflow-y-auto" aria-label="App navigation">

        {/* Dashboard views */}
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item.tab);
            const btn = (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.tab)}
                aria-current={active ? "page" : undefined}
                className={`w-full flex items-center gap-2 rounded-lg text-xs font-medium transition-all duration-200 relative overflow-hidden group ${
                  collapsed ? "justify-center p-2" : "px-3 py-2"
                } ${
                  active
                    ? "bg-gradient-to-r from-primary/15 to-primary/10 text-primary font-semibold shadow-sm border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 font-medium"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && item.label}
              </button>
            );
            return collapsed ? (
              <Tooltip key={item.id} delayDuration={200}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : btn;
          })}
        </div>

        {/* Tool sections */}
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed ? (
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-1 mt-2">
                {section.label}
              </p>
            ) : (
              <div className="w-4 mx-auto border-t border-border/40 my-1.5" />
            )}
            <div className="space-y-0.5">
              {section.tools.map((tool) => {
                const active = isRouteActive(tool.route);
                const btn = (
                  <button
                    key={tool.title}
                    onClick={() => handleToolClick(tool.route)}
                    className={`w-full flex items-center gap-2 rounded-lg text-xs font-medium transition-all duration-200 relative overflow-hidden group ${
                      collapsed ? "justify-center p-2" : "px-3 py-2"
                    } ${
                      active
                        ? "bg-gradient-to-r from-primary/15 to-primary/10 text-primary font-semibold shadow-sm border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 font-medium"
                    }`}
                  >
                    <tool.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{tool.title}</span>
                    )}
                  {!collapsed && tool.proGated && !isPro && (
                    <ProLockBadge className="ml-auto shrink-0" />
                  )}
                  </button>
                );
                  return collapsed ? (
                    <Tooltip key={tool.title} delayDuration={200}>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="right">{tool.title}{tool.proGated && !isPro ? " (Pro)" : ""}</TooltipContent>
                    </Tooltip>
                  ) : btn;
              })}
            </div>
          </div>
        ))}
      </nav>


      {/* ── Footer actions ──────────────────────────── */}
      <div className="px-2 py-2.5 border-t border-border/20 space-y-0.5 shrink-0">
        {collapsed && (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={toggleCollapsed}
                className="w-full flex justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors mb-1"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        )}
        {collapsed ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/settings")}
                aria-current={pathname === "/settings" ? "page" : undefined}
                aria-label="Settings"
                className={`w-full flex justify-center p-2 rounded-md text-sm transition-colors ${pathname === "/settings" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"}`}
              >
                <Settings className="w-4 h-4 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => navigate("/settings")}
            aria-current={pathname === "/settings" ? "page" : undefined}
            aria-label="Settings"
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${pathname === "/settings" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 font-normal"}`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </button>
        )}
        {collapsed ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="w-full flex justify-center p-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors font-normal"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
