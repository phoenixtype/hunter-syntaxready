import { useState, useEffect } from "react";
import { Bell, Mail, Calendar, AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface NotificationPreferences {
  job_matches: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'never';
    time: string;
    timezone: string;
  };
  auto_applications: {
    enabled: boolean;
    frequency: 'immediate';
  };
  weekly_digest: {
    enabled: boolean;
    frequency: 'weekly';
    day: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
    time: string;
  };
  payment_updates: {
    enabled: boolean;
    frequency: 'immediate';
  };
  usage_warnings: {
    enabled: boolean;
    threshold: number;
  };
}

const defaultPreferences: NotificationPreferences = {
  job_matches: {
    enabled: true,
    frequency: 'daily',
    time: '09:00',
    timezone: 'UTC'
  },
  auto_applications: {
    enabled: true,
    frequency: 'immediate'
  },
  weekly_digest: {
    enabled: true,
    frequency: 'weekly',
    day: 'sunday',
    time: '09:00'
  },
  payment_updates: {
    enabled: true,
    frequency: 'immediate'
  },
  usage_warnings: {
    enabled: true,
    threshold: 80
  }
};

const NotificationSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    if (!user) return;
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get preferences from user_preferences table
      const { data, error } = await supabase
        .from('user_preferences')
        .select('notification_settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.notification_settings) {
        setPreferences(data.notification_settings as unknown as NotificationPreferences);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user || saving) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: user.id, notification_settings: newPreferences as unknown as import('@/integrations/supabase/types').Json },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setPreferences(newPreferences);
      toast.success('Notification preferences updated');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (
    section: keyof NotificationPreferences,
    key: string,
    value: any
  ) => {
    const newPreferences = {
      ...preferences,
      [section]: {
        ...preferences[section],
        [key]: value
      }
    };
    savePreferences(newPreferences);
  };

  const timezoneOptions = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time' },
    { value: 'America/Chicago', label: 'Central Time' },
    { value: 'America/Denver', label: 'Mountain Time' },
    { value: 'America/Los_Angeles', label: 'Pacific Time' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Berlin', label: 'Berlin' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
  ];

  const dayOptions = [
    { value: 'sunday', label: 'Sunday' },
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Job Matches */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-medium">Job Matches</Label>
              <p className="text-sm text-muted-foreground">Get notified when new jobs match your profile</p>
            </div>
          </div>
          <Switch
            checked={preferences.job_matches.enabled}
            onCheckedChange={(checked) => updatePreference('job_matches', 'enabled', checked)}
            disabled={saving}
            aria-label="Job Matches"
          />
        </div>

        {preferences.job_matches.enabled && (
          <div className="ml-8 space-y-3 border-l-2 border-border pl-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Frequency</Label>
                <Select
                  value={preferences.job_matches.frequency}
                  onValueChange={(value) => updatePreference('job_matches', 'frequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {preferences.job_matches.frequency !== 'never' && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Time</Label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 border border-input rounded-md text-sm"
                      value={preferences.job_matches.time}
                      onChange={(e) => updatePreference('job_matches', 'time', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Timezone</Label>
                    <Select
                      value={preferences.job_matches.timezone}
                      onValueChange={(value) => updatePreference('job_matches', 'timezone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timezoneOptions.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Auto Applications */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-medium">Auto Applications</Label>
              <p className="text-sm text-muted-foreground">Instant confirmation when applications are submitted</p>
            </div>
          </div>
          <Switch
            checked={preferences.auto_applications.enabled}
            onCheckedChange={(checked) => updatePreference('auto_applications', 'enabled', checked)}
            disabled={saving}
            aria-label="Auto Applications"
          />
        </div>

        {preferences.auto_applications.enabled && (
          <div className="ml-8 border-l-2 border-border pl-4">
            <p className="text-sm text-muted-foreground">Frequency: Immediate</p>
          </div>
        )}
      </div>

      <Separator />

      {/* Weekly Digest */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-medium">Weekly Digest</Label>
              <p className="text-sm text-muted-foreground">Weekly summary of activity and matches</p>
            </div>
          </div>
          <Switch
            checked={preferences.weekly_digest.enabled}
            onCheckedChange={(checked) => updatePreference('weekly_digest', 'enabled', checked)}
            disabled={saving}
            aria-label="Weekly Digest"
          />
        </div>

        {preferences.weekly_digest.enabled && (
          <div className="ml-8 space-y-3 border-l-2 border-border pl-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Day</Label>
                <Select
                  value={preferences.weekly_digest.day}
                  onValueChange={(value) => updatePreference('weekly_digest', 'day', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Time</Label>
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-input rounded-md text-sm"
                  value={preferences.weekly_digest.time}
                  onChange={(e) => updatePreference('weekly_digest', 'time', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Payment Updates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-medium">Payment Updates</Label>
              <p className="text-sm text-muted-foreground">Billing and subscription notifications (required)</p>
            </div>
          </div>
          <Switch
            checked={preferences.payment_updates.enabled}
            onCheckedChange={() => {}} // No-op since this can't be changed
            disabled={true}
            aria-label="Payment Updates"
          />
        </div>

        <div className="ml-8 border-l-2 border-border pl-4">
          <p className="text-sm text-muted-foreground">Frequency: Immediate (cannot be disabled)</p>
        </div>
      </div>

      <Separator />

      {/* Usage Warnings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-base font-medium">Usage Warnings</Label>
              <p className="text-sm text-muted-foreground">Alerts when approaching feature limits</p>
            </div>
          </div>
          <Switch
            checked={preferences.usage_warnings.enabled}
            onCheckedChange={(checked) => updatePreference('usage_warnings', 'enabled', checked)}
            disabled={saving}
            aria-label="Usage Warnings"
          />
        </div>

        {preferences.usage_warnings.enabled && (
          <div className="ml-8 space-y-3 border-l-2 border-border pl-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Alert Threshold: {preferences.usage_warnings.threshold}%
              </Label>
              <div className="space-y-2">
                <Slider
                  value={[preferences.usage_warnings.threshold]}
                  onValueChange={(value) => {
                    // Update local state only — commit on pointer up to avoid per-tick DB writes
                    setPreferences(prev => ({
                      ...prev,
                      usage_warnings: { ...prev.usage_warnings, threshold: value[0] }
                    }));
                  }}
                  onValueCommit={(value) => updatePreference('usage_warnings', 'threshold', value[0])}
                  min={50}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
              <input
                type="number"
                min="50"
                max="100"
                step="5"
                value={preferences.usage_warnings.threshold}
                onChange={(e) => {
                  const val = Math.max(50, Math.min(100, parseInt(e.target.value) || 50));
                  setPreferences(prev => ({
                    ...prev,
                    usage_warnings: { ...prev.usage_warnings, threshold: val }
                  }));
                }}
                onBlur={(e) => updatePreference('usage_warnings', 'threshold', Math.max(50, Math.min(100, parseInt(e.target.value) || 50)))}
                className="w-20 px-2 py-1 border border-input rounded text-sm mt-2"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationSettings;
