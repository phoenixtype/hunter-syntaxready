import { useState, useEffect, useRef } from "react";
import SEOHead from "@/components/SEOHead";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Briefcase, FileText, Search, User, Settings, Zap, Bot, GraduationCap, Bell, FolderOpen, TrendingUp, MoreHorizontal, LogOut, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import JobFeed from "@/components/JobFeed";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import DashboardWelcome from "@/components/DashboardWelcome";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import ReferralPanel from "@/components/ReferralPanel";
import { useResume } from "@/hooks/useResume";
import { upgradeToPro } from "@/lib/subscription";
import { useSubscription } from "@/hooks/useSubscription";
import { useGeo } from '@/hooks/useGeo';
import { PaystackCheckout } from '@/components/payment/PaystackCheckout';
import { useQueryClient } from "@tanstack/react-query";
import { useDashboardData } from "@/hooks/useDashboardData";
import WidgetErrorBoundary from "@/components/WidgetErrorBoundary";
import { ApplicationsView } from "@/components/ApplicationsView";
import NotificationSettings from "@/components/NotificationSettings";
import ProfilePanel from "@/components/ProfilePanel";
import PreferencesPanel from "@/components/PreferencesPanel";
import InsightsView from "@/components/InsightsView";
import VisibilityCoachModal from "@/components/VisibilityCoachModal";
import LinkedInOptimizer from "@/components/LinkedInOptimizer";
import PageTour, { PageTourHandle } from "@/components/PageTour";
import { HelpCircle } from "lucide-react";
import type { Step } from "react-joyride";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type DashboardView = "jobs" | "applications" | "insights" | "settings";

const JOBS_TOUR_STEPS: Step[] = [
  { target: '[data-tour="job-search"]', title: "Search jobs", content: "Type a role, skill, or company name to find matching positions.", disableBeacon: true },
  { target: '[data-tour="job-location"]', title: "Filter by location", content: "Enter a city, country, or 'Remote' to narrow results by location." },
  { target: '[data-tour="find-jobs-btn"]', title: "Find Jobs", content: "Crawls the web in real-time for fresh listings that match your profile." },
  { target: '[data-tour="job-filters"]', title: "Advanced filters", content: "Filter by work mode, experience level, salary range, job type, and date posted." },
  { target: '[data-tour="match-score"]', title: "Match score", content: "AI-calculated score showing how well this role fits your skills, experience, and preferences.", placement: "top" as const },
  { target: '[data-tour="job-card-actions"]', title: "Job details", content: "Click any job card to see the full description, salary insights, and apply directly." },
];
const VALID_DASHBOARD_VIEWS: DashboardView[] = ["jobs", "applications", "insights", "settings"];

// Track which tabs have been visited for lazy initialization.
// Uses useEffect (not render-time setState) to avoid illegal side effects during render
// and double-invocations in React StrictMode.
const useVisitedTabs = (activeView: DashboardView) => {
  const [visited, setVisited] = useState<Set<DashboardView>>(() => new Set([activeView]));
  useEffect(() => {
    setVisited(prev => {
      if (prev.has(activeView)) return prev;
      return new Set(prev).add(activeView);
    });
  }, [activeView]);
  return visited;
};

const NAV_ITEMS = [
  { id: "jobs" as const, label: "Jobs", icon: Briefcase },
  { id: "applications" as const, label: "Tracker", icon: FileText },
  { id: "insights" as const, label: "Insights", icon: TrendingUp },
];

// Tool shortcuts used only in the mobile "More" sheet
const MOBILE_SECTIONS = [
  {
    label: "Apply",
    tools: [
      { icon: FileText,      title: "Resume Builder",     route: "/resume-builder" },
      { icon: Search,        title: "Application Wizard", route: "/application-wizard" },
      { icon: FolderOpen,    title: "Tailored Resumes",   route: "/tailored-resumes" },
    ],
  },
  {
    label: "Prepare",
    tools: [
      { icon: GraduationCap, title: "Interview Coach",    route: "/interview-coach" },
    ],
  },
  {
    label: "Optimize",
    tools: [
      { icon: Bot,           title: "Hunt Planner",       route: "/auto-applier-settings" },
    ],
  },
] as const;

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading: resumeLoading } = useResume();
  const { currentSubscription: subscription, subscriptionLoading, canAccess: _canAccess, isPro } = useSubscription();
  const queryClient = useQueryClient();
  const { preferences, appCount, jobCount, visibility, skillRecommendations, metrics, isLoading: dataLoading } = useDashboardData();
  const jobsTourRef = useRef<PageTourHandle>(null);

  // activeView driven by URL ?tab= param so AppSidebar navigation works
  const [activeView, setActiveView] = useState<DashboardView>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as DashboardView;
    if (VALID_DASHBOARD_VIEWS.includes(tab)) return tab;
    const saved = localStorage.getItem("hunter_dashboard_view");
    return VALID_DASHBOARD_VIEWS.includes(saved as DashboardView) ? (saved as DashboardView) : "jobs";
  });

  // Sync when AppSidebar navigates via URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab") as DashboardView;
    if (tab && VALID_DASHBOARD_VIEWS.includes(tab)) {
      setActiveView(tab);
    } else if (!params.has("tab") && location.pathname === "/dashboard") {
      setActiveView("jobs");
    }
  }, [location.search, location.pathname]);

  useEffect(() => {
    localStorage.setItem("hunter_dashboard_view", activeView);
  }, [activeView]);

  // Settings sub-tab
  const [settingsTab, setSettingsTab] = useState<"profile" | "preferences" | "alerts" | "referrals">("profile");
  const visitedTabs = useVisitedTabs(activeView);
  const { isNigeria } = useGeo();
  const [showPaystack, setShowPaystack] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    // Handle checkout redirection success
    const params = new URLSearchParams(location.search);
    if (params.get('checkout') === 'success') {
      toast.success("Payment successful! Activating your Pro account...");
      
      // Poll a few times as the webhook might take a second
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        await queryClient.refetchQueries({
          queryKey: ['enhanced-subscription', user?.id]
        });

        // Get the latest data from the query cache instead of the stale closure variable
        const refreshedSubscription = queryClient.getQueryData(['enhanced-subscription', user?.id]) as { tier?: string } | undefined;
        
        if (refreshedSubscription?.tier === 'pro' || attempts > 15) {
          clearInterval(interval);
          if (refreshedSubscription?.tier === 'pro') {
            toast.success("hunter.ai Pro is now active! 🚀");
            navigate(location.pathname, { replace: true });
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate, queryClient, user?.id]); // location.pathname excluded — it would re-trigger the poll on every nav
  useRealtimeNotifications(user?.id);

  // Listen for navigation events from realtime alerts
  useEffect(() => {
    const handler = (e: Event) => {
      const view = (e as CustomEvent).detail as DashboardView;
      if (VALID_DASHBOARD_VIEWS.includes(view)) setActiveView(view);
    };
    window.addEventListener("hunter:navigate", handler);
    return () => window.removeEventListener("hunter:navigate", handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/");
  };

  if (authLoading || resumeLoading || subscriptionLoading || dataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col min-h-screen min-w-0">
      <SEOHead title="Dashboard" description="Manage your job search, applications, and AI tools." path="/dashboard" noIndex />
      <SkipLink />
        <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border h-14 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="sm:hidden flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shadow-sm">
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
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border rounded-md px-2.5 py-1.5 transition-colors"
            >
              <Search className="w-3 h-3" />
              <span>Search…</span>
              <kbd className="ml-1 pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">⌘K</kbd>
            </button>
            {isPro ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">Pro</Badge>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => {
                  if (isNigeria) {
                    setShowPaystack(true);
                  } else {
                    upgradeToPro('stripe');
                  }
                }} className="text-xs h-8 hidden sm:flex gap-1.5">
                  <Zap className="w-3 h-3" />
                  Upgrade to Pro
                </Button>
                {showPaystack && (
                  <PaystackCheckout
                    planName="pro"
                    interval="monthly"
                    onSuccess={() => {
                      setShowPaystack(false); // Assuming setShowPaystack is used to control visibility
                      window.location.href = '/dashboard?checkout=success';
                    }}
                    onClose={() => setShowPaystack(false)}
                  />
                )}
              </>
            )}
            <ThemeToggle />
            <div className="sm:hidden">
              <MobileNav isAuthenticated={true} onSignOut={handleSignOut} />
            </div>
          </div>
        </header>

        {/* Mobile Tab Bar — only on xs screens where sidebar is hidden */}
        <nav role="navigation" aria-label="Main navigation" className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background/95 backdrop-blur-md" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              aria-current={activeView === item.id ? "page" : undefined}
              onClick={() => {
                setActiveView(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-all relative ${
                activeView === item.id ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
            >
              <div className={`p-1.5 rounded-md transition-colors ${activeView === item.id ? "bg-muted" : ""}`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span>{item.label}</span>
              {activeView === item.id && (
                <div className="absolute bottom-0 w-10 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
          {/* More tab for mobile */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="More"
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-all ${
                  activeView === "settings" ? "text-primary" : "text-muted-foreground active:text-foreground"
                }`}
              >
                <div className={`p-1.5 rounded-md transition-colors ${activeView === "settings" ? "bg-muted" : ""}`}>
                  <MoreHorizontal className="w-5 h-5" />
                </div>
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-md pb-safe max-h-[70vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <div className="py-4 space-y-4">
                {/* Tool sections */}
                {MOBILE_SECTIONS.map((section) => (
                  <div key={section.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">{section.label}</p>
                    {section.tools.map((tool) => (
                      <button
                        key={tool.title}
                        onClick={() => { navigate(tool.route); setMoreOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
                      >
                        <tool.icon className="w-4 h-4 text-muted-foreground" /> {tool.title}
                      </button>
                    ))}
                  </div>
                ))}

                <div className="border-t border-border pt-3 space-y-1">
                  <button
                    onClick={() => { setActiveView("settings"); setSettingsTab("profile"); setMoreOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
                  >
                    <User className="w-4 h-4" /> Profile
                  </button>
                  <button
                    onClick={() => { setActiveView("settings"); setSettingsTab("preferences"); setMoreOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
                  >
                    <Settings className="w-4 h-4" /> Preferences
                  </button>
                  <button
                    onClick={() => { setActiveView("settings"); setSettingsTab("alerts"); setMoreOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
                  >
                    <Bell className="w-4 h-4" /> Alerts
                  </button>
                  <button
                    onClick={() => { setActiveView("settings"); setSettingsTab("referrals"); setMoreOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
                  >
                    <Gift className="w-4 h-4" /> Referrals
                  </button>
                  <button
                    onClick={() => { handleSignOut(); setMoreOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-destructive hover:bg-destructive/5 active:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </nav>

        {/* Content */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto pb-28 sm:pb-6">
          {/* Jobs - lazy init */}
          {visitedTabs.has("jobs") && (
            <div className={activeView !== "jobs" ? "hidden" : ""}>
              <WidgetErrorBoundary>
                <DashboardWelcome profile={profile} preferences={preferences ?? null} jobCount={jobCount} appCount={appCount} metrics={metrics} onSetView={(v) => setActiveView(v as DashboardView)} />
                <div className="mt-6 flex items-center justify-between mb-2">
                  <span />
                  <button
                    onClick={() => jobsTourRef.current?.start()}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title="Take a tour"
                  >
                    <HelpCircle className="w-3.5 h-3.5" /> Tour
                  </button>
                </div>
                <div className="mt-2">
                  <JobFeed profile={profile} preferences={preferences} />
                </div>
              </WidgetErrorBoundary>
              <PageTour
                ref={jobsTourRef}
                tourKey="dashboard_jobs"
                steps={JOBS_TOUR_STEPS}
              />
          </div>
          )}

          {/* Insights */}
          {visitedTabs.has("insights") && (
            <div className={activeView !== "insights" ? "hidden" : ""}>
              <WidgetErrorBoundary>
                <InsightsView
                  visibility={visibility}
                  skillRecommendations={skillRecommendations}
                  profile={profile}
                  onConsultCoach={() => setShowCoach(true)}
                  onOptimizeLinkedIn={() => setShowLinkedIn(true)}
                />

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
                <div className="flex gap-1 bg-muted/50 p-1 rounded-md border border-border w-full sm:w-fit overflow-x-auto">
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
                  <Button
                    variant={settingsTab === "alerts" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSettingsTab("alerts")}
                    className={`h-8 px-4 text-xs ${settingsTab === "alerts" ? "shadow-sm font-medium" : "text-muted-foreground"}`}
                  >
                    <Bell className="w-3.5 h-3.5 mr-1.5" />
                    Alerts
                  </Button>
                  <Button
                    variant={settingsTab === "referrals" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSettingsTab("referrals")}
                    className={`h-8 px-4 text-xs ${settingsTab === "referrals" ? "shadow-sm font-medium" : "text-muted-foreground"}`}
                  >
                    <Gift className="w-3.5 h-3.5 mr-1.5" />
                    Referrals
                  </Button>
                </div>

                {settingsTab === "profile" ? (
                  <ProfilePanel profile={profile} />
                ) : settingsTab === "preferences" ? (
                  <PreferencesPanel preferences={preferences ?? null} />
                ) : settingsTab === "referrals" ? (
                  <ReferralPanel />
                ) : (
                  <NotificationSettings />
                )}
              </div>
            </WidgetErrorBoundary>
          )}
        </main>

      <VisibilityCoachModal
        isOpen={showCoach}
        onClose={() => setShowCoach(false)}
        profile={profile}
        score={visibility ?? null}
        skillRecommendations={skillRecommendations || []}
        preferences={preferences}
      />

      <LinkedInOptimizer
        isOpen={showLinkedIn}
        onClose={() => setShowLinkedIn(false)}
        profile={profile}
      />

    </div>
  );
};

export default Dashboard;
