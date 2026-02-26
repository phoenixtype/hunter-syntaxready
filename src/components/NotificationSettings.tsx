import { Bell, Mail, Smartphone, Zap, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NotificationSettings = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Alerts
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Get notified when new jobs match your profile or your application status changes.
        </p>
      </div>

      {/* Live status */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              Real-time alerts active
              <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px]">Live</Badge>
            </h3>
            <p className="text-sm text-muted-foreground">You'll see toast notifications in real-time while using Hunter.</p>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>New job matches — notified when roles matching your profile are added</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>Application status changes — notified when your application status updates</span>
          </div>
        </div>
      </div>

      {/* Email/SMS coming soon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Mail className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Email digests</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">SMS alerts (Pro)</p>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
