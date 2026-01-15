import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import JobFeed from "@/components/JobFeed";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import { useResume } from "@/hooks/useResume";
import { SubscriptionTier, checkAccess } from "@/lib/subscription";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import PostInterviewModal from "@/components/PostInterviewModal";
import PricingModal from "@/components/PricingModal";
import { useSubscription } from "@/hooks/useSubscription";
import { useDashboardData } from "@/hooks/useDashboardData";
import WidgetErrorBoundary from "@/components/WidgetErrorBoundary";

const Dashboard = () => {
  const { loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, loading: resumeLoading, setProfile } = useResume();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { preferences, appCount, visibility, isLoading: dataLoading } = useDashboardData();

  const [showPostInterview, setShowPostInterview] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

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

  // Consolidate loading state
  if (authLoading || resumeLoading || subLoading || dataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />

      {/* CLEAN HEADER */}
      <header className="fixed top-0 w-full z-50 border-b border-border/40 backdrop-blur-xl bg-background/80">
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

      {/* SIMPLE LAYOUT */}
      <div className="container max-w-6xl mx-auto px-4 pt-20 pb-12">

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-1">
            {profile?.identity?.name && profile.identity.name !== 'Unknown Candidate' ? `Welcome back, ${profile.identity.name.split(' ')[0]}` : 'Welcome back'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {appCount > 0
              ? `You have ${appCount} active application${appCount > 1 ? 's' : ''}`
              : 'Start your job search below'
            }
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar - Left */}
          <div className="lg:col-span-1 space-y-4">
            <DashboardSidebar
              profile={profile}
              visibility={visibility}
              preferences={preferences}
              onRefreshProfile={() => setProfile(null)}
              onUploadProfile={setProfile}
              onSignOut={handleSignOut}
            />
          </div>

          {/* Main Content - Right */}
          <div className="lg:col-span-3 space-y-6">

            {/* Job Feed Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Jobs for you</h2>
                <p className="text-xs text-muted-foreground">Matched based on your profile</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleOpenInterviewTools} className="text-xs">
                <Sparkles className="w-3 h-3 mr-1.5" />
                Interview Prep
              </Button>
            </div>

            {/* Job Feed */}
            <WidgetErrorBoundary>
              <JobFeed profile={profile} />
            </WidgetErrorBoundary>

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
    </div>
  );
};

export default Dashboard;