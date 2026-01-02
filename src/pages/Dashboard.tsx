import { useEffect, useState } from "react";
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
import JobFeed from "@/components/JobFeed";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import { useResume } from "@/hooks/useResume";
import { getSubscription, SubscriptionTier, checkAccess } from "@/lib/subscription";
import { AgentActivityLog } from "@/components/AgentActivityLog";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import PostInterviewModal from "@/components/PostInterviewModal";
import PricingModal from "@/components/PricingModal";

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, loading: resumeLoading, refreshProfile, setProfile } = useResume();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [visibility, setVisibility] = useState<VisibilityScore | null>(null);
  const [showPostInterview, setShowPostInterview] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

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

        const [score, sub] = await Promise.all([
          calculateVisibilityScore(),
          getSubscription()
        ]);

        if (!isMounted) return;
        setVisibility(score);
        setSubscription(sub);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        if (isMounted) setDataLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [user, authLoading, navigate]);

  const handleOpenInterviewTools = () => {
    if (checkAccess('negotiation_coach')) {
      setShowPostInterview(true);
    } else {
      setShowPricing(true);
    }
  };

  if (authLoading || (dataLoading && !user)) return <DashboardSkeleton />;
  if (!user) return null;

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
            {/* PRO BADGE */}
            {subscription?.tier === SubscriptionTier.FREE ? (
              <Button size="sm" variant="gradient" onClick={() => setShowPricing(true)} className="hidden sm:flex text-xs h-8">
                Get Pro
              </Button>
            ) : (
              <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">PRO ACTIVE</Badge>
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
              value="12"
              trend="+3"
              color="blue"
            />
            <StatCard
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              label="Interviews"
              value="3"
              trend="2 soon"
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
              label="Response Rate"
              value="25%"
              trend="Top 10%"
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
      />
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
      />
    </div>
  );
};

// MINI COMPONENT FOR STATS
const StatCard = ({ icon, label, value, trend, color }: any) => (
  <Card className={`glass-card border-${color}-500/10 bg-${color}-500/5 hover:bg-${color}-500/10 transition-all`}>
    <CardContent className="p-4">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg bg-${color}-500/10`}>
          {icon}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-${color}-500/10 text-${color}-500`}>
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

export default Dashboard;