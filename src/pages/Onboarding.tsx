
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { savePreferences, UserPreferences } from "@/lib/user_preferences";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

const Onboarding = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const [roles, setRoles] = useState("");
    const [salary, setSalary] = useState([120000]);
    const [locations, setLocations] = useState("");
    const [remotePolicy, setRemotePolicy] = useState<UserPreferences['remote_policy']>('any');
    const [aggressiveness, setAggressiveness] = useState([5]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        const prefs: UserPreferences = {
            target_roles: roles.split(',').map(s => s.trim()).filter(Boolean),
            min_salary_usd: salary[0],
            locations: locations.split(',').map(s => s.trim()).filter(Boolean),
            remote_policy: remotePolicy,
            aggressiveness: aggressiveness[0]
        };

        await savePreferences(user.id, prefs);
        setLoading(false);
        toast.success("Intelligence updated.");
        navigate("/dashboard");
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 animate-fade-in">
            <div className="w-full max-w-2xl space-y-12">
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                        Define your hunt.
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Configure the agent's parameters. Be precise.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-12">
                    {/* Roles */}
                    <div className="space-y-4">
                        <Label className="text-lg font-medium">Target Roles (comma separated)</Label>
                        <Input
                            value={roles}
                            onChange={(e) => setRoles(e.target.value)}
                            placeholder="e.g. Senior Frontend Engineer, Product Architect, CTO"
                            className="h-16 text-lg bg-transparent border-2 border-muted focus-visible:ring-0 focus-visible:border-primary transition-colors"
                        />
                    </div>

                    {/* Salary */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <Label className="text-lg font-medium">Minimum Base Salary</Label>
                            <span className="text-2xl font-mono">${salary[0].toLocaleString()}</span>
                        </div>
                        <Slider
                            value={salary}
                            onValueChange={setSalary}
                            min={50000}
                            max={500000}
                            step={5000}
                            className="py-4"
                        />
                    </div>

                    {/* Location & Remote */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <Label className="text-lg font-medium">Locations</Label>
                            <Input
                                value={locations}
                                onChange={(e) => setLocations(e.target.value)}
                                placeholder="e.g. San Francisco, New York, London"
                                className="h-12 bg-transparent border-muted"
                            />
                        </div>
                        <div className="space-y-4">
                            <Label className="text-lg font-medium">Remote Policy</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['remote', 'hybrid', 'onsite', 'any'] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setRemotePolicy(mode)}
                                        className={`h-12 border rounded-lg text-sm font-medium transition-all ${remotePolicy === mode
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'border-muted hover:border-primary/50'
                                            }`}
                                    >
                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Aggressiveness */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <Label className="text-lg font-medium">Agent Aggressiveness</Label>
                            <span className="text-xl font-mono text-muted-foreground">Level {aggressiveness[0]}</span>
                        </div>
                        <Slider
                            value={aggressiveness}
                            onValueChange={setAggressiveness}
                            min={1}
                            max={10}
                            step={1}
                            className="py-4"
                        />
                        <p className="text-sm text-muted-foreground">
                            Level 1: Only perfect matches. Manual review required.<br />
                            Level 10: "Apply to everything." Maximum volume. Zero mercy.
                        </p>
                    </div>

                    <Button
                        type="submit"
                        size="lg"
                        className="w-full h-16 text-lg font-bold rounded-full transition-transform hover:scale-[1.01] active:scale-[0.99]"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Initiate Agent"}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default Onboarding;
