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
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-border bg-background">
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

        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">
            {profile?.identity?.name && profile.identity.name !== 'Unknown Candidate'
              ? `Welcome back, ${profile.identity.name.split(' ')[0]}`
              : 'Welcome back'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {appCount > 0
              ? `You have ${appCount} active application${appCount > 1 ? 's' : ''}`
              : 'Start your job search below'}
          </p>
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
              <TabsContent value="tools" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tools.map((tool) => (
                    <button
                      key={tool.title}
                      onClick={tool.action}
                      className="group text-left p-5 rounded-xl border border-border/50 bg-card hover:border-border hover:shadow-md transition-all duration-200 space-y-3"
                    >
                      <div className={`w-10 h-10 rounded-lg ${tool.bg} flex items-center justify-center`}>
                        <tool.icon className={`w-5 h-5 ${tool.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{tool.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{tool.desc}</p>
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
