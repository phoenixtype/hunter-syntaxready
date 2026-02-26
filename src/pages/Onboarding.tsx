import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { savePreferences, UserPreferences } from "@/lib/user_preferences";
import { CandidateProfile, saveCandidateProfile, ExperienceAtom, Education, Skill } from "@/lib/resume_engine";
import { triggerJobCrawl } from "@/lib/crawler_engine";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocationPicker from "@/components/LocationPicker";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, ArrowLeft, ArrowRight, PenLine, X, Plus,
  User, Briefcase, Sparkles, GraduationCap, Target, Check,
} from "lucide-react";

const UNIVERSITIES = [
  "App Academy", "Australian National University", "Boston College", "Boston University",
  "Brown University", "California Institute of Technology", "Carnegie Mellon University",
  "Case Western Reserve University", "Coding Bootcamp", "Columbia University",
  "Concordia University", "Cornell University", "Dalhousie University", "Dartmouth College",
  "Duke University", "Emory University", "ETH Zurich", "Flatiron School",
  "General Assembly", "Georgetown University", "Georgia Institute of Technology",
  "Hack Reactor", "Harvard University", "HEC Paris", "Imperial College London",
  "Indiana University", "INSEAD", "Ironhack", "Johns Hopkins University",
  "King's College London", "Lambda School", "Le Wagon", "London School of Economics",
  "McGill University", "McMaster University", "Michigan State University", "MIT",
  "National University of Singapore", "New York University", "North Carolina State University",
  "Northwestern University", "Ohio State University", "Peking University", "Penn State University",
  "Princeton University", "Purdue University", "Queen's University", "Rice University",
  "Rutgers University", "Seoul National University", "Simon Fraser University",
  "Stanford University", "Technical University of Munich", "Texas A&M University",
  "Tsinghua University", "Tufts University", "Tulane University", "UC Berkeley",
  "UCLA", "University College London", "University of Alberta", "University of Amsterdam",
  "University of Arizona", "University of British Columbia", "University of Calgary",
  "University of Cambridge", "University of Chicago", "University of Colorado Boulder",
  "University of Edinburgh", "University of Florida", "University of Georgia",
  "University of Illinois Urbana-Champaign", "University of Leeds",
  "University of Manchester", "University of Maryland", "University of Melbourne",
  "University of Michigan", "University of Minnesota", "University of North Carolina Chapel Hill",
  "University of Notre Dame", "University of Ottawa", "University of Oxford",
  "University of Pennsylvania", "University of Rochester", "University of Sheffield",
  "University of Southern California", "University of Sydney", "University of Texas at Austin",
  "University of Tokyo", "University of Toronto", "University of Virginia",
  "University of Warwick", "University of Washington", "University of Waterloo",
  "University of Wisconsin-Madison", "Vanderbilt University", "Virginia Tech",
  "Wake Forest University", "Western University", "Yale University", "York University",
];

const DEGREES = [
  "B.S.", "B.A.", "B.Eng.", "B.B.A.", "B.Tech", "B.Com.",
  "M.S.", "M.A.", "M.Eng.", "M.B.A.", "M.Sc.", "M.Phil.",
  "Ph.D.", "J.D.", "M.D.", "D.Eng.",
  "Associate's Degree", "High School Diploma / GED",
  "Certificate", "Bootcamp / Coding School",
];

const GRAD_YEARS = Array.from({ length: 2031 - 1960 + 1 }, (_, i) => String(2031 - i));

const STEPS = [
  { id: "method",     label: "Welcome",     icon: Sparkles,     desc: "" },
  { id: "identity",   label: "About you",   icon: User,         desc: "Contact info & summary" },
  { id: "experience", label: "Experience",  icon: Briefcase,    desc: "Work history & achievements" },
  { id: "skills",     label: "Skills",      icon: Sparkles,     desc: "Technical & soft skills" },
  { id: "education",  label: "Education",   icon: GraduationCap,desc: "Degrees & field of study" },
  { id: "preferences",label: "Preferences", icon: Target,       desc: "Target roles & locations" },
] as const;

type StepId = typeof STEPS[number]["id"];

const emptyProfile: CandidateProfile = {
  identity: { name: "", email: "", phone: "", links: [] },
  skills: [],
  experience_atoms: [],
  education: [],
};

// ── Step header badge ────────────────────────────────────────────────────────
function StepBadge({ stepId, stepIndex, total }: { stepId: StepId; stepIndex: number; total: number }) {
  const step = STEPS.find(s => s.id === stepId)!;
  const Icon = step.icon;
  return (
    <div className="flex items-center gap-3 pt-8 mb-5">
      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <span className="text-xs font-semibold text-primary/70 uppercase tracking-widest">
        Step {stepIndex} of {total - 1}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("method");
  const [profile, setProfile] = useState<CandidateProfile>({ ...emptyProfile });

  const [roles, setRoles] = useState<string[]>([]);
  const [currentRole, setCurrentRole] = useState("");
  const [salary, setSalary] = useState([120000]);
  const [locations, setLocations] = useState<string[]>([]);
  const [remotePolicy, setRemotePolicy] = useState<UserPreferences["remote_policy"]>("any");
  const [aggressiveness, setAggressiveness] = useState([5]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.email && !profile.identity.email) {
      setProfile(prev => ({ ...prev, identity: { ...prev.identity, email: user.email! } }));
    }
  }, [user]);

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progressPercent = (stepIndex / (STEPS.length - 1)) * 100;

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };
  const goBack = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveCandidateProfile(user.id, profile);
      await savePreferences(user.id, {
        target_roles: roles,
        min_salary_usd: salary[0],
        locations,
        remote_policy: remotePolicy,
        aggressiveness: aggressiveness[0],
        safe_mode: true,
      });
      const keywords = profile.skills.slice(0, 5).map(s => s.name).filter(Boolean);
      triggerJobCrawl({
        keywords: keywords.length > 0 ? keywords : undefined,
        targetRoles: roles.length > 0 ? roles : undefined,
        location: locations.length > 0 ? locations.join(", ") : undefined,
        remotePolicy,
      }).catch(() => {});
      toast.success("You're all set!");
      navigate("/dashboard");
    } catch (err) {
      console.error("Onboarding save failed:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addExperience = () =>
    setProfile(p => ({
      ...p,
      experience_atoms: [
        ...p.experience_atoms,
        { id: crypto.randomUUID(), company: "", role: "", duration: "", content: "", keywords: [] },
      ],
    }));

  const updateExperience = (idx: number, field: keyof ExperienceAtom, value: string) =>
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
    setProfile(p => ({ ...p, skills: [...p.skills, { name: name.trim(), proficiency: 3, evidence: [] }] }));
  };

  const removeSkill = (idx: number) =>
    setProfile(p => ({ ...p, skills: p.skills.filter((_, i) => i !== idx) }));

  const addEducation = () =>
    setProfile(p => ({ ...p, education: [...p.education, { school: "", degree: "", field: "", year: "" }] }));

  const updateEducation = (idx: number, key: keyof Education, value: string) =>
    setProfile(p => {
      const edu = [...p.education];
      edu[idx] = { ...edu[idx], [key]: value };
      return { ...p, education: edu };
    });

  const removeEducation = (idx: number) =>
    setProfile(p => ({ ...p, education: p.education.filter((_, i) => i !== idx) }));

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Sticky top nav ─────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <Progress value={progressPercent} className="h-0.5 rounded-none bg-muted [&>div]:bg-primary" />
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Left */}
          {currentStep === "method" ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </button>
          ) : (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}

          {/* Center — step label + dots */}
          <div className="flex flex-col items-center gap-0.5">
            {currentStep !== "method" && (
              <span className="text-xs font-semibold text-foreground/70">
                {STEPS[stepIndex].label}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <div
                  key={s.id}
                  className={`rounded-full transition-all duration-300 ${
                    i < stepIndex  ? "w-2 h-2 bg-primary/60" :
                    i === stepIndex ? "w-2.5 h-2.5 bg-primary" :
                    "w-2 h-2 bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Right */}
          {currentStep === "method" ? (
            <div className="w-20" />
          ) : currentStep === "preferences" ? (
            <Button onClick={handleFinish} disabled={saving} size="sm" className="gap-1.5 h-9">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? "Saving…" : "Finish"}
            </Button>
          ) : (
            <Button onClick={goNext} size="sm" className="gap-1.5 h-9">
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="pt-14 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* ── METHOD / WELCOME ─────────────────────────────────────── */}
          {currentStep === "method" && (
            <div className="animate-fade-in pt-12">
              {/* Hero */}
              <div className="text-center space-y-3 mb-10">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Build your profile</h1>
                <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                  5 quick steps — Hunter uses your profile to find and tailor jobs just for you.
                </p>
              </div>

              {/* Step preview list */}
              <div className="max-w-sm mx-auto space-y-1 mb-10">
                {STEPS.filter(s => s.id !== "method").map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors group">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">{s.desc}</span>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 border-border shrink-0 opacity-50" />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={() => setCurrentStep("identity")}
                  className="gap-2 h-12 px-10 shadow-sm"
                >
                  Get started <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── IDENTITY ─────────────────────────────────────────────── */}
          {currentStep === "identity" && (
            <>
              <StepBadge stepId="identity" stepIndex={stepIndex} total={STEPS.length} />
              <IdentityStep profile={profile} setProfile={setProfile} />
            </>
          )}

          {/* ── EXPERIENCE ───────────────────────────────────────────── */}
          {currentStep === "experience" && (
            <div className="animate-fade-in">
              <StepBadge stepId="experience" stepIndex={stepIndex} total={STEPS.length} />
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl font-bold">Work experience</h2>
                <p className="text-muted-foreground text-sm">Add your most relevant positions.</p>
              </div>
              <div className="space-y-4">
                {profile.experience_atoms.map((exp, idx) => (
                  <div key={exp.id || idx} className="p-5 rounded-xl border border-border bg-card space-y-4 animate-fade-in-up">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary/60 bg-primary/10 rounded-md px-2 py-0.5">
                          #{idx + 1}
                        </span>
                      </div>
                      <button onClick={() => removeExperience(idx)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Job title</Label>
                        <Input value={exp.role} onChange={e => updateExperience(idx, "role", e.target.value)} placeholder="Software Engineer" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Company</Label>
                        <Input value={exp.company} onChange={e => updateExperience(idx, "company", e.target.value)} placeholder="Acme Inc." />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Duration</Label>
                      <Input value={exp.duration} onChange={e => updateExperience(idx, "duration", e.target.value)} placeholder="Jan 2022 — Present" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Key responsibilities</Label>
                      <Textarea value={exp.content} onChange={e => updateExperience(idx, "content", e.target.value)} placeholder="• Led a team of 5 engineers..." className="min-h-[100px] resize-y" />
                    </div>
                  </div>
                ))}
                <button
                  onClick={addExperience}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {profile.experience_atoms.length === 0 ? "Add your first position" : "Add another position"}
                </button>
              </div>
            </div>
          )}

          {/* ── SKILLS ───────────────────────────────────────────────── */}
          {currentStep === "skills" && (
            <>
              <StepBadge stepId="skills" stepIndex={stepIndex} total={STEPS.length} />
              <SkillsStep skills={profile.skills} onAdd={addSkill} onRemove={removeSkill} />
            </>
          )}

          {/* ── EDUCATION ────────────────────────────────────────────── */}
          {currentStep === "education" && (
            <div className="animate-fade-in">
              <StepBadge stepId="education" stepIndex={stepIndex} total={STEPS.length} />
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl font-bold">Education</h2>
                <p className="text-muted-foreground text-sm">Add your degrees and certifications.</p>
              </div>
              <div className="space-y-4">
                {profile.education.map((edu, idx) => (
                  <div key={idx} className="p-5 rounded-xl border border-border bg-card space-y-4 animate-fade-in-up">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-xs font-bold text-primary/60 bg-primary/10 rounded-md px-2 py-0.5">
                        #{idx + 1}
                      </span>
                      <button onClick={() => removeEducation(idx)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* School */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">School / Institution</Label>
                      <SchoolCombobox value={edu.school} onChange={v => updateEducation(idx, "school", v)} />
                    </div>

                    {/* Degree + Field of Study */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Degree</Label>
                        <Select value={edu.degree} onValueChange={v => updateEducation(idx, "degree", v)}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select degree" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEGREES.map(d => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Field of Study <span className="font-normal">(optional)</span>
                        </Label>
                        <Input
                          value={edu.field || ""}
                          onChange={e => updateEducation(idx, "field", e.target.value)}
                          placeholder="e.g. Computer Science"
                          className="h-10"
                        />
                      </div>
                    </div>

                    {/* Graduation year */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Graduation Year</Label>
                      <Select value={edu.year} onValueChange={v => updateEducation(idx, "year", v)}>
                        <SelectTrigger className="h-10 max-w-[160px]">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRAD_YEARS.map(y => (
                            <SelectItem key={y} value={y}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addEducation}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {profile.education.length === 0 ? "Add your first degree" : "Add another degree"}
                </button>
              </div>
            </div>
          )}

          {/* ── PREFERENCES ──────────────────────────────────────────── */}
          {currentStep === "preferences" && (
            <div className="animate-fade-in">
              <StepBadge stepId="preferences" stepIndex={stepIndex} total={STEPS.length} />
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl font-bold">Job preferences</h2>
                <p className="text-muted-foreground text-sm">What are you looking for?</p>
              </div>
              <div className="space-y-8">

                {/* Target Roles */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Target Roles</Label>
                  <div className="flex flex-wrap gap-2 min-h-[36px]">
                    {roles.map((role, i) => (
                      <Badge key={i} variant="secondary" className="pl-3 pr-1.5 py-1.5 gap-1 text-sm bg-primary/10 text-primary border-primary/20">
                        {role}
                        <button onClick={() => setRoles(roles.filter((_, idx) => idx !== i))} className="hover:text-destructive"><X className="w-3 h-3" /></button>
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
                          if (currentRole.trim() && !roles.includes(currentRole.trim())) setRoles([...roles, currentRole.trim()]);
                          setCurrentRole("");
                        }
                      }}
                      placeholder="e.g. Senior Frontend Engineer"
                      className="h-12"
                    />
                    <Button type="button" variant="secondary" size="icon" className="h-12 w-12 shrink-0"
                      onClick={() => { if (currentRole.trim() && !roles.includes(currentRole.trim())) setRoles([...roles, currentRole.trim()]); setCurrentRole(""); }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Salary */}
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <Label className="text-sm font-semibold">Minimum Base Salary</Label>
                    <span className="text-lg font-mono font-semibold">${salary[0].toLocaleString()}</span>
                  </div>
                  <Slider value={salary} onValueChange={setSalary} min={30000} max={500000} step={5000} />
                </div>

                {/* Locations */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Preferred Locations</Label>
                  <LocationPicker locations={locations} onChange={setLocations} />
                </div>

                {/* Remote Policy */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Work Style</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["remote", "hybrid", "onsite", "any"] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRemotePolicy(mode)}
                        className={`h-11 rounded-lg text-sm font-medium border transition-all ${
                          remotePolicy === mode
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card border-border hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aggressiveness */}
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <Label className="text-sm font-semibold">Search Intensity</Label>
                    <span className="text-sm text-muted-foreground font-mono">Level {aggressiveness[0]}</span>
                  </div>
                  <Slider value={aggressiveness} onValueChange={setAggressiveness} min={1} max={10} step={1} />
                  <p className="text-xs text-muted-foreground">Higher = more auto-applications. Lower = more selective.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ── IdentityStep ──────────────────────────────────────────────────────────────
function IdentityStep({ profile, setProfile }: { profile: CandidateProfile; setProfile: React.Dispatch<React.SetStateAction<CandidateProfile>> }) {
  const links = profile.identity.links || [];
  const getLink = (i: number) => links[i] || "";
  const setLink = (i: number, val: string) => {
    const next = [...links];
    next[i] = val;
    const rebuilt: string[] = [];
    if (next[0]?.trim()) rebuilt[0] = next[0].trim();
    if (next[1]?.trim()) rebuilt[1] = next[1].trim();
    if (next[2]?.trim()) rebuilt[2] = next[2].trim();
    setProfile(p => ({ ...p, identity: { ...p.identity, links: rebuilt.filter(Boolean) } }));
  };

  const summary = profile.summary || "";
  const setSummary = (val: string) => setProfile(p => ({ ...p, summary: val }));

  // Derive initials for avatar preview
  const name = profile.identity.name;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

  return (
    <div className="animate-fade-in space-y-6">
      {/* Avatar / name preview */}
      {name && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border">
          <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{initials || "?"}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{profile.identity.email || "Add your email below"}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">About you</h2>
        <p className="text-muted-foreground text-sm">Your contact details and professional presence.</p>
      </div>

      {/* Core contact */}
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={profile.identity.name}
              onChange={e => setProfile(p => ({ ...p, identity: { ...p.identity, name: e.target.value } }))}
              placeholder="Jane Smith"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={profile.identity.email}
              onChange={e => setProfile(p => ({ ...p, identity: { ...p.identity, email: e.target.value } }))}
              placeholder="jane@example.com"
              type="email"
              className="h-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Phone <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
          <Input
            value={profile.identity.phone || ""}
            onChange={e => setProfile(p => ({ ...p, identity: { ...p.identity, phone: e.target.value } }))}
            placeholder="+1 (555) 000-0000"
            className="h-11"
          />
        </div>
      </div>

      {/* Professional summary */}
      <div className="space-y-2">
        <Label>Professional Summary <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
        <Textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="2–3 sentences highlighting your experience, expertise, and what makes you a strong candidate."
          className="min-h-[90px] resize-y text-sm"
        />
      </div>

      {/* Links */}
      <div className="space-y-3">
        <Label>Professional Links <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
        <div className="space-y-2.5">
          {[
            { icon: "in", placeholder: "linkedin.com/in/janesmith", label: "LinkedIn" },
            { icon: "gh", placeholder: "github.com/janesmith", label: "GitHub" },
            { icon: "🌐", placeholder: "janesmith.dev or portfolio link", label: "Portfolio / Website" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 select-none">
                {item.icon}
              </span>
              <Input
                value={getLink(i)}
                onChange={e => setLink(i, e.target.value)}
                placeholder={item.placeholder}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SkillsStep ────────────────────────────────────────────────────────────────
function SkillsStep({ skills, onAdd, onRemove }: { skills: Skill[]; onAdd: (name: string) => void; onRemove: (idx: number) => void }) {
  const [input, setInput] = useState("");
  const SUGGESTED = ["JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL", "AWS", "Docker", "Kubernetes", "Go", "Java", "Figma", "GraphQL", "REST APIs", "Git", "CI/CD", "Agile", "Leadership"];
  const unusedSuggestions = SUGGESTED.filter(s => !skills.some(sk => sk.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Skills</h2>
        <p className="text-muted-foreground text-sm">Add your technical and professional skills.</p>
      </div>

      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-2 p-4 rounded-xl bg-muted/30 border border-border min-h-[60px]">
          {skills.map((s, i) => (
            <Badge key={i} variant="secondary" className="pl-3 pr-1.5 py-1.5 gap-1 text-sm bg-primary/10 text-primary border-primary/20 animate-scale-in">
              {s.name}
              <button onClick={() => onRemove(i)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-border text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No skills yet — add some below or pick from suggestions</p>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAdd(input); setInput(""); } }}
          placeholder="Type a skill and press Enter"
          className="h-12"
        />
        <Button variant="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={() => { onAdd(input); setInput(""); }}>
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {unusedSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Quick add</p>
          <div className="flex flex-wrap gap-2">
            {unusedSuggestions.map(s => (
              <button
                key={s}
                onClick={() => onAdd(s)}
                className="px-3 py-1.5 text-sm rounded-lg border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
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

// ── SchoolCombobox ────────────────────────────────────────────────────────────
function SchoolCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const filtered = value.length > 1
    ? UNIVERSITIES.filter(u => u.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => value.length > 1 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        placeholder="Search or type school name"
        className="h-10"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(u => (
            <button
              key={u}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={e => { e.preventDefault(); onChange(u); setOpen(false); }}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Onboarding;
