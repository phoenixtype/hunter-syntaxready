import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, Mail, Smartphone, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

interface NotificationPrefs {
  email_enabled: boolean;
  sms_enabled: boolean;
  phone_number: string | null;
  notification_email: string | null;
  job_alerts: boolean;
  application_updates: boolean;
  weekly_digest: boolean;
  alert_frequency: string;
}

const NotificationSettings = () => {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    email_enabled: true,
    sms_enabled: false,
    phone_number: null,
    notification_email: null,
    job_alerts: true,
    application_updates: true,
    weekly_digest: true,
    alert_frequency: "daily",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchPrefs = async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setPrefs({
          email_enabled: data.email_enabled,
          sms_enabled: data.sms_enabled,
          phone_number: data.phone_number,
          notification_email: data.notification_email || user.email || null,
          job_alerts: data.job_alerts,
          application_updates: data.application_updates,
          weekly_digest: data.weekly_digest,
          alert_frequency: data.alert_frequency,
        });
      } else if (!error || error.code === "PGRST116") {
        setPrefs(p => ({ ...p, notification_email: user.email || null }));
      }
      setLoading(false);
    };
    fetchPrefs();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    // If not Pro, force SMS off
    const savePrefs = isPro ? prefs : { ...prefs, sms_enabled: false };
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...savePrefs }, { onConflict: "user_id" });

    if (error) {
      toast.error("Failed to save preferences");
      console.error(error);
    } else {
      toast.success("Notification preferences saved!");
    }
    setSaving(false);
  };

  const testEmail = async () => {
    if (!prefs.notification_email) return;
    setTestingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "weekly_digest",
          to: prefs.notification_email,
          data: { applications_sent: 5, new_jobs: 12 },
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) throw error;
      toast.success("Test email sent! Check your inbox.");
    } catch (err) {
      toast.error("Failed to send test email");
      console.error(err);
    }
    setTestingEmail(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Notifications
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Get alerted when new jobs match your profile or application statuses change.
        </p>
      </div>

      {/* Email Settings */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Email Notifications</CardTitle>
            </div>
            <Switch
              checked={prefs.email_enabled}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, email_enabled: v }))}
            />
          </div>
          <CardDescription className="text-xs">Receive notifications via email</CardDescription>
        </CardHeader>
        {prefs.email_enabled && (
          <CardContent className="space-y-4 pt-0">
            <div>
              <Label className="text-xs text-muted-foreground">Email Address</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={prefs.notification_email || ""}
                  onChange={(e) => setPrefs(p => ({ ...p, notification_email: e.target.value }))}
                  placeholder="your@email.com"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={testEmail} disabled={testingEmail || !prefs.notification_email}>
                  {testingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test"}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* SMS Settings - Pro Only */}
      <Card className={`border-border ${!isPro ? 'opacity-75' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">SMS Notifications</CardTitle>
              {!isPro && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
                  <Lock className="w-3 h-3" /> Pro
                </span>
              )}
            </div>
            <Switch
              checked={isPro ? prefs.sms_enabled : false}
              onCheckedChange={(v) => {
                if (!isPro) {
                  toast.error("SMS notifications are a Pro feature. Upgrade to enable.");
                  return;
                }
                setPrefs(p => ({ ...p, sms_enabled: v }));
              }}
              disabled={!isPro}
            />
          </div>
          <CardDescription className="text-xs">
            {isPro ? "Get instant alerts via text message" : "Upgrade to Pro for instant SMS alerts on new job matches"}
          </CardDescription>
        </CardHeader>
        {isPro && prefs.sms_enabled && (
          <CardContent className="space-y-4 pt-0">
            <div>
              <Label className="text-xs text-muted-foreground">Phone Number (with country code)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={prefs.phone_number || ""}
                  onChange={(e) => setPrefs(p => ({ ...p, phone_number: e.target.value }))}
                  placeholder="+1234567890"
                  className="flex-1"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Alert Types */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alert Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Job Alerts</Label>
              <p className="text-xs text-muted-foreground">New jobs matching your profile</p>
            </div>
            <Switch
              checked={prefs.job_alerts}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, job_alerts: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Application Updates</Label>
              <p className="text-xs text-muted-foreground">Status changes on your applications</p>
            </div>
            <Switch
              checked={prefs.application_updates}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, application_updates: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Weekly Digest</Label>
              <p className="text-xs text-muted-foreground">Summary of your job search progress</p>
            </div>
            <Switch
              checked={prefs.weekly_digest}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, weekly_digest: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Frequency */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alert Frequency</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Select value={prefs.alert_frequency} onValueChange={(v) => setPrefs(p => ({ ...p, alert_frequency: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Instant</SelectItem>
              <SelectItem value="daily">Daily Digest</SelectItem>
              <SelectItem value="weekly">Weekly Summary</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Notification Preferences"}
      </Button>
    </div>
  );
};

export default NotificationSettings;
