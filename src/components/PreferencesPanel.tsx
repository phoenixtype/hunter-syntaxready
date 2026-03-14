import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save } from "lucide-react";
import TagInput from "@/components/ui/tag-input";
import { UserPreferences, savePreferences } from "@/lib/user_preferences";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import LocationPicker from "./LocationPicker";

interface PreferencesPanelProps {
    preferences: UserPreferences | null;
    onSaved?: () => void;
}

const PreferencesPanel = ({ preferences, onSaved }: PreferencesPanelProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [saving, setSaving] = useState(false);

    const [roles, setRoles] = useState<string[]>([]);
    const [salary, setSalary] = useState([100000]);
    const [locations, setLocations] = useState<string[]>([]);
    const [remotePolicy, setRemotePolicy] = useState<UserPreferences["remote_policy"]>("any");
    const [experienceLevel, setExperienceLevel] = useState<string>("mid");
    const [aggressiveness, setAggressiveness] = useState([5]);

    useEffect(() => {
        if (preferences) {
            setRoles(preferences.target_roles || []);
            setSalary([preferences.min_salary_usd || 100000]);
            setLocations(preferences.locations || []);
            setRemotePolicy(preferences.remote_policy || "any");
            setExperienceLevel(preferences.experience_level || "mid");
            setAggressiveness([preferences.aggressiveness || 5]);
        }
    }, [preferences]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await savePreferences(user.id, {
                target_roles: roles,
                min_salary_usd: salary[0],
                locations,
                remote_policy: remotePolicy,
                experience_level: experienceLevel,
                aggressiveness: aggressiveness[0],
                safe_mode: true,
                require_sponsorship: false,
                has_clearance: false,
                notice_period_days: 14,
                email_alerts_enabled: preferences?.email_alerts_enabled ?? false,
                sms_alerts_enabled: preferences?.sms_alerts_enabled ?? false,
                tracker_view: preferences?.tracker_view ?? 'list',
            });
            queryClient.invalidateQueries({ queryKey: ['preferences'] });
            toast.success("Preferences saved!");
            onSaved?.();
        } catch {
            toast.error("Failed to save preferences.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Target Roles */}
            <div className="rounded-md border border-border bg-card p-5 space-y-3">
                <Label className="text-sm font-semibold">Target Roles</Label>
                <TagInput value={roles} onChange={setRoles} placeholder="e.g. Senior Frontend Engineer — press Enter to add" />
            </div>

            {/* Salary & Intensity */}
            <div className="rounded-md border border-border bg-card p-5 space-y-6">
                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <Label className="text-sm font-semibold">Minimum Base Salary</Label>
                        <span className="text-sm font-mono font-semibold">${salary[0].toLocaleString()}</span>
                    </div>
                    <Slider value={salary} onValueChange={setSalary} min={30000} max={500000} step={5000} />
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <Label className="text-sm font-semibold">Search Intensity</Label>
                        <span className="text-xs text-muted-foreground font-mono">Level {aggressiveness[0]}</span>
                    </div>
                    <Slider value={aggressiveness} onValueChange={setAggressiveness} min={1} max={10} step={1} />
                    <p className="text-xs text-muted-foreground">
                        Higher = broader search with more results. Lower = tighter focus on exact matches.
                    </p>
                </div>
            </div>

            {/* Location & Work Style */}
            <div className="rounded-md border border-border bg-card p-5 space-y-6">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold">Preferred Locations</Label>
                    <LocationPicker locations={locations} onChange={setLocations} />
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-semibold">Remote Policy</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {(["remote", "hybrid", "onsite", "any"] as const).map(mode => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setRemotePolicy(mode)}
                                className={`h-9 rounded-md text-xs font-medium border transition-all ${
                                    remotePolicy === mode
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-border hover:border-primary/50 hover:bg-accent/50"
                                }`}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-sm font-semibold">Experience Level</Label>
                    <div className="grid grid-cols-5 gap-1.5">
                        {(["intern", "entry", "mid", "senior", "lead"] as const).map(level => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setExperienceLevel(level)}
                                className={`h-9 rounded-md text-xs font-medium border transition-all ${
                                    experienceLevel === level
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-border hover:border-primary/50 hover:bg-accent/50"
                                }`}
                            >
                                {level === "intern" ? "Intern" : level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Jobs matching your level are ranked higher in the feed.
                    </p>
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Saving…" : "Save Preferences"}
                </Button>
            </div>
        </div>
    );
};

export default PreferencesPanel;
