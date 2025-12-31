import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Briefcase,
  MapPin,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  MoreHorizontal,
  Search,
  Filter,
  Eye,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, Upload, FileText, Home } from "lucide-react";
import { toast } from "sonner";
import { parseResume, CandidateProfile } from "@/lib/resume_engine";
import { getPreferences, UserPreferences } from "@/lib/user_preferences";
import { calculateVisibilityScore, VisibilityScore } from "@/lib/visibility_engine";
import { Progress } from "@/components/ui/progress";
import JobFeed from "@/components/JobFeed";
import JobCrawler from "@/components/JobCrawler";
import ATSAudit from "@/components/ATSAudit";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import SkipLink from "@/components/SkipLink";
import { ResumeUpload } from "@/components/resume/ResumeUpload";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { useResume } from "@/hooks/useResume";
import PostInterviewModal from "@/components/PostInterviewModal";
import PricingModal from "@/components/PricingModal";
import { getSubscription, SubscriptionTier, checkAccess, Feature } from "@/lib/subscription";
import { AgentActivityLog } from "@/components/AgentActivityLog";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  // Fetch dashboard data once user is authenticated
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
        if (isMounted) {
          toast.error("Failed to load dashboard data.");
        }
      } finally {
        if (isMounted) {
          setDataLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, navigate]);

  const handleOpenInterviewTools = () => {
    if (checkAccess('negotiation_coach')) {
      setShowPostInterview(true);
    } else {
      setShowPricing(true);
    }
  };

  // Show skeleton while auth is loading
  if (authLoading) {
    return <DashboardSkeleton />;
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  // Show skeleton while data is loading
  if (dataLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-primary selection:text-primary-foreground font-sans">
      <SkipLink />

      {/* Navigation - Responsive */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10" role="navigation" aria-label="Dashboard navigation">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">h.</div>
              <span className="font-bold tracking-tight hidden sm:inline">hunter.</span>
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2 lg:gap-4">
            {subscription?.tier === SubscriptionTier.FREE && (
              <Button
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 border-0"
                onClick={() => setShowPricing(true)}
              >
                Upgrade to Pro
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="touch-manipulation">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <div className="h-6 w-px bg-border/50"></div>
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 border border-white/10">
                <AvatarImage src={user?.user_metadata?.avatar_url} alt={`${user?.email}'s avatar`} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user?.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="rounded-full w-8 h-8 touch-manipulation"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            {subscription?.tier === SubscriptionTier.FREE && (
              <Button
                variant="default"
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 border-0 text-xs px-3"
                onClick={() => setShowPricing(true)}
              >
                Upgrade
              </Button>
            )}
            <ThemeToggle />
            <MobileNav isAuthenticated={true} onSignOut={handleSignOut} />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="pt-20 sm:pt-24 pb-8 sm:pb-12">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="space-y-1 sm:space-y-2 mb-8 sm:mb-12 animate-fade-in flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Welcome to your Hunter AI dashboard</p>
            </div>
            {subscription && (
              <Badge variant="outline" className="font-mono uppercase tracking-widest text-[10px] py-1 px-3 self-start sm:self-auto">
                Plan: {subscription.tier}
              </Badge>
            )}
          </div>

          {/* Quick Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8 animate-fade-in">
            <Card className="glass-card border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all hover:scale-[1.02]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-500" />
                  Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-1">+3 this week</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all hover:scale-[1.02]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Interviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground mt-1">2 upcoming</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-all hover:scale-[1.02]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  Match Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{visibility?.totalScore || 78}</div>
                <p className="text-xs text-muted-foreground mt-1">Market visibility</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all hover:scale-[1.02]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Response Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">25%</div>
                <p className="text-xs text-muted-foreground mt-1">Above average</p>
              </CardContent>
            </Card>
          </div>

          {/* Grid - Responsive: Stack on mobile, sidebar on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Sidebar / Stats - Full width on mobile, 1/4 on desktop */}
            <div className="lg:col-span-1 space-y-4 sm:space-y-6 order-2 lg:order-1">

              {/* Post Interview Tools Trigger - GATED */}
              <div className="relative group">
                <Button
                  className="w-full h-12 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 touch-manipulation"
                  onClick={handleOpenInterviewTools}
                >
                  Open Interview Tools
                </Button>
                {subscription?.tier === SubscriptionTier.FREE && (
                  <div className="absolute -top-1 -right-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white" aria-label="Premium feature">🔒</span>
                  </div>
                )}
              </div>

              {/* Upgrade Banner */}
              {subscription?.tier === SubscriptionTier.FREE && (
                <Card className="glass-card border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 hover:from-amber-500/15 hover:to-orange-500/10 transition-all shadow-lg hover:shadow-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-amber-500">
                      <TrendingUp className="w-5 h-5" /> Unlock Pro Features
                    </CardTitle>
                    <CardDescription className="text-sm">Upgrade for advanced tools like Negotiation Coach.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" className="w-full h-10 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg hover:shadow-xl transition-all touch-manipulation" onClick={() => setShowPricing(true)}>
                      View Plans
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Visibility Agent Widget */}
              <Card className="glass-card border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5 text-primary" aria-hidden="true" /> Visibility Score
                  </CardTitle>
                  <CardDescription className="text-sm">Market Signal Strength</CardDescription>
                </CardHeader>
                <CardContent>
                  {visibility ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center py-2">
                        <span className="text-3xl sm:text-4xl font-bold tracking-tighter text-foreground">{visibility.totalScore}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">/ 100 Points</span>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>ATS Pass Rate</span>
                            <span>{visibility.atsPassRate}%</span>
                          </div>
                          <Progress value={visibility.atsPassRate} className="h-2" aria-label={`ATS Pass Rate: ${visibility.atsPassRate}%`} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Recruiter Appeal</span>
                            <span>{visibility.recruiterAppeal}%</span>
                          </div>
                          <Progress value={visibility.recruiterAppeal} className="h-2" aria-label={`Recruiter Appeal: ${visibility.recruiterAppeal}%`} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Signal Strength</span>
                            <span>{visibility.signalStrength}%</span>
                          </div>
                          <Progress value={visibility.signalStrength} className="h-2" aria-label={`Signal Strength: ${visibility.signalStrength}%`} />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full text-xs h-8 touch-manipulation">
                        View Recommendations
                      </Button>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground animate-pulse" role="status">
                      Calculating Signal...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Job Crawler Widget */}
              <JobCrawler />

              {/* Resume Section */}
              <div className="glass-card rounded-2xl p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-semibold">Resume Intelligence</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">Upload your base resume to generate your Agent Profile.</p>
                </div>

                {resumeLoading ? (
                  <DashboardSkeleton />
                ) : !profile ? (
                  <ResumeUpload onUploadComplete={setProfile} />
                ) : (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Active Profile: {profile.identity.name}</p>
                          <p className="text-xs text-muted-foreground">Last updated: Today</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setProfile(null)}
                        className="touch-manipulation text-muted-foreground hover:text-destructive"
                      >
                        Replace Resume
                      </Button>
                    </div>

                    <ResumePreview profile={profile} />
                  </div>
                )}
              </div>
            </div>

            {/* Main Content - 3/4 on desktop */}
            <div className="lg:col-span-3 space-y-6 sm:space-y-8 order-1 lg:order-2">
              <JobFeed profile={profile} />
              <AgentActivityLog />
            </div>
          </div>
        </div>
      </main>

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

export default Dashboard;