import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Sparkles, Target, Briefcase, Send } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { UserPreferences } from "@/lib/user_preferences";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

interface Props {
  profile: CandidateProfile | null;
  preferences: UserPreferences | null;
  jobCount: number;
  appCount: number;
  onSetView?: (view: string) => void;
}

const DashboardWelcome = ({ profile, preferences, jobCount, appCount, onSetView }: Props) => {
  const navigate = useNavigate();

  const firstName = profile?.identity?.name?.split(' ')[0];

  const steps = [
    {
      icon: Sparkles,
      label: "Build your profile",
      benefit: "Unlock AI match scores on every job listing",
      done: !!profile?.identity?.name,
      action: () => navigate("/resume-builder"),
      cta: "Build Profile",
    },
    {
      icon: Target,
      label: "Set job preferences",
      benefit: "See only the roles that fit your goals and salary",
      done: !!(preferences?.target_roles?.length),
      action: () => onSetView?.("preferences") ?? navigate("/auto-applier-settings"),
      cta: "Set Preferences",
    },
    {
      icon: Briefcase,
      label: "Discover jobs",
      benefit: "Browse AI-curated listings matched to your skills",
      done: jobCount > 0,
      action: null,
      cta: null,
    },
    {
      icon: Send,
      label: "Apply to your first role",
      benefit: "Track every application in your personal pipeline",
      done: appCount > 0,
      action: null,
      cta: null,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;
  const nextStep = steps.find(s => !s.done);
  const progressPct = (completedCount / steps.length) * 100;

  if (allDone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/6 via-background to-background p-5 sm:p-6 mb-6 overflow-hidden relative"
    >
      {/* Decorative blob */}
      <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-primary/5 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-bold">
            {firstName ? `Welcome, ${firstName}` : "Get started with Hunter"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {completedCount === 0
              ? "Complete these steps to unlock your personalised job feed"
              : completedCount === 1
              ? "Great start — a few more steps to supercharge your search"
              : `Almost there — ${steps.length - completedCount} step${steps.length - completedCount > 1 ? "s" : ""} to go`}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center">
          <span className="text-2xl font-black text-primary leading-none">{Math.round(progressPct)}%</span>
          <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">done</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>

      {/* Steps */}
      <div className="grid sm:grid-cols-2 gap-2">
        {steps.map((step, i) => {
          const isNext = step === nextStep;
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl p-3 transition-all ${
                step.done
                  ? "bg-primary/5 border border-primary/10"
                  : isNext
                  ? "bg-card border border-border shadow-sm"
                  : "bg-card/40 border border-border/50 opacity-60"
              }`}
            >
              <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${step.done ? "bg-primary/10" : "bg-muted"}`}>
                {step.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <step.icon className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold leading-tight ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{step.benefit}</p>
                )}
              </div>
              {isNext && step.action && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 px-2.5 shrink-0"
                  onClick={step.action}
                >
                  {step.cta}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DashboardWelcome;
