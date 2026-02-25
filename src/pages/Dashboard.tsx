import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Briefcase, FileText, Search, Link2, Linkedin, MessageSquare, User, Settings, LogOut, Loader2, ChevronRight, Zap, Bot, LayoutGrid, GraduationCap, Bell, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import JobFeed from "@/components/JobFeed";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import { useResume } from "@/hooks/useResume";
import { SubscriptionTier } from "@/lib/subscription";
import PostInterviewModal from "@/components/PostInterviewModal";
import PricingModal from "@/components/PricingModal";
import JobUrlOptimizer from "@/components/JobUrlOptimizer";
import LinkedInOptimizer from "@/components/LinkedInOptimizer";
import { useSubscription } from "@/hooks/useSubscription";
import { useDashboardData } from "@/hooks/useDashboardData";
import WidgetErrorBoundary from "@/components/WidgetErrorBoundary";
import { ApplicationsView } from "@/components/ApplicationsView";
import PreferencesModal from "@/components/PreferencesModal";
import NotificationSettings from "@/components/NotificationSettings";

type DashboardView = "jobs" | "applications" | "tools" | "notifications";

const NAV_ITEMS = [
  { id: "jobs" as const, label: "Jobs", icon: Briefcase },
  { id: "applications" as const, label: "Applications", icon: FileText },
  { id: "tools" as const, label: "Tools", icon: LayoutGrid },
  { id: "notifications" as const, label: "Alerts", icon: Bell },
];

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, loading: resumeLoading, setProfile } = useResume();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { preferences, appCount, visibility, isLoading: dataLoading } = useDashboardData();

  const [activeView, setActiveView] = useState<DashboardView>("jobs");
  const [showPostInterview, setShowPostInterview] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showResumeOptimizer, setShowResumeOptimizer] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

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

  const tools = [
    {
      icon: FileText,
      title: "Resume Builder",
      desc: "Build a polished, ATS-friendly resume",
      action: () => navigate("/resume-builder"),
      featured: true,
    },
    {
      icon: Bot,
      title: "Auto-Applier",
      desc: "Mass-apply to jobs while you sleep",
      action: () => navigate("/auto-applier-settings"),
    },
    {
      icon: Search,
      title: "Target Application",
      desc: "Paste a job link for a full application",
      action: () => navigate("/application-wizard"),
    },
    {
      icon: Link2,
      title: "Optimize for Job",
      desc: "Get a tailored resume & cover letter for any job",
      action: () => setShowResumeOptimizer(true),
    },
    {
      icon: Linkedin,
      title: "LinkedIn Optimizer",
      desc: "AI suggestions for your profile",
      action: () => setShowLinkedIn(true),
    },
    {
      icon: MessageSquare,
      title: "Post-Interview",
      desc: "Thank-you notes & negotiation",
      action: () => setShowPostInterview(true),
    },
    {
      icon: GraduationCap,
      title: "Interview Coach",
      desc: "AI-powered mock interviews",
      action: () => navigate("/interview-coach?title=Software+Engineer&company=Target+Company"),
    },
    {
      icon: FolderOpen,
      title: "My Tailored Resumes",
      desc: "View & download all your optimized resumes",
      action: () => navigate("/tailored-resumes"),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex" data-hide-footer>
      <SkipLink />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] border-r border-border bg-card h-screen sticky top-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">H</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Hunter</span>
          </Link>
        </div>

        {/* User Card */}
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {profile?.identity?.name || user?.email?.split('@')[0] || "Guest"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Dashboard navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeView === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.id === "applications" && appCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px] h-5 min-w-[20px] flex items-center justify-center px-1.5">
                  {appCount}
                </Badge>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="px-3 py-4 border-t border-border space-y-1">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
          <button
            onClick={() => setShowPreferences(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4" />
            Preferences
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            {/* Mobile logo */}
            <Link to="/" className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">H</span>
              </div>
            </Link>
            <h1 className="text-lg font-semibold hidden sm:block capitalize">{activeView}</h1>
          </div>

          <div className="flex items-center gap-2">
            {subscription?.tier !== SubscriptionTier.FREE && subscription?.tier ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Pro</Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowPricing(true)} className="text-xs h-8 hidden sm:flex">
                <Zap className="w-3 h-3 mr-1.5" />
                Upgrade
              </Button>
            )}
            <ThemeToggle />
            <div className="lg:hidden">
              <MobileNav isAuthenticated={true} onSignOut={handleSignOut} />
            </div>
          </div>
        </header>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden flex border-b border-border bg-background">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 ${
                activeView === item.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
          {/* Jobs View */}
          {activeView === "jobs" && (
            <WidgetErrorBoundary>
              <JobFeed profile={profile} preferences={preferences} />
            </WidgetErrorBoundary>
          )}

          {/* Applications View */}
          {activeView === "applications" && (
            <WidgetErrorBoundary>
              <ApplicationsView />
            </WidgetErrorBoundary>
          )}

          {/* Notifications View */}
          {activeView === "notifications" && (
            <WidgetErrorBoundary>
              <NotificationSettings />
            </WidgetErrorBoundary>
          )}
          {/* Tools View */}
          {activeView === "tools" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-semibold mb-1">AI Tools</h2>
                <p className="text-sm text-muted-foreground">Supercharge your job search with intelligent automation.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tools.map((tool) => (
                  <button
                    key={tool.title}
                    onClick={tool.action}
                    className={`group text-left p-5 rounded-xl border transition-all ${
                      tool.featured
                        ? "border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10"
                        : "border-border bg-card hover:border-primary/20 hover:shadow-sm"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                      tool.featured ? "bg-primary/20" : "bg-muted"
                    }`}>
                      <tool.icon className={`w-5 h-5 ${tool.featured ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <h3 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors">{tool.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                  </button>
                ))}
              </div>

              {!profile && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-sm text-muted-foreground">
                  <strong className="text-foreground">Tip:</strong> Build your resume to unlock all AI-powered tools.
                  <Link to="/resume-builder" className="text-primary font-medium ml-1 hover:underline">Build Resume →</Link>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <PostInterviewModal isOpen={showPostInterview} onClose={() => setShowPostInterview(false)} companyName="Target Company" profile={profile} />
      <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />
      <JobUrlOptimizer isOpen={showResumeOptimizer} onClose={() => setShowResumeOptimizer(false)} profile={profile} />
      <LinkedInOptimizer isOpen={showLinkedIn} onClose={() => setShowLinkedIn(false)} profile={profile} />
      <PreferencesModal isOpen={showPreferences} onClose={() => setShowPreferences(false)} preferences={preferences ?? null} />
    </div>
  );
};

export default Dashboard;
