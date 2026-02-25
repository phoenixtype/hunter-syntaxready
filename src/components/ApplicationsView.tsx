import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MoreHorizontal, MapPin, Calendar, ExternalLink, Briefcase } from "lucide-react";
import { getApplicationHistory, ApplicationRecord } from "@/lib/application_engine";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

type Stage = "applied" | "interview" | "offer" | "rejected";

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: "applied", label: "Applied", color: "bg-primary/10 text-primary border-primary/20" },
  { id: "interview", label: "Interview", color: "bg-warning/10 text-warning border-warning/20" },
  { id: "offer", label: "Offer", color: "bg-success/10 text-success border-success/20" },
  { id: "rejected", label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

const getStage = (status: string): Stage => {
  const s = status.toLowerCase();
  if (s.includes("interview") || s.includes("screening")) return "interview";
  if (s.includes("offer") || s.includes("accepted")) return "offer";
  if (s.includes("reject") || s.includes("failed") || s.includes("declined")) return "rejected";
  return "applied";
};

export const ApplicationsView = () => {
  const { session } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (session?.user?.id) {
        try {
          const history = await getApplicationHistory(session.user.id);
          setApplications(history);
        } catch (e) {
          console.error("Failed to load applications", e);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = STAGES.map(stage => ({
    ...stage,
    apps: applications.filter(app => getStage(app.status) === stage.id),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Applications</h2>
          <p className="text-sm text-muted-foreground">
            {applications.length > 0
              ? `Tracking ${applications.length} application${applications.length > 1 ? "s" : ""}`
              : "No applications yet. Start applying to jobs!"}
          </p>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">No applications yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Head to the Jobs tab to discover and apply to roles. Your applications will appear here.
          </p>
        </div>
      ) : (
        /* Kanban Board */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {grouped.map((stage) => (
            <div key={stage.id} className="space-y-3">
              {/* Column Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{stage.label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                    {stage.apps.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {stage.apps.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-lg border border-border bg-card hover:border-primary/20 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium truncate">{app.job_title}</h4>
                        <p className="text-xs text-muted-foreground truncate">{app.company}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {app.applied_at ? formatDistanceToNow(new Date(app.applied_at), { addSuffix: true }) : "Recently"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <Badge variant="outline" className={`text-[10px] ${stage.color}`}>
                        {app.status}
                      </Badge>
                      {app.job_url && (
                        <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {stage.apps.length === 0 && (
                  <div className="p-6 rounded-lg border border-dashed border-border text-center">
                    <p className="text-xs text-muted-foreground">No applications</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
