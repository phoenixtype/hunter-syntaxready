import { RecruiterPaywall } from "@/components/recruiter/RecruiterPaywall";

const FUNNEL_ORDER: RecruiterApplicationStatus[] = ["applied", "screening", "interview", "offer", "accepted"];
// ...
const RecruiterAnalytics = () => {
  // ...
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

              {/* ... remaining content ... */}
            </div>
          )}
        </main>
      </div>
    </RecruiterPaywall>
  );
};

export default RecruiterAnalytics;

const FUNNEL_COLORS: Record<string, string> = {
  applied: "bg-blue-500",
  screening: "bg-purple-500",
  interview: "bg-amber-500",
  offer: "bg-green-500",
  accepted: "bg-emerald-600",
};

const RecruiterAnalytics = () => {
  const { user } = useAuth();
  const { jobs, loading: jobsLoading } = useMyJobs();

  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [outreachCount, setOutreachCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || jobsLoading) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const jobIds = jobs.map(j => j.id);

        const [appsRes, outreachRes] = await Promise.all([
          jobIds.length > 0
            ? supabase.from("recruiter_job_applications").select("status").in("recruiter_job_id", jobIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from("recruiter_outreach" as never).select("id", { count: "exact", head: true }).eq("recruiter_id", user.id),
        ]);

        const apps = (appsRes.data ?? []) as { status: string }[];
        const countByStatus = apps.reduce<Record<string, number>>((acc, a) => {
          acc[a.status] = (acc[a.status] ?? 0) + 1;
          return acc;
        }, {});

        setFunnel(
          FUNNEL_ORDER.map(status => ({
            status,
            count: countByStatus[status] ?? 0,
          }))
        );

        setOutreachCount((outreachRes as unknown as { count: number }).count ?? 0);
      } catch {
        // Silent — analytics are non-critical
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, jobs, jobsLoading]);

  const totalApps = funnel.reduce((s, f) => s + f.count, 0);
  const maxCount = Math.max(...funnel.map(f => f.count), 1);

  const activeJobs = jobs.filter(j => j.status === "active").length;
  const totalJobsPosted = jobs.length;
  const offersExtended = (funnel.find(f => f.status === "offer")?.count ?? 0) + (funnel.find(f => f.status === "accepted")?.count ?? 0);

  const stats = [
    { label: "Jobs posted", value: totalJobsPosted, icon: Briefcase, color: "text-primary" },
    { label: "Active listings", value: activeJobs, icon: TrendingUp, color: "text-green-500" },
    { label: "Total applicants", value: totalApps, icon: Users, color: "text-amber-500" },
    { label: "Offers extended", value: offersExtended, icon: BarChart3, color: "text-emerald-500" },
    { label: "Outreach sent", value: outreachCount, icon: Send, color: "text-purple-500" },
  ];

  return (
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

            {/* Hiring funnel */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="mb-6">
                <h2 className="text-base font-semibold">Hiring funnel</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Applicant progression across all active jobs</p>
              </div>

              {totalApps === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No applicant data yet. Applications will appear here once candidates apply to your jobs.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {funnel.map(({ status, count }) => {
                    const pct = Math.round((count / maxCount) * 100);
                    const conversionPct = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0;
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0 text-right">
                          {APPLICATION_STATUS_LABELS[status]}
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${FUNNEL_COLORS[status]}`}
                            style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-8 text-right">{count}</span>
                        <span className="text-xs text-muted-foreground w-8">{conversionPct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Job performance table */}
            {jobs.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-base font-semibold">Job performance</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground">Job</th>
                      <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground">Applicants</th>
                      <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.slice(0, 10).map((job, i) => (
                      <tr key={job.id} className={`border-b border-border last:border-0 ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <td className="py-3 px-5 font-medium truncate max-w-[200px]">{job.title}</td>
                        <td className="py-3 px-5 text-right text-muted-foreground">{job.application_count}</td>
                        <td className="py-3 px-5 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            job.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            job.status === "filled" ? "bg-primary/10 text-primary" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default RecruiterAnalytics;
