import { useState, useEffect } from "react";
import { Bell, Mail, Smartphone, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getPreferences, savePreferences, UserPreferences } from "@/lib/user_preferences";
import { useSubscription } from "@/hooks/useSubscription";
import PricingModal from "./PricingModal";

const NotificationSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const { canAccess } = useSubscription();
  const [showPricingModal, setShowPricingModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadPrefs = async () => {
      const p = await getPreferences(user.id);
      if (p) {
        setPrefs(p);
        setEmailAlerts(p.email_alerts_enabled || false);
        setSmsAlerts(p.sms_alerts_enabled || false);
      }
      setLoading(false);
    };
    loadPrefs();
  }, [user]);

  const handleToggle = async (type: 'email' | 'sms', checked: boolean) => {
    if (!user || !prefs) return;

    if (type === 'sms' && checked && !canAccess('sms_notifications')) {
      setShowPricingModal(true);
      return;
    }
    
    // Optimistic UI update
    if (type === 'email') setEmailAlerts(checked);
    if (type === 'sms') setSmsAlerts(checked);
    setSaving(true);
    
    try {
      const updatedPrefs: UserPreferences = {
        ...prefs,
        [type === 'email' ? 'email_alerts_enabled' : 'sms_alerts_enabled']: checked,
        // Ensure required arrays exist to satisfy types if they were somehow missing
        target_roles: prefs.target_roles || [],
        locations: prefs.locations || []
      };
      
      await savePreferences(user.id, updatedPrefs);
      setPrefs(updatedPrefs);
      toast.success(`${type === 'email' ? 'Email' : 'SMS'} alerts ${checked ? 'enabled' : 'disabled'}`);
    } catch (error) {
      // Revert optimistic update
      if (type === 'email') setEmailAlerts(!checked);
      if (type === 'sms') setSmsAlerts(!checked);
      toast.error("Failed to update notification settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Live status */}
      <div className="rounded-md border border-border bg-muted/50 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Real-time alerts active
              <Badge className="text-[10px]">Live</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">You'll see toast notifications in real-time while using Hunter.</p>
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

      {/* Email/SMS toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`flex items-center justify-between gap-3 p-4 rounded-md border transition-colors ${emailAlerts ? 'border-primary/30 bg-muted' : 'border-border bg-card'}`}>
          <div className="flex gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${emailAlerts ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Email digests</p>
              <p className="text-xs text-muted-foreground">Weekly updates & matches</p>
            </div>
          </div>
          <Switch 
            checked={emailAlerts} 
            onCheckedChange={(c) => handleToggle('email', c)}
            disabled={saving}
          />
        </div>
        
        <div className={`flex items-center justify-between gap-3 p-4 rounded-md border transition-colors ${smsAlerts ? 'border-primary/30 bg-muted' : 'border-border bg-card'}`}>
          <div className="flex gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${smsAlerts ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium">SMS alerts (Pro)</p>
              <p className="text-xs text-muted-foreground">Instant interview updates</p>
            </div>
          </div>
          <Switch 
            checked={smsAlerts} 
            onCheckedChange={(c) => handleToggle('sms', c)}
            disabled={loading || saving}
          />
        </div>
      </div>
      
      <PricingModal 
        isOpen={showPricingModal} 
        onClose={() => setShowPricingModal(false)} 
      />
    </div>
  );
};

export default NotificationSettings;
