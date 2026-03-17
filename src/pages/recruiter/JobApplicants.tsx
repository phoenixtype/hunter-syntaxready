import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Users, Mail, MapPin, Code2, Star, ChevronDown, Loader2, StickyNote, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useJobApplicants } from "@/hooks/useRecruiter";
import {
  getRecruiterJobById,
  updateRecruiterApplicationStatus,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  type RecruiterJob,
  type RecruiterApplication,
  type RecruiterApplicationStatus,
} from "@/lib/recruiter_engine";
import { formatDistanceToNow } from "date-fns";

const PIPELINE_STAGES: RecruiterApplicationStatus[] = [
  "applied", "screening", "interview", "offer", "accepted",
];

const REJECTION_STAGES: RecruiterApplicationStatus[] = ["rejected", "withdrawn"];

const MatchBadge = ({ score }: { score?: number }) => {
  if (score === undefined) return null;
  const color =
    score >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    score >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      <Star className="w-3 h-3" />{Math.round(score)}% match
    </span>
  );
};

const ApplicantCard = ({
  app,
  onStatusChange,
}: {
  app: RecruiterApplication;
  onStatusChange: (id: string, status: RecruiterApplicationStatus, notes?: string) => Promise<void>;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(app.recruiter_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const handleStatusChange = async (newStatus: RecruiterApplicationStatus) => {
    setChangingStatus(true);
    await onStatusChange(app.id, newStatus);
    setChangingStatus(false);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    await onStatusChange(app.id, app.status, notes);
    setSaving(false);
    toast.success("Notes saved");
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="p-4 flex items-start gap-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary/15 text-primary font-semibold text-sm flex items-center justify-center shrink-0">
          {(app.candidate_name ?? app.candidate_id).charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{app.candidate_name ?? "Anonymous Candidate"}</span>
            <MatchBadge score={app.match_score} />
            {app.is_auto_applied && (
              <Badge variant="outline" className="text-xs rounded-full text-primary border-primary/30">Auto-applied</Badge>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {app.candidate_email && (
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{app.candidate_email}</span>
            )}
            {app.candidate_location && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.candidate_location}</span>
            )}
            {app.candidate_experience_years && (
              <span>{app.candidate_experience_years}y exp</span>
            )}
            <span>{formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}</span>
          </div>

          {/* Skills preview */}
          {(app.candidate_skills ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(app.candidate_skills ?? []).slice(0, 5).map((s) => (
                <Badge key={s} variant="outline" className="text-[11px] rounded-full py-0">{s}</Badge>
              ))}
              {(app.candidate_skills ?? []).length > 5 && (
                <span className="text-[11px] text-muted-foreground">+{(app.candidate_skills ?? []).length - 5}</span>
              )}
            </div>
          )}
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-xs rounded-full font-normal ${APPLICATION_STATUS_COLORS[app.status]}`}>
            {APPLICATION_STATUS_LABELS[app.status]}
          </Badge>

          <Select
            value={app.status}
            onValueChange={(v) => handleStatusChange(v as RecruiterApplicationStatus)}
            disabled={changingStatus}
          >
            <SelectTrigger className="w-8 h-8 p-0 border-0 bg-transparent [&>span]:hidden rounded-full hover:bg-muted/60">
              {changingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : <ChevronDown className="w-3.5 h-3.5 mx-auto" />}
            </SelectTrigger>
            <SelectContent align="end">
              <p className="text-xs font-semibold px-2 py-1.5 text-muted-foreground uppercase tracking-wide">Move to stage</p>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</SelectItem>
              ))}
              <div className="border-t my-1" />
              {REJECTION_STAGES.map((s) => (
                <SelectItem key={s} value={s} className="text-destructive">{APPLICATION_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full w-8 h-8"
            title="Add notes / expand"
            onClick={() => setExpanded((v) => !v)}
          >
            <StickyNote className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded: cover letter + notes */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          {app.cover_letter && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cover Letter</p>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{app.cover_letter}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Code2 className="w-3 h-3" /> Skills on File
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(app.candidate_skills ?? []).map((s) => (
                <Badge key={s} variant="secondary" className="text-xs rounded-full">{s}</Badge>
              ))}
              {(app.candidate_skills ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">No skills on file</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recruiter Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add private notes about this candidate…"
              className="rounded-xl text-sm min-h-[80px]"
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-1.5 mt-2"
              onClick={handleSaveNotes}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Notes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const PipelineKanban = ({
  applicants,
  onStatusChange,
}: {
  applicants: RecruiterApplication[];
  onStatusChange: (id: string, status: RecruiterApplicationStatus, notes?: string) => Promise<void>;
}) => (
  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
    {PIPELINE_STAGES.map((stage) => {
      const stageApps = applicants.filter((a) => a.status === stage);
      return (
        <div key={stage} className="min-w-[240px] w-[240px] flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{APPLICATION_STATUS_LABELS[stage]}</span>
            <Badge variant="outline" className="text-xs rounded-full">{stageApps.length}</Badge>
          </div>
          <div className="space-y-2">
            {stageApps.map((app) => (
              <div key={app.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {(app.candidate_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{app.candidate_name ?? "Candidate"}</p>
                    <MatchBadge score={app.match_score} />
                  </div>
                </div>
                <Select value={app.status} onValueChange={(v) => onStatusChange(app.id, v as RecruiterApplicationStatus)}>
                  <SelectTrigger className="mt-2 h-7 text-xs rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...PIPELINE_STAGES, ...REJECTION_STAGES].map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">{APPLICATION_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {stageApps.length === 0 && (
              <div className="border-2 border-dashed border-border rounded-xl h-16 flex items-center justify-center">
                <span className="text-[11px] text-muted-foreground">Empty</span>
              </div>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

const JobApplicants = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { applicants, loading, refresh } = useJobApplicants(jobId ?? null);
  const [job, setJob] = useState<RecruiterJob | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");

  useEffect(() => {
    if (!jobId) return;
    getRecruiterJobById(jobId).then(setJob);
  }, [jobId]);

  const handleStatusChange = async (id: string, status: RecruiterApplicationStatus, notes?: string) => {
    try {
      await updateRecruiterApplicationStatus(id, status, notes);
      refresh();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const stageCounts = PIPELINE_STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = applicants.filter((a) => a.status === stage).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate("/recruiter/jobs")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold">{job?.title ?? "Applicants"}</h1>
            <p className="text-xs text-muted-foreground">{job?.company} · {applicants.length} applicants</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-border overflow-hidden">
            {(["list", "kanban"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Pipeline summary bar */}
        <div className="flex gap-3 flex-wrap">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage} className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold">{stageCounts[stage] ?? 0}</span>
              <span className="text-muted-foreground">{APPLICATION_STATUS_LABELS[stage]}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />)}
          </div>
        ) : applicants.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No applicants yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Once candidates apply (or auto-apply), their profiles will appear here.
            </p>
          </div>
        ) : view === "kanban" ? (
          <PipelineKanban applicants={applicants} onStatusChange={handleStatusChange} />
        ) : (
          <div className="space-y-3">
            {applicants.map((app) => (
              <ApplicantCard key={app.id} app={app} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default JobApplicants;
