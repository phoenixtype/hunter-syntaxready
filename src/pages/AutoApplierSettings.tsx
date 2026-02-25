import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Settings2, User, Briefcase, FileText, Bot, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { useResume } from "@/hooks/useResume";
import { useAuth } from "@/hooks/useAuth";
import { getPreferences, savePreferences, UserPreferences } from "@/lib/user_preferences";

const AutoApplierSettings = () => {
  const navigate = useNavigate();
  const { profile } = useResume();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state — pre-populated from profile & preferences
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const [jobTitles, setJobTitles] = useState("");
  const [locations, setLocations] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [workSetup, setWorkSetup] = useState("any");
  const [blacklist, setBlacklist] = useState("");

  const [requireSponsorship, setRequireSponsorship] = useState(false);
  const [hasClearance, setHasClearance] = useState(false);
  const [expectedSalary, setExpectedSalary] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("14");

  const [stealthMode, setStealthMode] = useState(true);
  const [pauseBeforeSubmit, setPauseBeforeSubmit] = useState(false);

  // Load data from profile and preferences
  useEffect(() => {
    if (!user) return;

    // Pre-fill from candidate profile
    if (profile) {
      setFullName(profile.identity?.name || "");
      setPhone(profile.identity?.phone || "");
      const linkedin = profile.identity?.links?.find((l: string) => l.includes("linkedin"));
      if (linkedin) setLinkedinUrl(linkedin);
      const portfolio = profile.identity?.links?.find((l: string) => !l.includes("linkedin") && !l.includes("github"));
      if (portfolio) setPortfolioUrl(portfolio);
    }

    // Pre-fill from user preferences
    const loadPrefs = async () => {
      const prefs = await getPreferences(user.id);
      if (prefs) {
        setJobTitles(prefs.target_roles?.join(", ") || "");
        setLocations(prefs.locations?.join(", ") || "");
        setWorkSetup(prefs.remote_policy || "any");
        setExpectedSalary(prefs.min_salary_usd?.toString() || "");
      }
      setLoading(false);
    };
    loadPrefs();
  }, [user, profile]);

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save preferences back to DB
      await savePreferences(user.id, {
        target_roles: jobTitles.split(",").map(s => s.trim()).filter(Boolean),
        locations: locations.split(",").map(s => s.trim()).filter(Boolean),
        remote_policy: workSetup as UserPreferences["remote_policy"],
        min_salary_usd: parseInt(expectedSalary) || 100000,
        safe_mode: !stealthMode ? false : true,
        aggressiveness: pauseBeforeSubmit ? 3 : 7,
      });
      toast.success("All settings saved!");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartBot = () => {
    setIsRunning(!isRunning);
    toast.success(isRunning ? "Auto-applier paused." : "Auto-applier started successfully in the background!");
  };

  const steps = [
    { num: 1, title: "Personal Details", icon: User },
    { num: 2, title: "Search Preferences", icon: Briefcase },
    { num: 3, title: "Questionnaires", icon: FileText },
    { num: 4, title: "Bot Settings", icon: Settings2 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 w-full z-50 border-b border-border bg-background/60 backdrop-blur-xl">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              <span className="font-semibold text-lg hidden sm:inline">Auto-Applier Core</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={isRunning ? "default" : "secondary"} className={isRunning ? 'bg-success/20 text-success border-success/50' : ''}>
              {isRunning ? "Running" : "Idle"}
            </Badge>
            <ThemeToggle />
            <Button onClick={handleStartBot} size="sm" variant={isRunning ? "destructive" : "default"}>
              {isRunning ? "Stop Agent" : <><Play className="w-4 h-4 mr-2" /> Start Agent</>}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-8 md:py-12 animate-fade-in">
        <div className="mb-10 text-center space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Configure Your <span className="text-primary">AI Job Hunter</span></h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Set your preferences once and let the bot apply to hundreds of jobs while you sleep.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar Steps */}
          <div className="md:col-span-1 space-y-2">
            {steps.map((step) => (
              <button
                key={step.num}
                onClick={() => setActiveStep(step.num)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-300 ${
                  activeStep === step.num
                  ? "bg-primary/10 border-primary/30 border"
                  : "hover:bg-muted border border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  activeStep === step.num ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <step.icon className="w-4 h-4" />
                </div>
                <div className="font-medium text-sm">{step.title}</div>
              </button>
            ))}
          </div>

          {/* Config Forms */}
          <div className="md:col-span-3">
            <Card className="border-border bg-card/50 backdrop-blur-md shadow-xl overflow-hidden">
              <CardContent className="p-8">
                {activeStep === 1 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h2 className="text-2xl font-semibold mb-1">Personal Details</h2>
                      <p className="text-sm text-muted-foreground">Information used to fill out basic application forms.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
                      </div>
                      <div className="space-y-2">
                        <Label>Current Location</Label>
                        <Input value={currentLocation} onChange={e => setCurrentLocation(e.target.value)} placeholder="San Francisco, CA" />
                      </div>
                      <div className="space-y-2">
                        <Label>LinkedIn Profile URL</Label>
                        <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Personal Website / Portfolio</Label>
                        <Input value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="https://..." />
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h2 className="text-2xl font-semibold mb-1">Search Preferences</h2>
                      <p className="text-sm text-muted-foreground">Define what jobs the bot should target.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Job Titles (comma separated)</Label>
                        <Input value={jobTitles} onChange={e => setJobTitles(e.target.value)} placeholder="Software Engineer, Frontend Developer" />
                      </div>
                      <div className="space-y-2">
                        <Label>Locations (comma separated)</Label>
                        <Input value={locations} onChange={e => setLocations(e.target.value)} placeholder="United States, Remote, New York" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Years of Experience</Label>
                          <Input type="number" value={yearsExp} onChange={e => setYearsExp(e.target.value)} placeholder="5" />
                        </div>
                        <div className="space-y-2">
                          <Label>Work Setup</Label>
                          <select
                            value={workSetup}
                            onChange={e => setWorkSetup(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="remote">Remote Only</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="onsite">On-site</option>
                            <option value="any">Any</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2 pt-4 border-t border-border">
                        <Label className="text-destructive">Company Blacklist (Do not apply)</Label>
                        <Input value={blacklist} onChange={e => setBlacklist(e.target.value)} placeholder="Crossover, Canonical, Revature" className="border-destructive/20 focus:border-destructive" />
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 3 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h2 className="text-2xl font-semibold mb-1">Standard Questionnaires</h2>
                      <p className="text-sm text-muted-foreground">Pre-fill answers to common ATS questions.</p>
                    </div>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                        <div>
                          <Label className="text-base">Require Sponsorship?</Label>
                          <p className="text-sm text-muted-foreground">Will you now or in the future require visa sponsorship?</p>
                        </div>
                        <Switch checked={requireSponsorship} onCheckedChange={setRequireSponsorship} />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                        <div>
                          <Label className="text-base">Clearance</Label>
                          <p className="text-sm text-muted-foreground">Do you possess an active security clearance?</p>
                        </div>
                        <Switch checked={hasClearance} onCheckedChange={setHasClearance} />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Salary (Numeric)</Label>
                        <Input type="number" value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)} placeholder="120000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Notice Period (Days)</Label>
                        <Input type="number" value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} placeholder="14" />
                      </div>
                    </div>
                  </div>
                )}

                {activeStep === 4 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h2 className="text-2xl font-semibold mb-1">Bot Behavior Configuration</h2>
                      <p className="text-sm text-muted-foreground">Control how the automation engine operates.</p>
                    </div>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                        <div>
                          <Label className="text-base">Stealth Mode</Label>
                          <p className="text-sm text-muted-foreground">Run headless browser to avoid detection (Recommended).</p>
                        </div>
                        <Switch checked={stealthMode} onCheckedChange={setStealthMode} />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                        <div>
                          <Label className="text-base">Pause Before Submission</Label>
                          <p className="text-sm text-muted-foreground">Allow manual review of each application before it sends.</p>
                        </div>
                        <Switch checked={pauseBeforeSubmit} onCheckedChange={setPauseBeforeSubmit} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Button — always visible */}
                <div className="pt-6 mt-6 border-t border-border flex justify-end">
                  <Button onClick={handleSaveAll} disabled={saving}>
                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save All Settings</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AutoApplierSettings;