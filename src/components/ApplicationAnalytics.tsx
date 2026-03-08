import { useMemo } from "react";
import { ApplicationRecord } from "@/lib/application_engine";
import { TrendingUp, Send, MessageSquare, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { format, subWeeks, startOfWeek, isAfter, differenceInDays, parseISO } from "date-fns";

interface Props {
  applications: ApplicationRecord[];
}

const getStageOrder = (status: string): number => {
  const s = status.toLowerCase();
  if (s.includes("offer") || s.includes("accepted")) return 3;
  if (s.includes("interview") || s.includes("screening")) return 2;
  if (s.includes("reject") || s.includes("declined") || s.includes("failed")) return 4;
  return 1;
};

export default function ApplicationAnalytics({ applications }: Props) {
  const stats = useMemo(() => {
    const total = applications.length;
    if (total === 0) return null;

    const interviews = applications.filter(a => {
      const s = a.status.toLowerCase();
      return s.includes("interview") || s.includes("screening");
    }).length;

    const offers = applications.filter(a => {
      const s = a.status.toLowerCase();
      return s.includes("offer") || s.includes("accepted");
    }).length;

    const rejected = applications.filter(a => {
      const s = a.status.toLowerCase();
      return s.includes("reject") || s.includes("declined") || s.includes("failed");
    }).length;

    const responseRate = total > 0 ? Math.round(((interviews + offers + rejected) / total) * 100) : 0;
    const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0;
    const offerRate = interviews > 0 ? Math.round((offers / interviews) * 100) : 0;

    // Average days to interview
    const interviewApps = applications.filter(a => getStageOrder(a.status) >= 2 && a.applied_at);
    const avgDaysToResponse = interviewApps.length > 0
      ? Math.round(interviewApps.reduce((sum, a) => {
          try {
            return sum + Math.max(1, differenceInDays(new Date(), parseISO(a.applied_at)));
          } catch { return sum + 7; }
        }, 0) / interviewApps.length)
      : null;

    return { total, interviews, offers, rejected, responseRate, interviewRate, offerRate, avgDaysToResponse };
  }, [applications]);

  // Weekly velocity data (last 8 weeks)
  const weeklyData = useMemo(() => {
    const weeks: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i));
      const weekEnd = startOfWeek(subWeeks(new Date(), i - 1));
      const count = applications.filter(a => {
        try {
          const d = parseISO(a.applied_at);
          return isAfter(d, weekStart) && !isAfter(d, weekEnd);
        } catch { return false; }
      }).length;
      weeks.push({ week: format(weekStart, "MMM d"), count });
    }
    return weeks;
  }, [applications]);

  // Funnel data
  const funnelData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Applied", value: stats.total, fill: "hsl(var(--primary))" },
      { name: "Responded", value: stats.interviews + stats.offers + stats.rejected, fill: "hsl(var(--primary) / 0.7)" },
      { name: "Interview", value: stats.interviews + stats.offers, fill: "hsl(var(--primary) / 0.5)" },
      { name: "Offer", value: stats.offers, fill: "hsl(var(--primary) / 0.3)" },
    ].filter(d => d.value > 0);
  }, [stats]);

  if (!stats || stats.total === 0) return null;

  const metrics = [
    { icon: Send, label: "Total Applied", value: stats.total, suffix: "" },
    { icon: MessageSquare, label: "Response Rate", value: stats.responseRate, suffix: "%" },
    { icon: TrendingUp, label: "Interview Rate", value: stats.interviewRate, suffix: "%" },
    { icon: CheckCircle2, label: "Offer Rate", value: stats.offerRate, suffix: "%" },
  ];

  return (
    <div className="space-y-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4 text-center space-y-1">
            <m.icon className="w-4 h-4 text-primary mx-auto" />
            <div className="text-xl font-bold">{m.value}{m.suffix}</div>
            <div className="text-[10px] text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weekly Velocity */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Weekly Application Velocity</h4>
          </div>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} barSize={20}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  formatter={(v: number) => [`${v} apps`, 'Applied']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((_, i) => (
                    <Cell key={i} fill={i === weeklyData.length - 1 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.3)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Conversion Funnel</h4>
          </div>
          {funnelData.length >= 2 ? (
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" barSize={28}>
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
                  <RechartsTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
              Apply to more jobs to see your funnel
            </div>
          )}
          {stats.avgDaysToResponse && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Avg. time to response: <span className="font-semibold text-foreground">{stats.avgDaysToResponse} days</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
