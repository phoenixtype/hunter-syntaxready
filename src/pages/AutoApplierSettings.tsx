import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Settings2, User, Briefcase, FileText, Loader2, Save, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import LocationPicker from "@/components/LocationPicker";
import SingleLocationPicker from "@/components/SingleLocationPicker";
import { useResume } from "@/hooks/useResume";
import { useAuth } from "@/hooks/useAuth";
import { getPreferences, savePreferences, UserPreferences } from "@/lib/user_preferences";
import { saveCandidateProfile } from "@/lib/resume_engine";

const INTENSITY_LABELS: Record<number, string> = {
  1: "Very selective — few highly targeted roles",
  2: "Selective — quality over quantity",
  3: "Conservative — a handful per week",
  4: "Moderate — steady weekly pipeline",
  5: "Balanced — consistent flow of matches",
  6: "Active — broad net across relevant roles",
  7: "Aggressive — maximum job discovery",
};

const JobHuntPlanner = () => {
  const navigate = useNavigate();
  const { profile } = useResume();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  // Personal details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  // Search preferences
  const [jobTitles, setJobTitles] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [yearsExp, setYearsExp] = useState("");
  const [workSetup, setWorkSetup] = useState("any");
  const [blacklist, setBlacklist] = useState("");

  // Application defaults
  const [requireSponsorship, setRequireSponsorship] = useState(false);
  const [hasClearance, setHasClearance] = useState(false);
  const [expectedSalary, setExpectedSalary] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("14");

  // Search intensity
  const [intensity, setIntensity] = useState([5]);
  const [safeMode, setSafeMode] = useState(true);

  useEffect(() => {
    if (!user) return;

    if (profile) {
      setFullName(profile.identity?.name || "");
      setPhone(profile.identity?.phone || "");
      setCurrentLocation(profile.identity?.location || "");
      const linkedin = profile.identity?.links?.find((l: string) => l.includes("linkedin"));
      if (linkedin) setLinkedinUrl(linkedin);
      const portfolio = profile.identity?.links?.find((l: string) => !l.includes("linkedin") && !l.includes("github"));
      if (portfolio) setPortfolioUrl(portfolio);
    }

    const loadPrefs = async () => {
      const prefs = await getPreferences(user.id);
      if (prefs) {
        setJobTitles(prefs.target_roles?.join(", ") || "");
        setLocations(prefs.locations || []);
        setWorkSetup(prefs.remote_policy || "any");
        setExpectedSalary(prefs.min_salary_usd?.toString() || "");
        if (prefs.aggressiveness) setIntensity([Math.min(7, prefs.aggressiveness)]);
        setSafeMode(prefs.safe_mode !== false);
        setRequireSponsorship(prefs.require_sponsorship);
        setHasClearance(prefs.has_clearance);
        setExpectedSalary(prefs.min_salary_usd?.toString() || "");
        setNoticePeriod(prefs.notice_period_days?.toString() || "14");
      }
      setLoading(false);
    };
    loadPrefs();
  }, [user, profile]);

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await savePreferences(user.id, {
        target_roles: jobTitles.split(",").map(s => s.trim()).filter(Boolean),
        locations,
        remote_policy: workSetup as UserPreferences["remote_policy"],
        min_salary_usd: parseInt(expectedSalary) || 100000,
        experience_level: 'mid',
        safe_mode: safeMode,
        aggressiveness: intensity[0],
        require_sponsorship: requireSponsorship,
        has_clearance: hasClearance,
        notice_period_days: parseInt(noticePeriod) || 14,
        email_alerts_enabled: undefined as any,
        sms_alerts_enabled: undefined as any
      });

      // Save candidate profile details
      let currentProfile = profile || {
        identity: { name: fullName, email: user.email || "", links: [] },
        skills: [],
        experience_atoms: [],
        education: []
      };

      currentProfile = {
        ...currentProfile,
        identity: {
          name: fullName,
          email: currentProfile.identity?.email || user.email || "",
          phone: phone,
          location: currentLocation,
          links: [linkedinUrl, portfolioUrl].filter(Boolean)
        }
      };

      await saveCandidateProfile(user.id, currentProfile);

      toast.success("Preferences saved!");
    } catch {
      toast.error("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshJobs = async () => {
    await handleSaveAll();
    setSearching(true);
    toast.info("Searching for new job matches…");
    try {
      const { triggerJobCrawl } = await import("@/lib/crawler_engine");
      await triggerJobCrawl({
        keywords: jobTitles.split(",").map(s => s.trim()).filter(Boolean),
        targetRoles: jobTitles.split(",").map(s => s.trim()).filter(Boolean),
        location: locations[0] || currentLocation || undefined,
        remotePolicy: workSetup,
      });
      toast.success("Job feed refreshed! Head to the Jobs tab for your latest matches.");
      navigate("/dashboard");
    } catch {
      toast.error("Job search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const steps = [
    { num: 1, title: "Personal Details", icon: User },
    { num: 2, title: "Job Preferences", icon: Briefcase },
    { num: 3, title: "Application Defaults", icon: FileText },
    { num: 4, title: "Search Settings", icon: Settings2 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead title="Auto-Applier Settings" description="Configure your automated job application preferences." path="/auto-applier-settings" noIndex />
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Job Hunt Planner" },
        ]}
        icon={<Search className="w-4 h-4 text-primary" />}
        actions={
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              onClick={handleRefreshJobs}
              disabled={searching || saving}
              size="sm"
            >
              {searching
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Searching…</>
                : <><RefreshCw className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Refresh Job Feed</span></>
              }
            </Button>
          </div>
        }
      />

      <main className="container max-w-5xl mx-auto px-4 py-6 md:py-12 animate-fade-in">
        <div className="mb-8 md:mb-10 text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Job Hunt <span className="text-primary">Planner</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            Set your preferences once. Hunter uses them to surface the most relevant jobs in your feed and tailor your applications.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {/* Step sidebar */}
          <div className="md:col-span-1">
            <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
              {steps.map((step) => (
                <button
                  key={step.num}
                  onClick={() => setActiveStep(step.num)}
                  className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl text-left transition-all duration-200 shrink-0 md:shrink md:w-full ${
                    activeStep === step.num
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted border border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    activeStep === step.num ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <div className="font-medium text-xs sm:text-sm whitespace-nowrap">{step.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="md:col-span-3">
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-5 sm:p-6">

                {/* Step 1: Personal Details */}
                {activeStep === 1 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h2 className="text-xl font-semibold mb-0.5">Personal Details</h2>
                      <p className="text-sm text-muted-foreground">Used to pre-fill basic fields when you apply to jobs.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Smith" />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Current Location</Label>
                        <SingleLocationPicker value={currentLocation} onChange={setCurrentLocation} />
                      </div>
                      <div className="space-y-2">
                        <Label>LinkedIn URL</Label>
                        <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/janesmith" />
                      </div>
                      <div className="space-y-2">
                        <Label>Portfolio / Website</Label>
                        <Input value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="janesmith.dev" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Job Preferences */}
                {activeStep === 2 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h2 className="text-xl font-semibold mb-0.5">Job Preferences</h2>
                      <p className="text-sm text-muted-foreground">What kinds of roles should Hunter surface for you?</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Target Job Titles <span className="text-muted-foreground font-normal">(comma-separated)</span></Label>
                        <Input value={jobTitles} onChange={e => setJobTitles(e.target.value)} placeholder="Software Engineer, Full-Stack Developer, SWE" />
                      </div>
                      <div className="space-y-2">
                        <Label>Preferred Locations</Label>
                        <LocationPicker locations={locations} onChange={setLocations} />
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
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="remote">Remote Only</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="onsite">On-site</option>
                            <option value="any">Any</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2 pt-4 border-t border-border">
                        <Label className="text-destructive/80">Companies to Exclude</Label>
                        <Input
                          value={blacklist}
                          onChange={e => setBlacklist(e.target.value)}
                          placeholder="e.g. Crossover, Revature"
                          className="border-destructive/20 focus:border-destructive/50"
                        />
                        <p className="text-xs text-muted-foreground">Hunter will deprioritize these companies in your feed.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Application Defaults */}
                {activeStep === 3 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h2 className="text-xl font-semibold mb-0.5">Application Defaults</h2>
                      <p className="text-sm text-muted-foreground">Common answers to questions on job application forms.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
                        <div>
                          <Label className="text-sm font-medium">Require Visa Sponsorship?</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Will you now or in the future require work authorization?</p>
                        </div>
                        <Switch checked={requireSponsorship} onCheckedChange={setRequireSponsorship} />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
                        <div>
                          <Label className="text-sm font-medium">Active Security Clearance</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Do you hold a current government security clearance?</p>
                        </div>
                        <Switch checked={hasClearance} onCheckedChange={setHasClearance} />
                      </div>
                      <div className="space-y-2">
                        <Label>Expected Annual Salary (USD)</Label>
                        <Input type="number" value={expectedSalary} onChange={e => setExpectedSalary(e.target.value)} placeholder="120000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Notice Period (Days)</Label>
                        <Input type="number" value={noticePeriod} onChange={e => setNoticePeriod(e.target.value)} placeholder="14" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Search Settings */}
                {activeStep === 4 && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h2 className="text-xl font-semibold mb-0.5">Search Settings</h2>
                      <p className="text-sm text-muted-foreground">Control how broadly Hunter searches for job matches.</p>
                    </div>
                    <div className="space-y-5">
                      <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                          <Label className="text-sm font-medium">Search Intensity</Label>
                          <span className="text-xs font-medium text-primary tabular-nums">Level {intensity[0]}</span>
                        </div>
                        <Slider
                          value={intensity}
                          onValueChange={setIntensity}
                          min={1}
                          max={7}
                          step={1}
                        />
                        <p className="text-sm text-muted-foreground">{INTENSITY_LABELS[intensity[0]]}</p>
                        <p className="text-xs text-muted-foreground/70">Higher intensity means Hunter searches across more query variations and surfaces a broader range of matching roles.</p>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
                        <div>
                          <Label className="text-sm font-medium">Conservative Matching</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">Only surface roles that closely match your target titles and required skills.</p>
                        </div>
                        <Switch checked={safeMode} onCheckedChange={setSafeMode} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer actions */}
                <div className="pt-6 mt-6 border-t border-border flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    {activeStep > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveStep(s => s - 1)}>Back</Button>
                    )}
                    {activeStep < 4 && (
                      <Button variant="outline" size="sm" onClick={() => setActiveStep(s => s + 1)}>Next</Button>
                    )}
                  </div>
                  <Button onClick={handleSaveAll} disabled={saving}>
                    {saving
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                      : <><Save className="w-4 h-4 mr-2" /> Save Preferences</>
                    }
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

export default JobHuntPlanner;
// Route alias kept for backward compatibility with react-router imports
export { JobHuntPlanner as AutoApplierSettings };
