import { useMemo } from "react";
import { ApplicationRecord } from "@/lib/application_engine";
import { TrendingUp, Send, MessageSquare, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  applications: ApplicationRecord[];
}

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

    return { total, interviews, offers, rejected, responseRate, interviewRate, offerRate };
  }, [applications]);

  if (!stats || stats.total === 0) return null;

  const metrics = [
    { icon: Send, label: "Total Applied", value: stats.total, suffix: "" },
    { icon: MessageSquare, label: "Response Rate", value: stats.responseRate, suffix: "%" },
    { icon: TrendingUp, label: "Interview Rate", value: stats.interviewRate, suffix: "%" },
    { icon: CheckCircle2, label: "Offer Rate", value: stats.offerRate, suffix: "%" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl border border-border bg-card/60 p-3 text-center space-y-1">
          <m.icon className="w-4 h-4 text-primary mx-auto" />
          <div className="text-xl font-bold">{m.value}{m.suffix}</div>
          <div className="text-[10px] text-muted-foreground">{m.label}</div>
        </div>
      ))}
    </div>
  );
}
