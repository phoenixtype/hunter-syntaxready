import { useEffect } from "react";
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
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, User, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { parseResume, CandidateProfile } from "@/lib/resume_engine";
import { getPreferences, UserPreferences } from "@/lib/user_preferences";
import { calculateVisibilityScore, VisibilityScore } from "@/lib/visibility_engine";
import { Progress } from "@/components/ui/progress";
import JobFeed from "@/components/JobFeed";
import ATSAudit from "@/components/ATSAudit";

import PostInterviewModal from "@/components/PostInterviewModal";
import PricingModal from "@/components/PricingModal";
import { getSubscription, SubscriptionTier, checkAccess, Feature } from "@/lib/subscription";
import { AgentActivityLog } from "@/components/AgentActivityLog";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<VisibilityScore | null>(null);
  const [showPostInterview, setShowPostInterview] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      toast.info("Parsing resume...");
      // Simulate parsing delay
      setTimeout(async () => {
        const parsed = await parseResume(file);
        setProfile(parsed);
        setUploading(false);
        toast.success("Resume parsed successfully");
      }, 2000);
    }
  };

  useEffect(() => {
    if (!user) {
      // If user is not logged in, redirect to login page
      if (!loading) { // Only redirect if we've finished initial loading check
        navigate("/login");
      }
      return;
    }

    // If user is logged in, fetch data
    const fetchData = async () => {
      try {
        // Load Preferences
        const prefs = await getPreferences(user.id);
        setPreferences(prefs);
        if (!prefs) {
          toast.info("Please complete your agent configuration.");
          navigate("/onboarding");
          return; // Stop further loading if onboarding is required
        }

        // Load Visibility Score
        const score = await calculateVisibilityScore();
        setVisibility(score);

        // Load Subscription
        const sub = await getSubscription();
        setSubscription(sub);

      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        toast.error("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate, loading]); // Added 'loading' to dependencies to ensure redirect logic works correctly

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const handleOpenInterviewTools = () => {
    // Gated Feature: Negotiation Coach
    if (checkAccess('negotiation_coach')) {
      setShowPostInterview(true);
    } else {
      setShowPricing(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Should be redirected by useEffect
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 selection:bg-primary selection:text-primary-foreground font-sans">
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="container max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">h.</div>
            <span className="font-bold tracking-tight">hunter.</span>
          </div>

          <div className="flex items-center gap-4">
            {subscription?.tier === SubscriptionTier.FREE && (
              <Button variant="default" size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 border-0" onClick={() => setShowPricing(true)}>
                Upgrade to Pro
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              Home
            </Button>
            <div className="h-6 w-px bg-border/50"></div>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 border border-white/10">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user?.email?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={() => signOut()} className="rounded-full w-8 h-8">
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="space-y-2 mb-12 animate-fade-in flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">Welcome to your Hunter AI dashboard</p>
            </div>
            {subscription && (
              <Badge variant="outline" className="font-mono uppercase tracking-widest text-[10px] py-1 px-3">
                Plan: {subscription.tier}
              </Badge>
            )}
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar / Stats */}
            <div className="lg:col-span-1 space-y-6">

              {/* Post Interview Tools Trigger - GATED */}
              <div className="relative group">
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                  onClick={handleOpenInterviewTools}
                >
                  Open Interview Tools
                </Button>
                {/* Lock Icon Overlay for Free Users */}
                {subscription?.tier === SubscriptionTier.FREE && (
                  <div className="absolute -top-1 -right-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">🔒</span>
                  </div>
                )}
              </div>

              {/* Upgrade Banner */}
              {subscription?.tier === SubscriptionTier.FREE && (
                <Card className="glass-card border-amber-500/20 bg-amber-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-500">
                      <TrendingUp className="w-5 h-5" /> Unlock Pro Features
                    </CardTitle>
                    <CardDescription>Upgrade for advanced tools like Negotiation Coach.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setShowPricing(true)}>
                      View Plans
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Visibility Agent Widget */}
              <Card className="glass-card border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5 text-primary" /> Visibility Score
                  </CardTitle>
                  <CardDescription>Market Signal Strength</CardDescription>
                </CardHeader>
                <CardContent>
                  {visibility ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center py-2">
                        <span className="text-4xl font-bold tracking-tighter text-foreground">{visibility.totalScore}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">/ 100 Points</span>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>ATS Pass Rate</span>
                            <span>{visibility.atsPassRate}%</span>
                          </div>
                          <Progress value={visibility.atsPassRate} className="h-2" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Recruiter Appeal</span>
                            <span>{visibility.recruiterAppeal}%</span>
                          </div>
                          <Progress value={visibility.recruiterAppeal} className="h-2" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Signal Strength</span>
                            <span>{visibility.signalStrength}%</span>
                          </div>
                          <Progress value={visibility.signalStrength} className="h-2" />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full text-xs h-8">
                        View Recommendations
                      </Button>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
                      Calculating Signal...
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resume Section */}
              <div className="glass-card rounded-2xl p-8 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">Resume Intelligence</h2>
                  <p className="text-sm text-muted-foreground">Upload your base resume to generate your Agent Profile.</p>
                </div>

                {!profile ? (
                  <div
                    className={`border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center transition-all hover:bg-muted/50 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <label className="cursor-pointer block">
                      <input type="file" className="hidden" accept=".pdf,.docx" onChange={handleFileUpload} />
                      <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm font-medium">Drop your resume here or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-2">PDF or DOCX (Max 5MB)</p>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-6 animate-scale-in">
                    <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-lg">
                      <FileText className="w-8 h-8 text-primary" />
                      <div>
                        <p className="font-medium">{profile.identity.name}</p>
                        <p className="text-xs text-muted-foreground">Parsed Profile Ready</p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Identified Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill) => (
                          <div key={skill.name} className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium">
                            {skill.name} <span className="opacity-50">{(skill.proficiency * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Experience Atoms</h3>
                      <div className="space-y-3">
                        {profile.experience_atoms.map((atom) => (
                          <div key={atom.id} className="p-3 rounded-lg bg-background/50 border border-border text-sm">
                            <div className="flex justify-between mb-1">
                              <span className="font-medium">{atom.role} @ {atom.company}</span>
                              <span className="text-muted-foreground text-xs">{atom.duration}</span>
                            </div>
                            <p className="text-muted-foreground/80">{atom.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <ATSAudit profile={profile} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content / Job Feed */}
            <div className="lg:col-span-3 space-y-6">

              {/* Trust Agent / Activity Log */}
              {profile && <AgentActivityLog />}

              {!profile ? (
                // Show placeholder or motivational card if no profile yet
                <div className="glass-card rounded-2xl p-8 bg-primary text-primary-foreground relative overflow-hidden">
                  <div className="relative z-10">
                    <h2 className="text-xl font-bold mb-2">Initialize Hunter</h2>
                    <p className="text-primary-foreground/80 text-sm mb-4">Upload your resume to unlock real-time job matching and discovery agents.</p>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                </div>
              ) : (
                // Show the Live Job Feed once profile exists
                <JobFeed profile={profile} />
              )}
            </div>
          </div>
        </div>
      </main>
      <PostInterviewModal
        isOpen={showPostInterview}
        onClose={() => setShowPostInterview(false)}
        companyName="TechFlow AI"
      />
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
      />
    </div>
  );
};

export default Dashboard;
