import { Zap, ShieldCheck, Sparkles, Rocket, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upgradeToPro } from "@/lib/subscription";
import { useState } from "react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";

interface SubscriptionGateProps {
  onClose?: () => void;
}

const SubscriptionGate = ({ onClose }: SubscriptionGateProps) => {
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refetch } = useSubscription();

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data } = await refetch();
      if (data?.tier !== 'free') {
        toast.success("Pro subscription activated! Welcome to Hunter Pro.");
        onClose?.();
      } else {
        toast.info("Still on Free tier.", {
          description: "If you completed payment, it can take up to 60 seconds to activate. Wait a moment and try again, or contact support@syntaxready.com.",
          duration: 8000,
        });
      }
    } catch {
      toast.error("Failed to refresh status. Please reload the page and try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60">
      <div className="relative max-w-lg w-full overflow-hidden rounded-md border border-border bg-card p-8 shadow-md">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-muted">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight">
                Unlock Hunter Pro
              </h2>
              <p className="text-muted-foreground text-sm max-w-[300px] mx-auto leading-relaxed">
                You've completed onboarding! Now activate your AI agent to start finding and applying to jobs autonomously.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            {[
              { icon: Rocket, text: "Unlimited AI Job Matches & Analysis" },
              { icon: Sparkles, text: "Auto-Tailored Resumes & Cover Letters" },
              { icon: ShieldCheck, text: "Priority Application Queue & Tracking" }
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-muted border border-border text-sm font-medium">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-background shrink-0">
                  <feature.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                {feature.text}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="h-11 w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  Activate Pro Access
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="flex justify-center">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1 px-3 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? "Checking..." : "Already paid? Refresh status"}
              </button>
            </div>

            <p className="text-center label-eyebrow opacity-60">
              Cancel anytime • Secure checkout via Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGate;
