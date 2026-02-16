import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { savePreferences, UserPreferences } from "@/lib/user_preferences";
import { CandidateProfile, saveCandidateProfile, ExperienceAtom, Education, Skill } from "@/lib/resume_engine";
import { triggerJobCrawl } from "@/lib/crawler_engine";
import { ResumeUpload } from "@/components/resume/ResumeUpload";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, ArrowLeft, ArrowRight, Upload, PenLine, X, Plus,
  User, Briefcase, Sparkles, GraduationCap, Target, Check
} from "lucide-react";

// Steps for the onboarding wizard
const STEPS = [
  { id: "method", label: "Start", icon: Sparkles },
  { id: "identity", label: "You", icon: User },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "preferences", label: "Preferences", icon: Target },
] as const;

type StepId = typeof STEPS[number]["id"];

const emptyProfile: CandidateProfile = {
  identity: { name: "", email: "", phone: "", links: [] },
  skills: [],
  experience_atoms: [],
  education: [],
};

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("method");
  const [profile, setProfile] = useState<CandidateProfile>({ ...emptyProfile });

  // Preferences state
  const [roles, setRoles] = useState<string[]>([]);
  const [currentRole, setCurrentRole] = useState("");
  const [salary, setSalary] = useState([120000]);
  const [locations, setLocations] = useState("");
  const [remotePolicy, setRemotePolicy] = useState<UserPreferences["remote_policy"]>("any");
  const [aggressiveness, setAggressiveness] = useState([5]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // Pre-fill email from auth
  useEffect(() => {
    if (user?.email && !profile.identity.email) {
      setProfile(prev => ({
        ...prev,
        identity: { ...prev.identity, email: user.email! }
      }));
    }
  }, [user]);

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progressPercent = ((stepIndex) / (STEPS.length - 1)) * 100;

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };
  const goBack = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id);
  };

  // Resume upload handler — pre-fill everything and jump to preferences
  const handleResumeParsed = (parsed: CandidateProfile) => {
    setProfile(parsed);
    // Pre-fill roles from experience
    const suggestedRoles = [
      ...parsed.experience_atoms.map(e => e.role),
      ...parsed.skills.slice(0, 3).map(s => s.name),
    ].filter(Boolean).slice(0, 5);
    setRoles(prev => Array.from(new Set([...prev, ...suggestedRoles])));
    toast.success("Resume parsed! Review your details or skip ahead.");
    setCurrentStep("identity");
  };

  // Final submit
  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveCandidateProfile(user.id, profile);
      await savePreferences(user.id, {
        target_roles: roles,
        min_salary_usd: salary[0],
        locations: locations.split(",").map(s => s.trim()).filter(Boolean),
        remote_policy: remotePolicy,
        aggressiveness: aggressiveness[0],
        safe_mode: true,
      });

      // Trigger job crawl in background with full preferences
      const keywords = [
        ...profile.skills.slice(0, 5).map(s => s.name),
      ].filter(Boolean);
      triggerJobCrawl({
        keywords: keywords.length > 0 ? keywords : undefined,
        targetRoles: roles.length > 0 ? roles : undefined,
        location: locations.trim() || undefined,
        remotePolicy: remotePolicy,
      }).catch(() => {});

      toast.success("You're all set! Let's find your next role.");
      navigate("/dashboard");
    } catch (err) {
      console.error("Onboarding save failed:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Helpers for editing profile
  const updateIdentity = (field: string, value: string) =>
    setProfile(p => ({ ...p, identity: { ...p.identity, [field]: value } }));

  const addExperience = () =>
    setProfile(p => ({
      ...p,
      experience_atoms: [
        ...p.experience_atoms,
        { id: crypto.randomUUID(), company: "", role: "", duration: "", content: "", keywords: [] },
      ],
    }));

  const updateExperience = (idx: number, field: keyof ExperienceAtom, value: any) =>
    setProfile(p => {
      const atoms = [...p.experience_atoms];
      atoms[idx] = { ...atoms[idx], [field]: value };
      return { ...p, experience_atoms: atoms };
    });

  const removeExperience = (idx: number) =>
    setProfile(p => ({ ...p, experience_atoms: p.experience_atoms.filter((_, i) => i !== idx) }));

  const addSkill = (name: string) => {
    if (!name.trim()) return;
    if (profile.skills.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) return;
    setProfile(p => ({
      ...p,
      skills: [...p.skills, { name: name.trim(), proficiency: 3, evidence: [] }],
    }));
  };

  const removeSkill = (idx: number) =>
    setProfile(p => ({ ...p, skills: p.skills.filter((_, i) => i !== idx) }));

  const addEducation = () =>
    setProfile(p => ({
      ...p,
      education: [...p.education, { school: "", degree: "", year: "" }],
    }));

  const updateEducation = (idx: number, field: keyof Education, value: string) =>
    setProfile(p => {
      const edu = [...p.education];
      edu[idx] = { ...edu[idx], [field]: value };
      return { ...p, education: edu };
    });

  const removeEducation = (idx: number) =>
    setProfile(p => ({ ...p, education: p.education.filter((_, i) => i !== idx) }));

  // Can user skip to end?
  const canFinish = roles.length > 0 || profile.experience_atoms.length > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <Progress value={progressPercent} className="h-1 rounded-none" />
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {stepIndex > 0 && (
              <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <span className="text-sm font-medium text-muted-foreground">
              Step {stepIndex + 1} of {STEPS.length}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          {canFinish && currentStep !== "method" && (
            <button
              onClick={() => setCurrentStep("preferences")}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Skip to finish
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="pt-20 pb-32 px-4">
        <div className="max-w-2xl mx-auto">

          {/* ===== STEP: METHOD ===== */}
          {currentStep === "method" && (
            <div className="animate-fade-in space-y-8 text-center pt-12">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Let's build your profile
                </h1>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  Choose how you'd like to get started. You can always edit everything later.
                </p>
              </div>

              <div className="grid gap-4 max-w-md mx-auto pt-4">
                <button
                  onClick={() => setCurrentStep("identity")}
                  className="group flex items-center gap-4 p-5 rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors text-left"
                >
                  <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <PenLine className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">Enter manually</p>
                    <p className="text-sm text-muted-foreground">Fill in your details step by step</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-xs text-muted-foreground uppercase tracking-wider">or</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Upload a resume and we'll fill everything in</p>
                  <ResumeUpload onUploadComplete={handleResumeParsed} />
                </div>
              </div>
            </div>
          )}

          {/* ===== STEP: IDENTITY ===== */}
          {currentStep === "identity" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">About you</h2>
                <p className="text-muted-foreground">Basic contact information for your profile.</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={profile.identity.name}
                    onChange={e => updateIdentity("name", e.target.value)}
                    placeholder="Jane Smith"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={profile.identity.email}
                    onChange={e => updateIdentity("email", e.target.value)}
                    placeholder="jane@example.com"
                    type="email"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    value={profile.identity.phone || ""}
                    onChange={e => updateIdentity("phone", e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn / Portfolio URL <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    value={profile.identity.links?.[0] || ""}
                    onChange={e =>
                      setProfile(p => ({
                        ...p,
                        identity: { ...p.identity, links: e.target.value ? [e.target.value] : [] },
                      }))
                    }
                    placeholder="https://linkedin.com/in/janesmith"
                    className="h-12"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ===== STEP: EXPERIENCE ===== */}
          {currentStep === "experience" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Work experience</h2>
                <p className="text-muted-foreground">Add your most recent and relevant positions.</p>
              </div>

              <div className="space-y-4">
                {profile.experience_atoms.map((exp, idx) => (
                  <div key={exp.id || idx} className="p-4 rounded-lg border border-border bg-card space-y-3 animate-fade-in">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Job title</Label>
                          <Input
                            value={exp.role}
                            onChange={e => updateExperience(idx, "role", e.target.value)}
                            placeholder="Software Engineer"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Company</Label>
                          <Input
                            value={exp.company}
                            onChange={e => updateExperience(idx, "company", e.target.value)}
                            placeholder="Acme Inc."
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeExperience(idx)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors mt-5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Duration</Label>
                      <Input
                        value={exp.duration}
                        onChange={e => updateExperience(idx, "duration", e.target.value)}
                        placeholder="Jan 2022 — Present"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Key responsibilities & achievements</Label>
                      <Textarea
                        value={exp.content}
                        onChange={e => updateExperience(idx, "content", e.target.value)}
                        placeholder="• Led a team of 5 engineers..."
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addExperience}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add position
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP: SKILLS ===== */}
          {currentStep === "skills" && (
            <SkillsStep
              skills={profile.skills}
              onAdd={addSkill}
              onRemove={removeSkill}
            />
          )}

          {/* ===== STEP: EDUCATION ===== */}
          {currentStep === "education" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Education</h2>
                <p className="text-muted-foreground">Add your degrees and certifications.</p>
              </div>

              <div className="space-y-4">
                {profile.education.map((edu, idx) => (
                  <div key={idx} className="p-4 rounded-lg border border-border bg-card space-y-3 animate-fade-in">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">School</Label>
                          <Input
                            value={edu.school}
                            onChange={e => updateEducation(idx, "school", e.target.value)}
                            placeholder="MIT"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Degree</Label>
                            <Input
                              value={edu.degree}
                              onChange={e => updateEducation(idx, "degree", e.target.value)}
                              placeholder="B.S. Computer Science"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Year</Label>
                            <Input
                              value={edu.year}
                              onChange={e => updateEducation(idx, "year", e.target.value)}
                              placeholder="2020"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeEducation(idx)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors mt-5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addEducation}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add education
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP: PREFERENCES ===== */}
          {currentStep === "preferences" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Job preferences</h2>
                <p className="text-muted-foreground">Tell us what you're looking for so we can find the best matches.</p>
              </div>

              <div className="space-y-8">
                {/* Target Roles */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Target Roles</Label>
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
                          if (currentRole.trim() && !roles.includes(currentRole.trim())) {
                            setRoles([...roles, currentRole.trim()]);
                          }
                          setCurrentRole("");
                        }
                      }}
                      placeholder="e.g. Senior Frontend Engineer"
                      className="h-11"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onClick={() => {
                        if (currentRole.trim() && !roles.includes(currentRole.trim())) {
                          setRoles([...roles, currentRole.trim()]);
                        }
                        setCurrentRole("");
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Salary */}
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <Label className="text-base font-medium">Minimum Base Salary</Label>
                    <span className="text-lg font-mono font-semibold">${salary[0].toLocaleString()}</span>
                  </div>
                  <Slider value={salary} onValueChange={setSalary} min={30000} max={500000} step={5000} />
                </div>

                {/* Location + Remote */}
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Preferred Locations</Label>
                    <Input
                      value={locations}
                      onChange={e => setLocations(e.target.value)}
                      placeholder="SF, NYC, Remote"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Remote Policy</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["remote", "hybrid", "onsite", "any"] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setRemotePolicy(mode)}
                          className={`h-10 rounded-lg text-sm font-medium border transition-colors ${
                            remotePolicy === mode
                              ? "bg-foreground text-background border-foreground"
                              : "border-border hover:border-foreground/20"
                          }`}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Aggressiveness */}
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <Label className="text-base font-medium">Search Intensity</Label>
                    <span className="text-sm text-muted-foreground font-mono">Level {aggressiveness[0]}</span>
                  </div>
                  <Slider value={aggressiveness} onValueChange={setAggressiveness} min={1} max={10} step={1} />
                  <p className="text-xs text-muted-foreground">
                    Higher = more applications sent automatically. Lower = more selective, manual approval.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav bar */}
      {currentStep !== "method" && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={goBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            {currentStep === "preferences" ? (
              <Button onClick={handleFinish} disabled={saving} className="gap-2 px-6">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Finish Setup"}
              </Button>
            ) : (
              <Button onClick={goNext} className="gap-2 px-6">
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ===== Skills Sub-component =====
function SkillsStep({
  skills,
  onAdd,
  onRemove,
}: {
  skills: Skill[];
  onAdd: (name: string) => void;
  onRemove: (idx: number) => void;
}) {
  const [input, setInput] = useState("");

  const SUGGESTED = [
    "JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL",
    "AWS", "Docker", "Kubernetes", "Go", "Java", "Figma",
    "GraphQL", "REST APIs", "Git", "CI/CD", "Agile", "Leadership",
  ];

  const unusedSuggestions = SUGGESTED.filter(
    s => !skills.some(sk => sk.name.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="animate-fade-in space-y-8 pt-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Skills</h2>
        <p className="text-muted-foreground">Add your technical and professional skills.</p>
      </div>

      {/* Current skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skills.map((s, i) => (
            <Badge key={i} variant="secondary" className="pl-3 pr-1.5 py-1.5 gap-1 text-sm animate-scale-in">
              {s.name}
              <button onClick={() => onRemove(i)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(input);
              setInput("");
            }
          }}
          placeholder="Type a skill and press Enter"
          className="h-11"
        />
        <Button
          variant="secondary"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => {
            onAdd(input);
            setInput("");
          }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick-add suggestions */}
      {unusedSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Quick add</p>
          <div className="flex flex-wrap gap-2">
            {unusedSuggestions.map(s => (
              <button
                key={s}
                onClick={() => onAdd(s)}
                className="px-3 py-1.5 text-sm rounded-full border border-dashed border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Onboarding;
