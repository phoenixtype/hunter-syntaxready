import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Sparkles, Briefcase, FileText, LayoutGrid, Linkedin, Link2, MessageSquare, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import JobFeed from "@/components/JobFeed";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import { useResume } from "@/hooks/useResume";
import { SubscriptionTier, checkAccess } from "@/lib/subscription";
import { CandidateProfile } from "@/lib/resume_engine";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import PostInterviewModal from "@/components/PostInterviewModal";
import PricingModal from "@/components/PricingModal";
import JobUrlOptimizer from "@/components/JobUrlOptimizer";
import LinkedInOptimizer from "@/components/LinkedInOptimizer";
import { useSubscription } from "@/hooks/useSubscription";
import { useDashboardData } from "@/hooks/useDashboardData";
import WidgetErrorBoundary from "@/components/WidgetErrorBoundary";
import { ApplicationsView } from "@/components/ApplicationsView";
import PreferencesModal from "@/components/PreferencesModal";
import { Bot, Zap } from "lucide-react";

const Dashboard = () => {
  const { loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, loading: resumeLoading, setProfile } = useResume();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { preferences, appCount, visibility, isLoading: dataLoading } = useDashboardData();

  const [activeTab, setActiveTab] = useState("jobs");
  const [showPostInterview, setShowPostInterview] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showResumeOptimizer, setShowResumeOptimizer] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const handleOpenInterviewTools = () => {
    if (checkAccess('negotiation_coach')) {
      setShowPostInterview(true);
    } else {
      setShowPricing(true);
    }
  };

  const handleResumeUpload = (newProfile: CandidateProfile) => {
    navigate("/profile", { state: { pendingProfile: newProfile, mode: 'edit' } });
  };

  if (authLoading || resumeLoading || subLoading || dataLoading) {
    return <DashboardSkeleton />;
  }

  const tools = [
    {
      icon: Search,
      title: "Target Application",
      desc: "Paste a job link for a full application package",
      action: () => navigate("/application-wizard"),
      color: "text-foreground",
      bg: "bg-secondary",
    },
    {
      icon: Link2,
      title: "Resume Optimizer",
      desc: "Tailor your resume for a specific job URL",
      action: () => setShowResumeOptimizer(true),
      color: "text-foreground",
      bg: "bg-secondary",
    },
    {
      icon: Linkedin,
      title: "LinkedIn Optimizer",
      desc: "Get AI suggestions to improve your profile",
      action: () => setShowLinkedIn(true),
      color: "text-foreground",
      bg: "bg-secondary",
    },
    {
      icon: MessageSquare,
      title: "Post-Interview Tools",
      desc: "Thank-you notes & negotiation coaching",
      action: handleOpenInterviewTools,
      color: "text-foreground",
      bg: "bg-secondary",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <SkipLink />

      {/* Premium Header */}
      <header className="sticky top-0 w-full z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="container max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-foreground flex items-center justify-center text-background font-bold text-sm">h</div>
            <span className="font-semibold text-base hidden sm:inline">hunter</span>
          </Link>

          <div className="flex items-center gap-2">
            {subscription && subscription.tier !== SubscriptionTier.FREE ? (
              <Badge variant="secondary" className="text-xs">Pro</Badge>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setShowPricing(true)} className="text-xs h-8">
                Upgrade
              </Button>
            )}
            <ThemeToggle />
            <div className="lg:hidden">
              <MobileNav isAuthenticated={true} onSignOut={handleSignOut} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="container max-w-6xl mx-auto px-4 pt-20 pb-12">

        {/* Premium Welcome Hero */}
        <div className="mb-10 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 animate-fade-in-up">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              {profile?.identity?.name && profile.identity.name !== 'Unknown Candidate'
                ? `Welcome back, ${profile.identity.name.split(' ')[0]}`
                : 'Welcome to Hunter AI'} leading the charge
            </h1>
            <p className="text-muted-foreground text-lg">
              {appCount > 0
                ? `Tracking ${appCount} active application${appCount > 1 ? 's' : ''}.`
                : 'Your automated job search dashboard.'}
            </p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10 transition-all font-medium" onClick={() => navigate("/dashboard")}>
               <Zap className="w-4 h-4 mr-2" /> Sync LinkedIn
             </Button>
             <Button className="shadow-glow hover:shadow-glow-lg transition-all font-medium rounded-full px-6" onClick={() => navigate("/auto-applier-settings")}>
                <Bot className="w-4 h-4 mr-2" /> Configure Auto-Applier
             </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <DashboardSidebar
              profile={profile}
              visibility={visibility}
              preferences={preferences}
              onRefreshProfile={() => setProfile(null)}
              onUploadProfile={handleResumeUpload}
              onSignOut={handleSignOut}
              onEditPreferences={() => setShowPreferences(true)}
            />
          </div>

          {/* Main Content with Tabs */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-secondary/50 border border-border/50 p-1 h-auto">
                <TabsTrigger value="jobs" className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm gap-1.5 px-4 py-2">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Jobs</span>
                </TabsTrigger>
                <TabsTrigger value="applications" className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm gap-1.5 px-4 py-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Applications</span>
                  {appCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] flex items-center justify-center text-[10px] px-1.5">
                      {appCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tools" className="data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm gap-1.5 px-4 py-2">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tools</span>
                </TabsTrigger>
              </TabsList>

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="mt-0 space-y-4">
                <WidgetErrorBoundary>
                  <JobFeed profile={profile} preferences={preferences} />
                </WidgetErrorBoundary>
              </TabsContent>

              {/* Applications Tab */}
              <TabsContent value="applications" className="mt-0">
                <WidgetErrorBoundary>
                  <ApplicationsView />
                </WidgetErrorBoundary>
              </TabsContent>

              {/* Tools Tab */}
              <TabsContent value="tools" className="mt-0 animate-fade-in-up">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Automated Applier Card First Item */}
                  <button
                      onClick={() => navigate("/auto-applier-settings")}
                      className="group relative text-left p-6 rounded-2xl border border-primary/30 bg-card/40 backdrop-blur-md hover:border-primary/80 hover:shadow-glow transition-all duration-300 space-y-4 overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16 transition-all group-hover:bg-primary/20"></div>
                      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center relative z-10 border border-primary/30">
                        <Bot className="w-6 h-6 text-primary animate-pulse-slow" />
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">Auto-Applier Bot</h3>
                        <p className="text-sm text-muted-foreground mt-1">Configure your AI agent to mass-apply on LinkedIn while you sleep.</p>
                      </div>
                    </button>

                  {tools.map((tool) => (
                    <button
                      key={tool.title}
                      onClick={tool.action}
                      className="group text-left p-6 rounded-2xl border border-white/5 bg-card/40 backdrop-blur-md hover:border-white/20 hover:shadow-lg transition-all duration-300 space-y-4"
                    >
                      <div className={`w-12 h-12 rounded-xl ${tool.bg} flex items-center justify-center border border-white/10`}>
                        <tool.icon className={`w-6 h-6 ${tool.color}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground transition-colors">{tool.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{tool.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Quick tip */}
                {!profile && (
                  <div className="mt-4 p-4 rounded-lg bg-secondary border border-border text-sm text-muted-foreground">
                    <strong>Tip:</strong> Upload your resume from the sidebar to unlock all AI-powered tools.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PostInterviewModal
        isOpen={showPostInterview}
        onClose={() => setShowPostInterview(false)}
        companyName="Target Company"
        profile={profile}
      />
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
      />
      <JobUrlOptimizer
        isOpen={showResumeOptimizer}
        onClose={() => setShowResumeOptimizer(false)}
        profile={profile}
      />
      <LinkedInOptimizer
        isOpen={showLinkedIn}
        onClose={() => setShowLinkedIn(false)}
        profile={profile}
      />
      <PreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        preferences={preferences ?? null}
      />
    </div>
  );
};

export default Dashboard;
