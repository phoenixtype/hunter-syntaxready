/**
 * ProGate — the single, consistent upgrade prompt used everywhere in the app.
 *
 * Two variants:
 *  1. <ProGate.Dialog> — a Dialog/AlertDialog triggered by a locked action.
 *  2. <ProGate.Page> — a full-page overlay that blurs tool pages for free users.
 */
import { useState } from "react";
import { Lock, Zap, Send, FileText, GraduationCap, Bot, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { upgradeToPro } from "@/lib/subscription";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { useGeo } from '@/hooks/useGeo';
import { getPrice, getPaymentBadge } from '@/lib/pricing';
import { PaystackCheckout } from '@/components/payment/PaystackCheckout';

// ── Shared internals ─────────────────────────────────────────────────────────

const PRO_HIGHLIGHTS = [
  { icon: Send,          text: "Apply to unlimited jobs with one click" },
  { icon: FileText,      text: "AI-tailored resumes & cover letters" },
  { icon: GraduationCap, text: "Full interview coaching suite" },
  { icon: Bot,           text: "Autopilot — auto-match & auto-apply" },
] as const;

function UpgradeCard({
  featureLabel,
  onClose,
}: {
  featureLabel?: string;
  onClose?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaystack, setShowPaystack] = useState(false);
  const { refetch } = useSubscription() as any;
  const { isNigeria, currency } = useGeo();
  const priceLabel = getPrice('pro', currency).label;
  const paymentBadge = getPaymentBadge(isNigeria);

  const handleUpgrade = async () => {
    if (isNigeria) {
      setShowPaystack(true);
      return;
    }
    setLoading(true);
    try {
      await upgradeToPro('stripe');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout. Please try again.");
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await refetch();
      if (data?.tier !== "free") {
        toast.success("Pro subscription activated! Welcome to Hunter Pro.");
        onClose?.();
      } else {
        toast.info("Still on Free tier.", {
          description: "If you completed payment, it can take up to 60 seconds to activate. Wait a moment and try again.",
          duration: 7000,
        });
      }
    } catch {
      toast.error("Failed to refresh. Please reload the page.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5">
      {showPaystack && (
        <PaystackCheckout
          planName="pro"
          interval="monthly"
          onClose={() => setShowPaystack(false)}
        />
      )}
      {/* Icon + heading */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {featureLabel ? `${featureLabel} requires Hunter Pro` : "Upgrade to Hunter Pro"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
            Unlock the full AI-powered job search engine — apply faster, stand out more.
          </p>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="space-y-2">
        {PRO_HIGHLIGHTS.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/60 border border-border text-sm"
          >
            <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-medium">{text}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2.5">
        <Button
          onClick={handleUpgrade}
          disabled={loading}
          className="h-11 w-full rounded-full gap-2 shadow-md-1 font-semibold"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Starting checkout…</>
          ) : (
            <><Zap className="w-4 h-4" /> Upgrade to Pro — {priceLabel} <ArrowRight className="w-4 h-4 ml-auto" /></>
          )}
        </Button>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-1.5 rounded-full hover:bg-muted transition-colors disabled:opacity-50 w-full"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Checking…" : "Already paid? Refresh status"}
        </button>

        <p className="text-center text-[11px] text-muted-foreground/60 font-medium uppercase tracking-widest">
          Billed monthly · Cancel anytime · {paymentBadge}
        </p>
      </div>
    </div>
  );
}

// ── 1. Dialog variant ─────────────────────────────────────────────────────────

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureLabel?: string;
}

function ProGateDialog({ open, onOpenChange, featureLabel }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-7 gap-0 border-border shadow-md-3">
        <DialogTitle className="sr-only">Upgrade to Hunter Pro</DialogTitle>
        <UpgradeCard featureLabel={featureLabel} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

// ── 2. Page overlay variant ───────────────────────────────────────────────────

interface PageProps {
  /** The name of the tool/feature being gated, e.g. "Resume Builder" */
  featureLabel: string;
  children: React.ReactNode;
  /** If true, the feature is accessible — render children normally */
  isPro: boolean;
  isLoading?: boolean;
}

function ProGatePage({ featureLabel, children, isPro, isLoading }: PageProps) {
  if (isLoading) return <>{children}</>;
  if (isPro) return <>{children}</>;

  return (
    <div className="relative flex flex-col min-h-screen">
      {/* Blurred, non-interactive background content */}
      <div className="pointer-events-none select-none" aria-hidden="true" style={{ filter: "blur(3px)", opacity: 0.35 }}>
        {children}
      </div>

      {/* Centered gate card */}
      <div className="absolute inset-0 flex items-center justify-center p-4 z-50">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-7 shadow-md-3">
          <UpgradeCard featureLabel={featureLabel} />
        </div>
      </div>
    </div>
  );
}

// ── 3. Inline locked button wrapper ──────────────────────────────────────────

interface InlineProps {
  featureLabel?: string;
  children: React.ReactNode;
  isPro: boolean;
  /** className added to the outer wrapper */
  className?: string;
}

function ProGateInline({ featureLabel, children, isPro, className }: InlineProps) {
  const [open, setOpen] = useState(false);

  if (isPro) return <>{children}</>;

  return (
    <>
      <div
        className={`relative cursor-pointer group/lock ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        <div className="pointer-events-none select-none">{children}</div>
        {/* Lock badge */}
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
          <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2.5 py-1 shadow-md-1 text-xs font-medium text-foreground">
            <Lock className="w-3 h-3 text-primary" />
            Pro
          </div>
        </div>
      </div>
      <ProGateDialog open={open} onOpenChange={setOpen} featureLabel={featureLabel} />
    </>
  );
}

// ── Named exports ─────────────────────────────────────────────────────────────

// Dismiss the old X in SubscriptionGate — also expose a standalone icon for sidebar lock badges
export const ProLockBadge = ({ className }: { className?: string }) => (
  <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full leading-none ${className ?? ""}`}>
    <Lock className="w-2.5 h-2.5" />Pro
  </span>
);

const ProGate = {
  Dialog: ProGateDialog,
  Page: ProGatePage,
  Inline: ProGateInline,
};

export default ProGate;
