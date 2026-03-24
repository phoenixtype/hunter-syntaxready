import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, Gift, Users, Share2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserReferralStats,
  getReferralUrl,
  REFERRAL_MILESTONES,
  type UserReferralStats,
} from "@/lib/referral";

const ReferralPanel = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserReferralStats(user.id)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [user]);

  const handleCopy = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(getReferralUrl(stats.code));
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleShare = async () => {
    if (!stats) return;
    const url = getReferralUrl(stats.code);
    const text = "Check out Hunter AI — the autonomous job search agent that finds, tailors, and applies to jobs for you!";

    if (navigator.share) {
      try {
        await navigator.share({ title: "Hunter AI", text, url });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          Refer & Earn
        </CardTitle>
        <CardDescription>
          Share Hunter with friends and earn free Pro access
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Referral link */}
        <div className="flex gap-2">
          <div className="flex-1 bg-muted border border-border rounded-md px-3 py-2 text-sm font-mono truncate select-all">
            {getReferralUrl(stats.code)}
          </div>
          <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={handleShare} className="shrink-0">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{stats.totalReferrals}</span>
            <span className="text-muted-foreground">referral{stats.totalReferrals !== 1 ? "s" : ""}</span>
          </div>
          {stats.nextMilestone && (
            <span className="text-xs text-muted-foreground">
              {stats.nextMilestone.count - stats.totalReferrals} more for {stats.nextMilestone.reward}
            </span>
          )}
        </div>

        {/* Milestone progress */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Milestones</p>
          <div className="space-y-1.5">
            {REFERRAL_MILESTONES.map((m) => {
              const reached = stats.totalReferrals >= m.count;
              return (
                <div
                  key={m.count}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-sm ${
                    reached
                      ? "border-primary/20 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {reached ? (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                    )}
                    <span className={reached ? "text-primary font-medium" : "text-muted-foreground"}>
                      {m.count} referral{m.count > 1 ? "s" : ""}
                    </span>
                  </div>
                  <Badge variant={reached ? "default" : "outline"} className="text-xs shrink-0">
                    {m.reward}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active rewards */}
        {stats.rewards.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Rewards</p>
            <div className="space-y-1">
              {stats.rewards.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5">
                  <span className="text-foreground">
                    {r.reward_type === "pro_days" ? `${r.amount} days Pro` : `${r.amount} Auto-Applies`}
                  </span>
                  {r.expires_at && (
                    <span className="text-muted-foreground">
                      {new Date(r.expires_at) > new Date() ? "Active" : "Expired"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralPanel;
