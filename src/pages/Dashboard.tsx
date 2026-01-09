import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  CheckCircle2,
  TrendingUp,
  Clock,
  Home,
  LogOut,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getPreferences, UserPreferences } from "@/lib/user_preferences";
import { calculateVisibilityScore, VisibilityScore } from "@/lib/visibility_engine";
import { getApplicationCount } from "@/lib/application_engine";
import JobFeed from "@/components/JobFeed";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import { useResume } from "@/hooks/useResume";
import { getSubscription, SubscriptionTier, checkAccess, UserSubscription } from "@/lib/subscription";
import { AgentActivityLog } from "@/components/AgentActivityLog";
import { fetchLogsFromDatabase, setLoggerUserId } from "@/lib/activity_logger";
import { initializeLearningEngine } from "@/lib/learning_engine";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import PostInterviewModal from "@/components/PostInterviewModal";
import PricingModal from "@/components/PricingModal";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: string;
  color: string;
}

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, loading: resumeLoading, refreshProfile, setProfile } = useResume();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [visibility, setVisibility] = useState<VisibilityScore | null>(null);
  const [showPostInterview, setShowPostInterview] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [appCount, setAppCount] = useState(0);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  // Redirect unauthenticated users to login (useLayoutEffect to avoid React warning)
  useLayoutEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Fetch dashboard data
  useEffect(() => {
    if (authLoading || !user) return;
    let isMounted = true;

    const fetchData = async () => {
      setDataLoading(true);
      try {
        const prefs = await getPreferences(user.id);
        if (!isMounted) return;

        setPreferences(prefs);
        if (!prefs) {
          toast.info("Please complete your agent configuration.");
          navigate("/onboarding");
          return;
        }

        // Senior Dev Fix: Independent failure handling to prevent dashboard crash
        // 1. Critical User Data (Subscription & App Count)
        const subPromise = getSubscription().catch(err => {
          console.error("Failed to fetch subscription:", err);
          return null;
        });

        const countPromise = getApplicationCount(user.id).catch(err => {
          console.warn("Failed to fetch app count:", err);
          return 0;
        });

        // 2. Secondary Data (Visibility, Logs, Learning) - Fail silently usually
        const scorePromise = calculateVisibilityScore(profile).catch(err => {
          console.warn("Visibility calculation error:", err);
          return null;
        });

        // Side effects - don't block render on these
        fetchLogsFromDatabase(user.id).catch(e => console.error("Logger init error:", e));
        initializeLearningEngine(user.id).catch(e => console.error("Learning init error:", e));

        const [score, sub, count] = await Promise.all([
          scorePromise,
          subPromise,
          countPromise
        ]);

        setLoggerUserId(user.id);

        if (!isMounted) return;
        setVisibility(score);
        setSubscription(sub);
        setAppCount(count);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        if (isMounted) setDataLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [user, authLoading, navigate, profile]);

  const handleOpenInterviewTools = () => {
    if (checkAccess('negotiation_coach')) {
      setShowPostInterview(true);
    } else {
      setShowPricing(true);
    }
  };

  if (authLoading) return <DashboardSkeleton />;
  if (!user) return null; // Redirect handled by useLayoutEffect

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <SkipLink />

      {/* HEADER: Condensed & Action Oriented */}
      <header className="fixed top-0 w-full z-50 glass border-b border-border/40 backdrop-blur-xl bg-background/60">
        <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg shadow-primary/20">h.</div>
            <span className="font-bold tracking-tight text-lg hidden sm:inline">hunter.</span>
          </div>

          <div className="flex items-center gap-3">
            {/* PRO BADGE - Show if paid tier */}
            {subscription && subscription.tier !== SubscriptionTier.FREE ? (
              <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">PRO ACTIVE</Badge>
            ) : (
              <Button size="sm" onClick={() => setShowPricing(true)} className="hidden sm:flex text-xs h-8 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
                Get Pro
              </Button>
            )}

            <div className="h-6 w-px bg-border/50 hidden sm:block"></div>
            <ThemeToggle />

            {/* Mobile Menu */}
            <div className="lg:hidden">
              <MobileNav isAuthenticated={true} onSignOut={handleSignOut} />
            </div>
          </div>
        </div>
      </header>

      {/* LAYOUT GRID */}
      <div className="container max-w-7xl mx-auto px-4 pt-24 pb-12 flex gap-8">

        {/* LEFT SIDEBAR (Desktop Only) */}
        <DashboardSidebar
          profile={profile}
          visibility={visibility}
          preferences={preferences}
          onRefreshProfile={() => setProfile(null)}
          onUploadProfile={setProfile}
          onSignOut={handleSignOut}
        />

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 space-y-8">

          {/* STATS ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Briefcase className="w-4 h-4 text-blue-500" />}
              label="Active Apps"
              value={appCount.toString()}
              trend={appCount > 0 ? "LIVE" : "START"}
              color="blue"
            />
            {/* Removed Fake Interview Data for Audit Compliance */}
            {/* <StatCard
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              label="Interviews"
              value="0"
              trend="UPCOMING"
              color="emerald"
            /> */}
            {/* Real Data: Subscription Tier */}
            <StatCard
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              label="Plan"
              value={subscription?.tier === SubscriptionTier.PRO ? "PRO" : "FREE"}
              trend={subscription?.tier === SubscriptionTier.PRO ? "ACTIVE" : "UPGRADE"}
              color="emerald"
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4 text-purple-500" />}
              label="Match Score"
              value={visibility?.totalScore || 78}
              trend="High"
              color="purple"
            />
            <StatCard
              icon={<Clock className="w-4 h-4 text-amber-500" />}
              label="Avg Response"
              value="~3 Steps"
              trend="Typical"
              color="amber"
            />
          </div>

          {/* MAIN FEED */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* FEED COLUMN (2/3) */}
            <div className="xl:col-span-2 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold tracking-tight">Mission Control</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleOpenInterviewTools}>
                    Interview Tools
                  </Button>
                </div>
              </div>

              <JobFeed profile={profile} />
            </div>

            {/* RIGHT WIDGETS COLUMN (1/3) */}
            <div className="space-y-6">
              <AgentActivityLog />

              {/* TIP CARD */}
              <Card className="bg-gradient-to-br from-primary/10 to-purple-500/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Agent Tip</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Your visibility score is correlated with response rates. Improve your "Skills" section to boost match potential.
                  </p>
                  <Button variant="link" size="sm" className="px-0 text-primary text-xs mt-2">
                    Optimize Profile &rarr;
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

        </main>
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

// MINI COMPONENT FOR STATS
const StatCard = ({ icon, label, value, trend, color }: StatCardProps) => {
  // Map colors to actual Tailwind classes
  const colorClasses = {
    blue: {
      border: 'border-blue-500/10',
      bg: 'bg-blue-500/5 hover:bg-blue-500/10',
      iconBg: 'bg-blue-500/10',
      badge: 'bg-blue-500/10 text-blue-500'
    },
    emerald: {
      border: 'border-emerald-500/10',
      bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
      iconBg: 'bg-emerald-500/10',
      badge: 'bg-emerald-500/10 text-emerald-500'
    },
    purple: {
      border: 'border-purple-500/10',
      bg: 'bg-purple-500/5 hover:bg-purple-500/10',
      iconBg: 'bg-purple-500/10',
      badge: 'bg-purple-500/10 text-purple-500'
    },
    amber: {
      border: 'border-amber-500/10',
      bg: 'bg-amber-500/5 hover:bg-amber-500/10',
      iconBg: 'bg-amber-500/10',
      badge: 'bg-amber-500/10 text-amber-500'
    }
  };

  const classes = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue;

  return (
    <Card className={`glass-card ${classes.border} ${classes.bg} transition-all`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className={`p-2 rounded-lg ${classes.iconBg}`}>
            {icon}
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${classes.badge}`}>
            {trend}
          </span>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground font-medium">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard;