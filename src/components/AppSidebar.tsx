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
      { icon: FileText,      title: "Resume",      route: "/resume-builder", compact: "Resume" },
      { icon: FolderOpen,    title: "Tailored",    route: "/tailored-resumes", compact: "Tailored" },
    ],
  },
  {
    label: "Prepare",
    tools: [
      { icon: GraduationCap, title: "Interview",     route: "/interview-coach", compact: "Interview" },
      { icon: MessageSquare, title: "Follow-up",      route: "/post-interview", compact: "Follow-up" },
    ],
  },
  {
    label: "Optimize",
    tools: [
      { icon: Bot,           title: "Auto Apply",        route: "/auto-applier-settings", compact: "Auto" },
    ],
  },
] as const;

const AppSidebar = () => {
  const navigate   = useNavigate();
  const { pathname, search } = useLocation();
  const { user, signOut } = useAuth();
  const { profile } = useResume();
  const { isRecruiter } = useRole();
  const { isPro } = useSubscription();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("hunter_sidebar_collapsed") === "true"; } catch { return false; }
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
      className={`hidden sm:flex flex-col border-r border-border bg-card h-screen sticky top-0 z-30 shrink-0 transition-all duration-300 ${
        collapsed ? "w-[56px]" : "w-[220px]"
      }`}
    >
      {/* ── Logo / collapse ─────────────────────────── */}
      <div
        className={`h-12 flex items-center border-b border-border shrink-0 ${
          collapsed ? "justify-center px-2" : "justify-between px-3"
        }`}
      >
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
            <span className="text-base font-bold tracking-tight">hunter.ai</span>
          </Link>
        )}
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── User info ───────────────────────────────── */}
      {!collapsed ? (
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 ring-2 ring-border shrink-0">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate leading-tight">
                {profile?.identity?.name || user?.email?.split("@")[0] || "Guest"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-3 border-b border-border shrink-0">
          <Avatar className="h-8 w-8 ring-2 ring-border">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-primary/15 text-primary font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* ── Navigation ──────────────────────────────── */}
      <nav className="flex-1 px-1.5 py-2 space-y-3 overflow-y-auto" aria-label="App navigation">

        {/* Dashboard views */}
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item.tab);
            const btn = (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.tab)}
                aria-current={active ? "page" : undefined}
                className={`w-full flex items-center gap-1.5 rounded-md text-sm transition-colors ${
                  collapsed ? "justify-center p-2" : "px-3 py-2"
                } ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 font-normal"
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
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2.5 mb-1">
                {section.label}
              </p>
            ) : (
              <div className="w-6 mx-auto border-t border-border my-1" />
            )}
            <div className="space-y-0.5">
              {section.tools.map((tool) => {
                const active = isRouteActive(tool.route);
                const btn = (
                  <button
                    key={tool.title}
                    onClick={() => handleToolClick(tool.route)}
                    className={`w-full flex items-center gap-1.5 rounded-md text-sm transition-colors font-normal ${
                      collapsed ? "justify-center p-2" : "px-3 py-2"
                    } ${
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
                    }`}
                  >
                    <tool.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{tool.title}</span>
                    )}
                    {!collapsed && !isPro && (
                      <ProLockBadge className="ml-auto shrink-0" />
                    )}
                  </button>
                );
                return collapsed ? (
                  <Tooltip key={tool.title} delayDuration={200}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right">{tool.title}{!isPro ? " (Pro)" : ""}</TooltipContent>
                  </Tooltip>
                ) : btn;
              })}
            </div>
          </div>
        ))}
      </nav>


      {/* ── Footer actions ──────────────────────────── */}
      <div className="px-1.5 py-3 border-t border-border space-y-0.5 shrink-0">
        {collapsed && (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={toggleCollapsed}
                className="w-full flex justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors mb-1"
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
