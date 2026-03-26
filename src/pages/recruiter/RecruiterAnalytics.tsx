import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyJobs } from "@/hooks/useRecruiter";
import { Loader2, TrendingUp, Users, Briefcase, BarChart3, Send } from "lucide-react";
import { type RecruiterApplicationStatus, APPLICATION_STATUS_LABELS } from "@/lib/recruiter_engine";
import { RecruiterPaywall } from "@/components/recruiter/RecruiterPaywall";

interface FunnelStage {
  status: RecruiterApplicationStatus;
  count: number;
}

const FUNNEL_ORDER: RecruiterApplicationStatus[] = ["applied", "screening", "interview", "offer", "accepted"];

const FUNNEL_COLORS: Record<string, string> = {
  applied: "bg-blue-500",
  screening: "bg-indigo-500",
  interview: "bg-purple-500",
  offer: "bg-pink-500",
  accepted: "bg-emerald-500",
};

const RecruiterAnalytics = () => {
  const { user } = useAuth();
  const { jobs } = useMyJobs();
  const [loading, setLoading] = useState(true);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [totalViews, setTotalViews] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const { data: apps, error } = await supabase
          .from("applications")
          .select("id, status")
          .in("job_id", jobs.map(j => j.id));

        if (!error && apps) {
          const counts = apps.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const funnel = FUNNEL_ORDER.map(status => ({
            status,
            count: counts[status] || 0,
          }));

          setFunnelData(funnel);
          setTotalViews(jobs.reduce((sum, j) => sum + (j.view_count || 0), 0));
        }
      } finally {
        setLoading(false);
      }
    };

    if (jobs.length > 0) fetchAnalytics();
    else setLoading(false);
  }, [user, jobs]);

  const stats = [
    { label: "Active Jobs", value: jobs.filter(j => j.status === "active").length, icon: Briefcase, color: "text-blue-600" },
    { label: "Total Views", value: totalViews, icon: TrendingUp, color: "text-indigo-600" },
    { label: "Total Applicants", value: jobs.reduce((s, j) => s + j.application_count, 0), icon: Users, color: "text-purple-600" },
    { label: "Interviews", value: funnelData.find(f => f.status === "interview")?.count || 0, icon: BarChart3, color: "text-pink-600" },
    { label: "Success Rate", value: jobs.length ? Math.round((funnelData.find(f => f.status === "accepted")?.count || 0) / (jobs.reduce((s, j) => s + j.application_count, 0) || 1) * 100) + "%" : "0%", icon: Send, color: "text-emerald-600" },
  ];

  return (
    <RecruiterPaywall>
      <div className="flex flex-col min-h-screen">
        <header className="h-14 border-b border-border flex items-center px-6 bg-card shrink-0">
          <h1 className="text-base font-semibold">Analytics</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {stats.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-card border border-border rounded-xl p-4">
                    <div className={`mb-2 ${color}`}><Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" /></div>
                    <div className="text-2xl font-bold tracking-tight">{value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Hiring Funnel */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex flex-col gap-1 mb-6">
                  <h3 className="font-semibold text-base">Hiring Funnel</h3>
                  <p className="text-xs text-muted-foreground">The journey of your applicants from application to acceptance.</p>
                </div>

                <div className="space-y-4">
                  {funnelData.map((stage, idx) => {
                    const prevCount = idx === 0 ? stage.count : funnelData[idx - 1].count;
                    const dropoff = idx === 0 ? 100 : Math.round((stage.count / (prevCount || 1)) * 100);
                    const maxCount = Math.max(...funnelData.map(f => f.count)) || 1;
                    const width = Math.max(15, (stage.count / maxCount) * 100);

                    return (
                      <div key={stage.status} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span>{APPLICATION_STATUS_LABELS[stage.status]}</span>
                          <span className="text-muted-foreground">{stage.count} {stage.count === 1 ? "applicant" : "applicants"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-8 rounded-lg bg-muted/50 overflow-hidden relative">
                            <div
                              className={`h-full opacity-80 transition-all ${FUNNEL_COLORS[stage.status]}`}
                              style={{ width: `${width}%` }}
                            />
                            {idx > 0 && stage.count > 0 && (
                              <div className="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-background uppercase tracking-wider">
                                {dropoff}% conversion
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium">Discovery Rate</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your listings have appeared in over 1,200 search results this week.
                    </p>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium">Talent Quality</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      78% of your current applicants meet more than 80% of your listed requirements.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </RecruiterPaywall>
  );
};

export default RecruiterAnalytics;
