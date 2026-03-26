import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Briefcase, Users, TrendingUp, Award, Plus, ChevronRight, Clock, Eye, Sparkles, Building2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRecruiterStats, useMyJobs, useRecruiterProfile } from "@/hooks/useRecruiter";
import { useSubscription } from "@/hooks/useSubscription";
import { useGeo } from '@/hooks/useGeo';
import { getStartingPrice } from '@/lib/pricing';
import { LOCATION_TYPE_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/lib/recruiter_engine";
import type { RecruiterJob } from "@/lib/recruiter_engine";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { RecruiterPaywall } from "@/components/recruiter/RecruiterPaywall";

const StatusDot = ({ status }: { status: RecruiterJob["status"] }) => {
  const colors: Record<RecruiterJob["status"], string> = {
    active:  "bg-green-500",
    draft:   "bg-gray-400",
    paused:  "bg-amber-500",
    closed:  "bg-red-400",
    filled:  "bg-blue-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />;
};

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) => (
  <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-md-1">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  </div>
);

const RecruiterDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { stats, loading: statsLoading } = useRecruiterStats();
  const { jobs, loading: jobsLoading } = useMyJobs();
  const { profile, loading: profileLoading } = useRecruiterProfile();
  const { currentSubscription: subscription, refetch: refetchSubscription } = useSubscription();
  const { currency } = useGeo();
 
  // Checkout success feedback
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Subscription activated! Welcome to hunter.ai Recruiter.");
      
      // Poll a few times to ensure the webhook has processed
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        const { data } = await refetchSubscription();
        if (data?.tier !== 'free' || attempts > 10) {
          clearInterval(interval);
          if (data?.tier !== 'free') {
            toast.success("Your recruiter plan is now active! 🚀");
            setSearchParams({});
          }
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [searchParams, setSearchParams, refetchSubscription]);

  const recentJobs = jobs.slice(0, 5);
  const activeJobCount = jobs.filter((j) => j.status === "active").length;
  const needsOnboarding = !profileLoading && !profile?.company_name;

  return (
    <RecruiterPaywall>
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
          <div>
            <h1 className="text-base font-semibold">Recruiter Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              {activeJobCount} active {activeJobCount === 1 ? "listing" : "listings"}
            </p>
          </div>
          <Button onClick={() => navigate("/recruiter/post-job")} className="rounded-full shadow-md-1 gap-2">
            <Plus className="w-4 h-4" />
            Post a Job
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Onboarding prompt — shown until company profile is filled */}
          {needsOnboarding && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Complete your company profile</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A complete profile helps candidates trust your listings and increases application rates by up to 3×.
                </p>
              </div>
              <Button size="sm" className="rounded-full shrink-0" onClick={() => navigate("/recruiter/company")}>
                Set up profile
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Listings" value={statsLoading ? "—" : stats.active_jobs}     icon={Briefcase}   color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
            <StatCard label="Total Applicants" value={statsLoading ? "—" : stats.total_applications} icon={Users}    color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
            <StatCard label="Interviews"       value={statsLoading ? "—" : stats.total_interviews} icon={TrendingUp} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
            <StatCard label="Offers Extended"  value={statsLoading ? "—" : stats.total_offers}    icon={Award}      color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          </div>

          {/* Recent jobs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Recent Listings</h2>
              <Button variant="ghost" size="sm" className="rounded-full text-xs gap-1 text-primary" onClick={() => navigate("/recruiter/jobs")}>
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {jobsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : recentJobs.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="font-medium">No job listings yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">Post your first job to start receiving applications from matched candidates.</p>
                <Button onClick={() => navigate("/recruiter/post-job")} className="rounded-full mt-1 gap-2">
                  <Plus className="w-4 h-4" /> Post your first job
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => navigate(`/recruiter/jobs/${job.id}`)}
                    className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/30 hover:shadow-md-1 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusDot status={job.status} />
                          <span className="font-medium text-sm truncate">{job.title}</span>
                          <Badge variant="outline" className="text-xs rounded-full">{LOCATION_TYPE_LABELS[job.location_type]}</Badge>
                          <Badge variant="outline" className="text-xs rounded-full">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{job.company} · {job.location || "No location"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-primary">{job.application_count}</p>
                        <p className="text-[11px] text-muted-foreground">applicants</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {job.view_count} views
                      </span>
                      <span className="ml-auto text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                        View applicants →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Quick actions */}
          <section>
            <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Post a new job", desc: "AI writes the description for you", icon: Sparkles, action: () => navigate("/recruiter/post-job") },
                { label: "Search talent", desc: "Find and reach out to matching candidates", icon: Users, action: () => navigate("/recruiter/candidates") },
                { label: "View all jobs", desc: "Manage listings and review applicants", icon: Briefcase, action: () => navigate("/recruiter/jobs") },
                { label: "Company profile", desc: "Update your info to attract top talent", icon: Building2, action: () => navigate("/recruiter/company") },
              ].map((qa) => (
                <button
                  key={qa.label}
                  onClick={qa.action}
                  className="bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/30 hover:shadow-md-1 transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center mb-3">
                    <qa.icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{qa.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{qa.desc}</p>
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    </RecruiterPaywall>
  );
};

export default RecruiterDashboard;
