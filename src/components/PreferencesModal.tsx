import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Loader2, Plus, X, Save } from "lucide-react";
import { UserPreferences, savePreferences } from "@/lib/user_preferences";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface PreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    preferences: UserPreferences | null;
}

const PreferencesModal = ({ isOpen, onClose, preferences }: PreferencesModalProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [saving, setSaving] = useState(false);

    const [roles, setRoles] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState("");
    const [salary, setSalary] = useState([100000]);
    const [locations, setLocations] = useState("");
    const [remotePolicy, setRemotePolicy] = useState<UserPreferences["remote_policy"]>("any");
    const [aggressiveness, setAggressiveness] = useState([5]);

    // Sync state when preferences change or modal opens
    useEffect(() => {
        if (preferences) {
            setRoles(preferences.target_roles || []);
            setSalary([preferences.min_salary_usd || 100000]);
            setLocations(preferences.locations?.join(", ") || "");
            setRemotePolicy(preferences.remote_policy || "any");
            setAggressiveness([preferences.aggressiveness || 5]);
        }
    }, [preferences, isOpen]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await savePreferences(user.id, {
                target_roles: roles,
                min_salary_usd: salary[0],
                locations: locations.split(",").map(s => s.trim()).filter(Boolean),
                remote_policy: remotePolicy,
                aggressiveness: aggressiveness[0],
                safe_mode: true,
            });
            queryClient.invalidateQueries({ queryKey: ['preferences'] });
            toast.success("Preferences saved!");
            onClose();
        } catch {
            toast.error("Failed to save preferences.");
        } finally {
            setSaving(false);
        }
    };

    const addRole = () => {
        const trimmed = currentRole.trim();
        if (trimmed && !roles.includes(trimmed)) {
            setRoles([...roles, trimmed]);
        }
        setCurrentRole("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Job Preferences</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Target Roles */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Target Roles</Label>
                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                            {roles.map((role, i) => (
                                <Badge key={i} variant="secondary" className="pl-3 pr-1.5 py-1.5 gap-1 text-sm">
                                    {role}
                                    <button onClick={() => setRoles(roles.filter((_, idx) => idx !== i))} className="hover:text-destructive">
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={currentRole}
                                onChange={e => setCurrentRole(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addRole();
                                    }
                                }}
                                placeholder="e.g. Senior Frontend Engineer"
                                className="h-10"
                            />
                            <Button type="button" variant="secondary" size="icon" className="h-10 w-10 shrink-0" onClick={addRole}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Salary */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <Label className="text-sm font-medium">Minimum Base Salary</Label>
                            <span className="text-sm font-mono font-semibold">${salary[0].toLocaleString()}</span>
                        </div>
                        <Slider value={salary} onValueChange={setSalary} min={30000} max={500000} step={5000} />
                    </div>

                    {/* Location + Remote */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Preferred Locations</Label>
                            <Input
                                value={locations}
                                onChange={e => setLocations(e.target.value)}
                                placeholder="SF, NYC, Remote"
                                className="h-10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Remote Policy</Label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {(["remote", "hybrid", "onsite", "any"] as const).map(mode => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setRemotePolicy(mode)}
                                        className={`h-9 rounded-lg text-xs font-medium border transition-all ${
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
                    </div>

                    {/* Aggressiveness */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <Label className="text-sm font-medium">Search Intensity</Label>
                            <span className="text-xs text-muted-foreground font-mono">Level {aggressiveness[0]}</span>
                        </div>
                        <Slider value={aggressiveness} onValueChange={setAggressiveness} min={1} max={10} step={1} />
                        <p className="text-xs text-muted-foreground">
                            Higher = more applications sent automatically. Lower = more selective.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {saving ? "Saving..." : "Save Preferences"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PreferencesModal;
