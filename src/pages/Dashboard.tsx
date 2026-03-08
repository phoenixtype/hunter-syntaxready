import { useState, useEffect } from "react";
import SEOHead from "@/components/SEOHead";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, FileText, Search, Linkedin, MessageSquare, User, Settings, LogOut, Zap, Bot, LayoutGrid, GraduationCap, Bell, FolderOpen, Sparkles, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion } from "framer-motion";
import JobFeed from "@/components/JobFeed";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import DashboardWelcome from "@/components/DashboardWelcome";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import { useResume } from "@/hooks/useResume";
import { SubscriptionTier } from "@/lib/subscription";
import PostInterviewModal from "@/components/PostInterviewModal";
import PricingModal from "@/components/PricingModal";
import LinkedInOptimizer from "@/components/LinkedInOptimizer";
import { useSubscription } from "@/hooks/useSubscription";
import { useDashboardData } from "@/hooks/useDashboardData";
import WidgetErrorBoundary from "@/components/WidgetErrorBoundary";
import { ApplicationsView } from "@/components/ApplicationsView";
import NotificationSettings from "@/components/NotificationSettings";
import ProfilePanel from "@/components/ProfilePanel";
import PreferencesPanel from "@/components/PreferencesPanel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type DashboardView = "jobs" | "applications" | "notifications" | "settings";
const VALID_DASHBOARD_VIEWS: DashboardView[] = ["jobs", "applications", "notifications", "settings"];

// Track which tabs have been visited for lazy initialization
const useVisitedTabs = (activeView: DashboardView) => {
  const [visited, setVisited] = useState<Set<DashboardView>>(new Set([activeView]));
  if (!visited.has(activeView)) {
    setVisited(prev => new Set(prev).add(activeView));
  }
  return visited;
};

const NAV_ITEMS = [
  { id: "jobs" as const, label: "Jobs", icon: Briefcase },
  { id: "applications" as const, label: "Tracker", icon: FileText },
  { id: "notifications" as const, label: "Alerts", icon: Bell },
];

type SidebarTool = {
  icon: typeof FileText;
  title: string;
  route?: string;
  modal?: "postInterview" | "linkedin";
};

const SIDEBAR_SECTIONS: { label: string; tools: SidebarTool[] }[] = [
  {
    label: "Apply",
    tools: [
      { icon: FileText, title: "Resume Builder", route: "/resume-builder" },
      { icon: Search, title: "Application Wizard", route: "/application-wizard" },
      { icon: FolderOpen, title: "Tailored Resumes", route: "/tailored-resumes" },
    ],
  },
  {
    label: "Prepare",
    tools: [
      { icon: GraduationCap, title: "Interview Coach", route: "/interview-coach" },
      { icon: MessageSquare, title: "Post-Interview", modal: "postInterview" },
    ],
  },
  {
    label: "Optimize",
    tools: [
      { icon: Linkedin, title: "LinkedIn Optimizer", modal: "linkedin" },
      { icon: Bot, title: "Hunt Planner", route: "/auto-applier-settings" },
    ],
  },
];

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, loading: resumeLoading } = useResume();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { preferences, appCount, jobCount, visibility, isLoading: dataLoading } = useDashboardData();

  const [activeView, setActiveView] = useState<DashboardView>(() => {
    const saved = localStorage.getItem("hunter_dashboard_view");
    return VALID_DASHBOARD_VIEWS.includes(saved as DashboardView) ? (saved as DashboardView) : "jobs";
  });

  // Settings sub-tab
  const [settingsTab, setSettingsTab] = useState<"profile" | "preferences">("profile");
  const visitedTabs = useVisitedTabs(activeView);

  useEffect(() => {
    localStorage.setItem("hunter_dashboard_view", activeView);
  }, [activeView]);
  const [showPostInterview, setShowPostInterview] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useRealtimeNotifications(user?.id);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/");
  };

  if (authLoading || resumeLoading || subLoading || dataLoading) {
    return <DashboardSkeleton />;
  }

  const initials = profile?.identity?.name
    ? profile.identity.name.split(' ').map(n => n[0]).join('').slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-background text-foreground flex" data-hide-footer>
      <SEOHead title="Dashboard" description="Manage your job search, applications, and AI tools." path="/dashboard" noIndex />
      <SkipLink />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[272px] border-r border-border bg-card h-screen sticky top-0">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-base">H</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Hunter</span>
          </Link>
        </div>

        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-border">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-primary/15 text-primary font-semibold text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate leading-tight">
                {profile?.identity?.name || user?.email?.split('@')[0] || "Guest"}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto" aria-label="Dashboard navigation">
          {/* Main nav */}
          <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeView === item.id
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${activeView === item.id ? "text-primary" : ""}`} />
              {item.label}
              {item.id === "applications" && appCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] h-5 min-w-[20px] flex items-center justify-center px-1.5 bg-primary/10 text-primary border-0">
                  {appCount}
                </Badge>
              )}
            </button>
          ))}
          </div>

          {/* Tool sections */}
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">{section.label}</p>
              <div className="space-y-0.5">
                {section.tools.map((tool) => (
                  <button
                    key={tool.title}
                    onClick={() => {
                      if (tool.route) navigate(tool.route);
                      else if (tool.modal === 'postInterview') setShowPostInterview(true);
                      else if (tool.modal === 'linkedin') setShowLinkedIn(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                  >
                    <tool.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate text-[13px]">{tool.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border space-y-0.5">
          <button
            onClick={() => setActiveView("settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeView === "settings"
                ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <Settings className={`w-4 h-4 shrink-0 ${activeView === "settings" ? "text-primary" : ""}`} />
            Settings
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border h-14 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="lg:hidden flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                <span className="text-primary-foreground font-bold text-sm">H</span>
              </div>
            </Link>
            <h1 className="text-base font-semibold hidden sm:block text-foreground/80">
              {NAV_ITEMS.find(n => n.id === activeView)?.label ?? (activeView === "settings" ? "Settings" : activeView)}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Search className="w-3 h-3" />
              <span>Search…</span>
              <kbd className="ml-1 pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">⌘K</kbd>
            </button>
            {subscription?.tier !== SubscriptionTier.FREE && subscription?.tier ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">Pro</Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowPricing(true)} className="text-xs h-8 hidden sm:flex gap-1.5">
                <Zap className="w-3 h-3" />
                Upgrade to Pro
              </Button>
            )}
            <ThemeToggle />
            <div className="lg:hidden">
              <MobileNav isAuthenticated={true} onSignOut={handleSignOut} />
            </div>
          </div>
        </header>

        {/* Mobile Tab Bar with More */}
        <nav role="navigation" aria-label="Main navigation" className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background/95 backdrop-blur-md safe-area-inset-bottom">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              aria-current={activeView === item.id ? "page" : undefined}
              onClick={() => {
                setActiveView(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 text-[10px] font-medium transition-all ${
                activeView === item.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${activeView === item.id ? "bg-primary/10" : ""}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="truncate">{item.label}</span>
              {activeView === item.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
            </button>
          ))}
          {/* More tab for mobile */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="More"
                className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 text-[10px] font-medium transition-all ${
                  activeView === "settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${activeView === "settings" ? "bg-primary/10" : ""}`}>
                  <MoreHorizontal className="w-5 h-5" />
                </div>
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-1">
                <button
                  onClick={() => { setActiveView("settings"); setSettingsTab("profile"); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted/70 transition-colors"
                >
                  <User className="w-4 h-4" /> Profile
                </button>
                <button
                  onClick={() => { setActiveView("settings"); setSettingsTab("preferences"); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted/70 transition-colors"
                >
                  <Settings className="w-4 h-4" /> Preferences
                </button>
                <button
                  onClick={() => { handleSignOut(); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </nav>

        {/* Content */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto pb-24 lg:pb-6">
          {/* Jobs - lazy init */}
          {visitedTabs.has("jobs") && (
            <div className={activeView !== "jobs" ? "hidden" : ""}>
              <WidgetErrorBoundary>
                <DashboardWelcome profile={profile} preferences={preferences ?? null} jobCount={jobCount} appCount={appCount} onSetView={(v) => setActiveView(v as DashboardView)} />
                <JobFeed profile={profile} preferences={preferences} />
              </WidgetErrorBoundary>
            </div>
          )}

          {/* Applications - lazy init */}
          {visitedTabs.has("applications") && (
            <div className={activeView !== "applications" ? "hidden" : ""}>
              <WidgetErrorBoundary>
                <ApplicationsView />
              </WidgetErrorBoundary>
            </div>
          )}

          {/* Settings (merged Profile + Preferences) */}
          {activeView === "settings" && (
            <WidgetErrorBoundary>
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold">Settings</h2>
                  <p className="text-sm text-muted-foreground">Manage your profile and job preferences.</p>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 bg-muted/50 p-1 rounded-lg border border-border/50 w-fit">
                  <Button
                    variant={settingsTab === "profile" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSettingsTab("profile")}
                    className={`h-8 px-4 text-xs ${settingsTab === "profile" ? "shadow-sm font-medium" : "text-muted-foreground"}`}
                  >
                    <User className="w-3.5 h-3.5 mr-1.5" />
                    Profile
                  </Button>
                  <Button
                    variant={settingsTab === "preferences" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSettingsTab("preferences")}
                    className={`h-8 px-4 text-xs ${settingsTab === "preferences" ? "shadow-sm font-medium" : "text-muted-foreground"}`}
                  >
                    <Settings className="w-3.5 h-3.5 mr-1.5" />
                    Preferences
                  </Button>
                </div>

                {settingsTab === "profile" ? (
                  <ProfilePanel profile={profile} />
                ) : (
                  <div className="max-w-lg space-y-1">
                    <PreferencesPanel preferences={preferences ?? null} />
                  </div>
                )}
              </div>
            </WidgetErrorBoundary>
          )}

          {/* Notifications */}
          {activeView === "notifications" && (
            <WidgetErrorBoundary>
              <NotificationSettings />
            </WidgetErrorBoundary>
          )}
        </main>
      </div>

      {/* Modals */}
      <PostInterviewModal isOpen={showPostInterview} onClose={() => setShowPostInterview(false)} companyName="" profile={profile} />
      <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />
      <LinkedInOptimizer isOpen={showLinkedIn} onClose={() => setShowLinkedIn(false)} profile={profile} />
    </div>
  );
};

export default Dashboard;
