import { CheckCircle2, ArrowRight, Sparkles, Target, Briefcase, Send, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CandidateProfile } from "@/lib/resume_engine";
import { ApplicationMetrics } from "@/lib/application_engine";
import { UserPreferences } from "@/lib/user_preferences";
import { useNavigate } from "react-router-dom";

interface Props {
  profile: CandidateProfile | null;
  preferences: UserPreferences | null;
  jobCount: number;
  appCount: number;
  metrics?: ApplicationMetrics;
  onSetView?: (view: "jobs" | "applications" | "tools" | "preferences") => void;
}

const DashboardWelcome = ({ profile, preferences, jobCount, appCount, metrics, onSetView }: Props) => {
  const navigate = useNavigate();

  const firstName = profile?.identity?.name?.split(' ')[0];

  const steps = [
    {
      icon: Sparkles,
      label: "Build your profile",
      done: !!profile?.identity?.name,
      action: () => navigate("/resume-builder"),
      cta: "Build Profile",
    },
    {
      icon: Target,
      label: "Set job preferences",
      done: !!(preferences?.target_roles?.length),
      action: () => onSetView?.("preferences"),
      cta: "Set Preferences",
    },
    {
      icon: Briefcase,
      label: "Discover jobs",
      done: jobCount > 0,
      action: () => onSetView?.("jobs"),
      cta: "Browse Jobs",
    },
    {
      icon: Send,
      label: "Apply to your first role",
      done: appCount > 0,
      action: () => onSetView?.("jobs"),
      cta: "Find a Role",
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;
  const nextStep = steps.find(s => !s.done);

  // All setup done — show compact metrics row
  if (allDone && metrics) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-3 border-b border-border mb-6 text-sm">
        <span className="text-muted-foreground">
          {firstName ? `Hi, ${firstName}` : "Dashboard"}
        </span>
        <div className="flex items-center gap-4 sm:gap-5 sm:ml-auto text-xs text-muted-foreground">
          <span><strong className="text-foreground font-semibold">{appCount}</strong> applied</span>
          <span><strong className="text-foreground font-semibold">{metrics.interviews}</strong> interviews</span>
          <span><strong className="text-foreground font-semibold">{metrics.offers}</strong> offers</span>
        </div>
      </div>
    );
  }

  if (allDone) return null;

  // Onboarding checklist
  return (
    <div className="border border-border rounded-md mb-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">Getting started</span>
        <span className="text-xs text-muted-foreground">{completedCount} / {steps.length} complete</span>
      </div>
      <div className="divide-y divide-border">
        {steps.map((step, i) => {
          const isNext = step === nextStep;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                step.done ? "text-muted-foreground" : isNext ? "text-foreground" : "text-muted-foreground/60"
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
              ) : (
                <Circle className="w-4 h-4 shrink-0" />
              )}
              <span className={step.done ? "line-through" : ""}>{step.label}</span>
              {isNext && step.action && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-6 text-xs px-2.5 rounded-sm"
                  onClick={step.action}
                >
                  {step.cta}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardWelcome;
