import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { UserPreferences } from "@/lib/user_preferences";
import { motion } from "framer-motion";

interface Props {
  profile: CandidateProfile | null;
  preferences: UserPreferences | null;
  jobCount: number;
  appCount: number;
}

const DashboardWelcome = ({ profile, preferences, jobCount, appCount }: Props) => {
  const steps = [
    {
      label: "Build your profile",
      done: !!profile?.identity?.name,
      href: "/resume-builder",
      cta: "Build Profile",
    },
    {
      label: "Set job preferences",
      done: !!(preferences?.target_roles?.length),
      href: "/auto-applier-settings",
      cta: "Set Preferences",
    },
    {
      label: "Discover jobs",
      done: jobCount > 0,
      href: undefined,
      cta: undefined,
    },
    {
      label: "Apply to your first role",
      done: appCount > 0,
      href: undefined,
      cta: undefined,
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;
  const nextStep = steps.find(s => !s.done);

  if (allDone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-background p-5 sm:p-6 mb-6"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold">Get started with Hunter</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {completedCount} of {steps.length} steps completed
          </p>
        </div>
        <div className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
          {Math.round((completedCount / steps.length) * 100)}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(completedCount / steps.length) * 100}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <div key={i} className={`flex items-center gap-3 text-sm ${step.done ? "text-muted-foreground" : "text-foreground"}`}>
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            )}
            <span className={step.done ? "line-through" : "font-medium"}>{step.label}</span>
            {!step.done && step.href && step === nextStep && (
              <Link to={step.href} className="ml-auto">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-3">
                  {step.cta} <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default DashboardWelcome;
