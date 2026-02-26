import { Bell, Mail, Smartphone, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

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

      {/* Coming soon banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Rocket className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Notifications coming soon</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            We're building email and push notifications for job matches and application updates.
            This feature will roll out in the next release.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground">
            <Mail className="w-4 h-4 text-primary" />
            Email alerts on new job matches
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm text-muted-foreground">
            <Smartphone className="w-4 h-4 text-primary" />
            SMS alerts for Pro subscribers
          </div>
        </div>
      </div>

      {/* In the meantime hint */}
      <div className="p-4 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground">
        <span className="font-medium text-foreground">In the meantime:</span> Check the Jobs tab daily — Hunter refreshes your feed whenever you log in. Your most relevant matches are always sorted to the top.
      </div>
    </div>
  );
};

export default NotificationSettings;
