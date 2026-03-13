import { motion } from "framer-motion";
import { Zap, ShieldCheck, Sparkles, Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upgradeToPro } from "@/lib/subscription";
import { useState } from "react";
import { toast } from "sonner";

interface SubscriptionGateProps {
  onClose?: () => void;
}

const SubscriptionGate = ({ onClose }: SubscriptionGateProps) => {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await upgradeToPro();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/40 backdrop-blur-md animate-in fade-in duration-500">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative max-w-lg w-full overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-background via-background to-primary/5 p-8 shadow-2xl"
      >
        {/* Decorative Elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner">
              <Zap className="h-8 w-8 fill-primary/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                Unlock Hunter Pro
              </h2>
              <p className="text-muted-foreground text-sm font-medium max-w-[300px] mx-auto leading-relaxed">
                You've completed onboarding! Now activate your AI agent to start finding and applying to jobs autonomously.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              { icon: Rocket, text: "Unlimited AI Job Matches & Analysis" },
              { icon: Sparkles, text: "Auto-Tailored Resumes & Cover Letters" },
              { icon: ShieldCheck, text: "Priority Application Queue & Tracking" }
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50 text-sm font-medium">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/50 dark:bg-black/20 shadow-sm shrink-0">
                  <feature.icon className="h-4 w-4 text-primary" />
                </div>
                {feature.text}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="h-14 w-full rounded-2xl bg-primary text-base font-bold shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 gap-2"
            >
              {loading ? "Initializing..." : "Activate Pro Access"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
            <p className="text-center label-eyebrow opacity-60">
              Cancel anytime • Secure checkout via Stripe
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SubscriptionGate;
