import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Users, Gift, Link2, Plus, Copy, Check, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ReferralStats {
  total_codes: number;
  active_codes: number;
  total_referrals: number;
  total_rewards: number;
  top_referrers: {
    referrer_id: string;
    full_name: string | null;
    referral_count: number;
    code: string;
    type: string;
  }[];
  influencer_codes: {
    id: string;
    code: string;
    label: string | null;
    max_uses: number | null;
    active: boolean;
    created_at: string;
    uses: number;
  }[];
  referrals_by_day: { day: string; count: number }[];
}

const AdminReferrals = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_referral_stats" as never);
      if (error) throw error;
      setStats(data as unknown as ReferralStats);
    } catch (err) {
      console.error("Failed to load referral stats:", err);
      toast.error("Failed to load referral data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "INF-";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleCreateInfluencerCode = async () => {
    if (!newLabel.trim()) {
      toast.error("Label is required");
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const code = generateCode();
      const { error } = await supabase.from("referral_codes" as never).insert({
        code,
        type: "influencer",
        label: newLabel.trim(),
        max_uses: newMaxUses ? parseInt(newMaxUses) : null,
        created_by: user?.id,
      } as never);

      if (error) throw error;
      toast.success(`Influencer code created: ${code}`);
      setNewLabel("");
      setNewMaxUses("");
      setShowCreate(false);
      fetchStats();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create code");
    } finally {
      setCreating(false);
    }
  };

  const toggleCode = async (codeId: string, active: boolean) => {
    const { error } = await supabase
      .from("referral_codes" as never)
      .update({ active } as never)
      .eq("id", codeId);

    if (error) {
      toast.error("Failed to update code");
    } else {
      toast.success(active ? "Code activated" : "Code deactivated");
      fetchStats();
    }
  };

  const copyCode = async (code: string) => {
    const url = `${window.location.origin}/signup?ref=${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success("Referral link copied!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-muted-foreground text-center py-12">No referral data available.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Referral Program</h1>
          <p className="text-sm text-muted-foreground">Track user referrals and manage influencer codes</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          Create Influencer Code
        </Button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Codes", value: stats.total_codes, icon: Link2 },
          { label: "Active Codes", value: stats.active_codes, icon: Check },
          { label: "Total Referrals", value: stats.total_referrals, icon: Users },
          { label: "Rewards Issued", value: stats.total_rewards, icon: Gift },
        ].map((item) => (
          <Card key={item.label} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <item.icon className="w-4 h-4" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              <p className="text-2xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referrals by day chart */}
      {stats.referrals_by_day.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Referrals (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.referrals_by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top referrers */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">Top Referrers</CardTitle>
          <CardDescription>Users and influencers with the most successful referrals</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.top_referrers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No referrals yet</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.top_referrers.map((r) => (
                <div key={r.referrer_id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.code}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={r.type === "influencer" ? "default" : "secondary"} className="text-xs">
                      {r.type}
                    </Badge>
                    <span className="text-sm font-semibold">{r.referral_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Influencer codes */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm">Influencer Codes</CardTitle>
          <CardDescription>Special referral codes for marketing campaigns and influencer partnerships</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.influencer_codes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No influencer codes yet</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.influencer_codes.map((ic) => (
                <div key={ic.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{ic.label || ic.code}</p>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{ic.code}</code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ic.uses} use{ic.uses !== 1 ? "s" : ""}
                      {ic.max_uses ? ` / ${ic.max_uses} max` : " (unlimited)"}
                      {" · "}Created {new Date(ic.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(ic.code)}
                      className="gap-1.5 text-xs"
                    >
                      {copiedCode === ic.code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedCode === ic.code ? "Copied" : "Copy Link"}
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{ic.active ? "Active" : "Inactive"}</span>
                      <Switch
                        checked={ic.active}
                        onCheckedChange={(active) => toggleCode(ic.id, active)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create influencer code dialog */}
      <AlertDialog open={showCreate} onOpenChange={setShowCreate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Influencer Code</AlertDialogTitle>
            <AlertDialogDescription>
              Create a tracked referral code for an influencer or marketing campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Campaign / Influencer Name</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. TechWithTim, March Campaign"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Uses <span className="text-muted-foreground text-xs">(optional, leave blank for unlimited)</span></Label>
              <Input
                type="number"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateInfluencerCode} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminReferrals;
