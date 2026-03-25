import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import SingleLocationPicker from "@/components/SingleLocationPicker";
import { useAuth } from "@/hooks/useAuth";
import SEOHead from "@/components/SEOHead";
import { toast } from "sonner";
import { savePreferences, getPreferences, UserPreferences } from "@/lib/user_preferences";
import { CandidateProfile, saveCandidateProfile, getCandidateProfile, ExperienceAtom, Education, Skill } from "@/lib/resume_engine";
import { triggerJobCrawl } from "@/lib/crawler_engine";
import { setUserRole } from "@/lib/recruiter_engine";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocationPicker from "@/components/LocationPicker";
import {
  Loader2, ArrowLeft, ArrowRight, X, Plus,
  User, Briefcase, Sparkles, GraduationCap, Target, Check,
  TrendingUp, Zap, Search,
} from "lucide-react";

// ─────────────────────────── DATA CONSTANTS ───────────────────────────────────

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

const AGE_RANGES = ["18–24", "25–29", "30–34", "35–39", "40–44", "45–49", "50–54", "55–59", "60–64", "65+"];

const WORK_AUTH_OPTIONS = [
  "US Citizen / Permanent Resident",
  "Requires H-1B Sponsorship",
  "Canadian Citizen / PR",
  "Requires Work Permit (Canada)",
  "EU Citizen",
  "UK Citizen / Settled Status",
  "Australian Citizen / PR",
  "Other / Not Applicable",
];

const EXP_LEVELS = [
  { id: "internship",  label: "Internship",        desc: "Student or recent grad",    emoji: "🎓" },
  { id: "entry",       label: "Entry Level",        desc: "0–1 years of experience",   emoji: "🌱" },
  { id: "junior",      label: "Junior",             desc: "1–2 years of experience",   emoji: "📈" },
  { id: "mid",         label: "Mid Level",          desc: "3–5 years of experience",   emoji: "⚡" },
  { id: "senior",      label: "Senior",             desc: "6–9 years of experience",   emoji: "🏆" },
  { id: "expert",      label: "Expert & Leadership", desc: "10+ years of experience",  emoji: "🚀" },
];

const JOB_VALUES = [
  "Meaningful work", "Experienced leaders", "Work-life balance", "Remote flexibility",
  "Competitive pay", "Growth opportunities", "Innovative technology", "Stable company",
  "Challenging work", "Strong team culture", "Equity / Ownership", "Great benefits",
];

const AGGRESSIVENESS_LABELS: Record<number, string> = {
  1: "Very selective — 1–2 applications/week",
  2: "Selective — 3–5 applications/week",
  3: "Conservative — ~10 applications/week",
  4: "Moderate — ~15 applications/week",
  5: "Balanced — ~20 applications/week",
  6: "Active — ~30 applications/week",
  7: "Aggressive — ~40 applications/week",
  8: "Very aggressive — ~50 applications/week",
  9: "Maximum effort — ~60 applications/week",
  10: "Shotgun — as many as possible",
};

// ─────────────────────────── STEPS ────────────────────────────────────────────

const STEPS = [
  { id: "method",    label: "Welcome",     icon: Sparkles,    desc: "" },
  { id: "intent",    label: "Job status",  icon: Search,      desc: "What you're looking for" },
  { id: "exp_level", label: "Experience",  icon: TrendingUp,  desc: "Your career stage" },
  { id: "identity",  label: "About you",   icon: User,        desc: "Contact info & summary" },
  { id: "experience",label: "Work history",icon: Briefcase,   desc: "Roles & achievements" },
  { id: "skills",    label: "Skills",      icon: Sparkles,    desc: "Technical & soft skills" },
  { id: "education", label: "Education",   icon: GraduationCap, desc: "Degrees & certifications" },
  { id: "preferences",label: "Preferences",icon: Target,      desc: "Target roles & locations" },
] as const;

type StepId = typeof STEPS[number]["id"];

const emptyProfile: CandidateProfile = {
  identity: { name: "", email: "", phone: "", links: [] },
  skills: [],
  experience_atoms: [],
  education: [],
};

// ─────────────────────────────────────────────────────────────────────────────

function handleBulletKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  setter: (val: string) => void
) {
  if (e.key === "Enter") {
    e.preventDefault();
    const { selectionStart, selectionEnd } = e.currentTarget;
    const newVal = value.substring(0, selectionStart) + "\n• " + value.substring(selectionEnd);
    setter(newVal);
    const newPos = selectionStart + 3;
    setTimeout(() => e.currentTarget.setSelectionRange(newPos, newPos), 0);
  }
}

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const dataLoaded = useRef(false);
  const [currentStep, setCurrentStep] = useState<StepId>("method");
  const [profile, setProfile] = useState<CandidateProfile>({ ...emptyProfile });

  // Preferences state
  const [roles, setRoles] = useState<string[]>([]);
  const [currentRole, setCurrentRole] = useState("");
  const [salary, setSalary] = useState([120000]);
  const [locations, setLocations] = useState<string[]>([]);
  const [remotePolicy, setRemotePolicy] = useState<UserPreferences["remote_policy"]>("any");
  const [aggressiveness, setAggressiveness] = useState([5]);
  const [jobValues, setJobValues] = useState<string[]>([]);

  // Identity extras
  const [searchStatus, setSearchStatus] = useState<"actively" | "open" | "exploring">("actively");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [workAuth, setWorkAuth] = useState("");
  const [age, setAge] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // On mount: restore saved step + load existing data from DB
  useEffect(() => {
    if (!user?.id) return;
    // Restore step from localStorage
    const savedStep = localStorage.getItem(`hunter_onboarding_step_${user.id}`);
    if (savedStep && STEPS.some(s => s.id === savedStep)) {
      setCurrentStep(savedStep as StepId);
    }
  }, [user?.id]); // Only run when user ID actually changes

  // Load existing profile + preferences from DB to pre-populate
  useEffect(() => {
    if (!user?.id || dataLoaded.current) return;

    Promise.all([
      getCandidateProfile(user.id).catch(() => null),
      getPreferences(user.id).catch(() => null),
    ]).then(([existingProfile, prefs]) => {
      if (existingProfile) {
        setProfile(existingProfile);
        // Extract hidden identity extras
        const id = existingProfile.identity as Record<string, unknown>;
        if (id._gender) setGender(id._gender as "male" | "female");
        if (id._work_auth) setWorkAuth(id._work_auth as string);
        if (id._age) setAge(id._age as string);
        if (id._search_status) setSearchStatus(id._search_status as "actively" | "open" | "exploring");
        if (id._exp_level) setExperienceLevel(id._exp_level as string);
        if (Array.isArray(id._job_values)) setJobValues(id._job_values as string[]);
      } else if (user.email) {
        // First time — seed email from auth
        setProfile(prev => ({ ...prev, identity: { ...prev.identity, email: user.email! } }));
      }
      if (prefs) {
        setRoles(prefs.target_roles);
        setSalary([prefs.min_salary_usd]);
        setLocations(prefs.locations);
        setRemotePolicy(prefs.remote_policy);
        setExperienceLevel(prefs.experience_level || "");
        setAggressiveness([prefs.aggressiveness]);
      }

      // Check for local draft - if it exists and is newer than the DB profile update, we can offer to restore
      // For simplicity in onboarding, we'll auto-restore if DB profile is empty but draft exists
      const savedDraft = localStorage.getItem(`hunter_onboarding_draft_${user.id}`);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          // If DB profile is basic but draft has data, auto-restore
          const isDbProfileEmpty = !existingProfile || (existingProfile.experience_atoms.length === 0 && existingProfile.skills.length === 0);
          if (isDbProfileEmpty && draft.profile) {
            setProfile(draft.profile);
            if (draft.preferences) {
              setRoles(draft.preferences.target_roles || []);
              setSalary([draft.preferences.min_salary_usd || 100000]);
              setLocations(draft.preferences.locations || []);
              setRemotePolicy(draft.preferences.remote_policy || "any");
              setExperienceLevel(draft.preferences.experience_level || "");
              setAggressiveness([draft.preferences.aggressiveness || 5]);
            }
            if (draft.step) setCurrentStep(draft.step);
            toast.info("Resumed from your last session");
          }
        } catch (e) {
          console.error("Failed to parse onboarding draft", e);
        }
      }

      dataLoaded.current = true;
    }).finally(() => setDataLoading(false));
  }, [user?.id, user?.email]);

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progressPercent = (stepIndex / (STEPS.length - 1)) * 100;

  // Persist current step to localStorage, but only after initial data has loaded
  // (prevents the default "method" from overwriting the restored step on first render)
  useEffect(() => {
    if (user && !dataLoading) {
      localStorage.setItem(`hunter_onboarding_step_${user.id}`, currentStep);
    }
  }, [currentStep, user, dataLoading]);

  // Auto-save draft to localStorage (debounced)
  useEffect(() => {
    if (!user?.id || dataLoading) return;

    const timer = setTimeout(() => {
      const draft = {
        profile,
        preferences: {
          target_roles: roles,
          min_salary_usd: salary[0],
          locations,
          remote_policy: remotePolicy,
          experience_level: experienceLevel,
          aggressiveness: aggressiveness[0],
        },
        step: currentStep,
        updatedAt: Date.now()
      };
      localStorage.setItem(`hunter_onboarding_draft_${user.id}`, JSON.stringify(draft));
    }, 2000);

    return () => clearTimeout(timer);
  }, [profile, roles, salary, locations, remotePolicy, experienceLevel, aggressiveness, currentStep, user?.id, dataLoading]);

  // Build the current payload to save
  const buildPayloads = () => {
    const identityWithExtras = {
      ...profile.identity,
      ...(gender && { _gender: gender }),
      ...(workAuth && { _work_auth: workAuth }),
      ...(age && { _age: age }),
      _search_status: searchStatus,
      ...(experienceLevel && { _exp_level: experienceLevel }),
      ...(jobValues.length && { _job_values: jobValues }),
    } as CandidateProfile["identity"];

    const profilePayload: CandidateProfile = { ...profile, identity: identityWithExtras };

    const prefsPayload: UserPreferences = {
      target_roles: roles,
      min_salary_usd: salary[0],
      locations,
      remote_policy: remotePolicy,
      experience_level: experienceLevel || 'mid',
      aggressiveness: aggressiveness[0],
      safe_mode: true,
      require_sponsorship: false,
      has_clearance: false,
      notice_period_days: 14,
      email_alerts_enabled: false,
      sms_alerts_enabled: false,
      tracker_view: 'list',
    };

    return { profilePayload, prefsPayload };
  };

  const saveProgress = async () => {
    if (!user) return;
    const { profilePayload, prefsPayload } = buildPayloads();
    await Promise.all([
      saveCandidateProfile(user.id, profilePayload),
      savePreferences(user.id, prefsPayload),
    ]);
  };

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };
  const goBack = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id);
  };

  // Auto-save on every Continue click, then advance
  const handleNext = async () => {
    saveProgress().catch(e => console.warn("Auto-save failed:", e)); // non-blocking
    goNext();
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveProgress();
      const keywords = profile.skills.slice(0, 5).map(s => s.name).filter(Boolean);
      triggerJobCrawl({
        keywords: keywords.length > 0 ? keywords : undefined,
        targetRoles: roles.length > 0 ? roles : undefined,
        location: locations.length > 0 ? locations.join(", ") : undefined,
        remotePolicy,
      }).catch(() => {});
      // Clear persisted step and draft so next visit starts fresh
      localStorage.removeItem(`hunter_onboarding_step_${user.id}`);
      localStorage.removeItem(`hunter_onboarding_draft_${user.id}`);
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      queryClient.invalidateQueries({ queryKey: ['candidate_profile'] });
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

  const toggleJobValue = (val: string) =>
    setJobValues(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start sm:justify-center py-8 px-4">
      <SEOHead title="Onboarding" description="Set up your Hunter AI profile and job search preferences." path="/onboarding" noIndex />
      <div className="w-full max-w-[580px]">

        {/* Logo mark */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-wide text-foreground/70">Hunter</span>
        </div>

        {/* ── Card ─────────────────────────────────────────────────────── */}
        <div className="bg-card rounded-md border border-border shadow-card overflow-hidden">

          {/* Progress bar */}
          <div className="h-[3px] bg-muted/60">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Step segment indicators (hidden on welcome) */}
          {currentStep !== "method" && (
            <div className="flex items-center justify-between px-6 sm:px-8 pt-5">
              <div className="flex items-center gap-1.5">
                {STEPS.slice(1).map((s, i) => (
                  <div
                    key={s.id}
                    className={`h-[3px] w-6 rounded-full transition-all duration-300 ${
                      i + 1 < stepIndex ? "bg-primary/50" :
                      i + 1 === stepIndex ? "bg-primary" :
                      "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                {stepIndex} / {STEPS.length - 1}
              </span>
            </div>
          )}

          {/* ── Card content ───────────────────────────────────────────── */}
          <div className="px-6 sm:px-8 pt-5 pb-2">

            {/* ── METHOD / WELCOME ──────────────────────────────────── */}
            {currentStep === "method" && (
              <div className="animate-fade-in py-3">
                <div className="text-center space-y-3 mb-8">
                  <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center mx-auto">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">Let's build your profile</h1>
                  <p className="text-muted-foreground max-w-xs mx-auto text-sm leading-relaxed">
                    7 quick steps — Hunter uses your profile to find, match, and auto-apply to jobs for you.
                  </p>
                </div>

                <div className="space-y-1 mb-8">
                  {STEPS.filter(s => s.id !== "method").map(s => {
                    const Icon = s.icon;
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors">
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{s.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{s.desc}</span>
                        </div>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-border shrink-0 opacity-40" />
                      </div>
                    );
                  })}
                </div>

                {/* Role selector */}
                <div className="space-y-3 mb-6 border border-border rounded-xl p-4 bg-muted/30">
                  <p className="text-sm font-semibold text-center">I am joining Hunter as a…</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCurrentStep("intent")}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-primary bg-primary/5 transition-all hover:shadow-md-1"
                    >
                      <Briefcase className="w-6 h-6 text-primary" />
                      <span className="text-sm font-semibold">Job Seeker</span>
                      <span className="text-[11px] text-muted-foreground text-center leading-tight">Find jobs, get matched & auto-apply</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (!user) return;
                        try {
                          await setUserRole(user.id, "recruiter");
                          navigate("/recruiter");
                        } catch (err) {
                          toast.error("Failed to set role. Please try again.");
                        }
                      }}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-muted/50 transition-all hover:shadow-md-1"
                    >
                      <User className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm font-semibold">Recruiter / HM</span>
                      <span className="text-[11px] text-muted-foreground text-center leading-tight">Post jobs & manage your pipeline</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── INTENT ────────────────────────────────────────────── */}
            {currentStep === "intent" && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Job status</p>
                  <h2 className="text-xl font-bold">Are you looking for a new job?</h2>
                  <p className="text-sm text-muted-foreground mt-1">This helps Hunter tune your experience.</p>
                </div>
                <div className="space-y-3 mb-4">
                  {[
                    {
                      id: "actively" as const,
                      label: "Yes, actively searching",
                      desc: "I'm applying and want maximum results",
                      emoji: "🔥",
                    },
                    {
                      id: "open" as const,
                      label: "Open to opportunities",
                      desc: "Not urgently searching but interested",
                      emoji: "👀",
                    },
                    {
                      id: "exploring" as const,
                      label: "Just exploring",
                      desc: "Curious about what's out there",
                      emoji: "🌿",
                    },
                  ].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSearchStatus(option.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-md border-2 text-left transition-all duration-200 ${
                        searchStatus === option.id
                          ? "border-primary bg-primary/8 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <span className="text-2xl shrink-0">{option.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${searchStatus === option.id ? "text-primary" : ""}`}>
                          {option.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{option.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                        searchStatus === option.id ? "border-primary bg-primary" : "border-border"
                      }`}>
                        {searchStatus === option.id && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── EXPERIENCE LEVEL ──────────────────────────────────── */}
            {currentStep === "exp_level" && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Career stage</p>
                  <h2 className="text-xl font-bold">How much experience do you have?</h2>
                  <p className="text-sm text-muted-foreground mt-1">We'll tailor job matches to your level.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {EXP_LEVELS.map(level => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setExperienceLevel(level.id)}
                      className={`flex flex-col items-start gap-2 p-4 rounded-md border-2 text-left transition-all duration-200 ${
                        experienceLevel === level.id
                          ? "border-primary bg-primary/8 shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-muted/30"
                      }`}
                    >
                      <span className="text-2xl">{level.emoji}</span>
                      <div>
                        <p className={`text-sm font-semibold leading-snug ${experienceLevel === level.id ? "text-primary" : ""}`}>
                          {level.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{level.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── IDENTITY ──────────────────────────────────────────── */}
            {currentStep === "identity" && (
              <div className="animate-fade-in">
                <div className="mb-5">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">About you</p>
                  <h2 className="text-xl font-bold">Contact & identity</h2>
                </div>
                <IdentityStep profile={profile} setProfile={setProfile} />

                {/* Personal details */}
                <div className="mt-5 pt-5 border-t border-border space-y-4">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Personal details <span className="font-normal normal-case">— optional, helps match relevant roles</span></p>

                  {/* Gender */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <div className="flex gap-2">
                      {(["male", "female"] as const).map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(prev => prev === g ? "" : g)}
                          className={`flex-1 h-10 rounded-md border-2 text-sm font-medium capitalize transition-all ${
                            gender === g
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/30"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Age */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Age range</Label>
                      <Select value={age} onValueChange={setAge}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select age" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGE_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Work Authorization */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Work authorization</Label>
                      <Select value={workAuth} onValueChange={setWorkAuth}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_AUTH_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── EXPERIENCE ────────────────────────────────────────── */}
            {currentStep === "experience" && (
              <div className="animate-fade-in">
                <div className="mb-5">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Work experience</p>
                  <h2 className="text-xl font-bold">Your roles & achievements</h2>
                </div>
                <div className="space-y-3">
                  {profile.experience_atoms.map((exp, idx) => (
                    <div key={exp.id || idx} className="p-4 rounded-md border border-border bg-muted/30 space-y-3 animate-fade-in-up">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary/60 bg-primary/10 rounded-md px-2 py-0.5">#{idx + 1}</span>
                        <button onClick={() => removeExperience(idx)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <Textarea
                          value={exp.content}
                          onChange={e => updateExperience(idx, "content", e.target.value)}
                          onKeyDown={e => handleBulletKeyDown(e, exp.content, val => updateExperience(idx, "content", val))}
                          placeholder={"• Led a team of 5 engineers…\n• Improved performance by 30%\n\nPress Enter to add a new bullet."}
                          className="min-h-[90px] resize-y"
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addExperience}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-md border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    {profile.experience_atoms.length === 0 ? "Add your first position" : "Add another position"}
                  </button>
                </div>
              </div>
            )}

            {/* ── SKILLS ────────────────────────────────────────────── */}
            {currentStep === "skills" && (
              <div className="animate-fade-in">
                <div className="mb-5">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Skills</p>
                  <h2 className="text-xl font-bold">Technical & professional skills</h2>
                </div>
                <SkillsStep skills={profile.skills} onAdd={addSkill} onRemove={removeSkill} />
              </div>
            )}

            {/* ── EDUCATION ─────────────────────────────────────────── */}
            {currentStep === "education" && (
              <div className="animate-fade-in">
                <div className="mb-5">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Education</p>
                  <h2 className="text-xl font-bold">Degrees & certifications</h2>
                </div>
                <div className="space-y-3">
                  {profile.education.map((edu, idx) => (
                    <div key={idx} className="p-4 rounded-md border border-border bg-muted/30 space-y-3 animate-fade-in-up">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary/60 bg-primary/10 rounded-md px-2 py-0.5">#{idx + 1}</span>
                        <button onClick={() => removeEducation(idx)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">School / Institution</Label>
                        <SchoolCombobox value={edu.school} onChange={v => updateEducation(idx, "school", v)} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Degree</Label>
                          <Select value={edu.degree} onValueChange={v => updateEducation(idx, "degree", v)}>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select degree" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEGREES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Field of Study <span className="font-normal opacity-60">(optional)</span>
                          </Label>
                          <Input
                            value={edu.field || ""}
                            onChange={e => updateEducation(idx, "field", e.target.value)}
                            placeholder="e.g. Computer Science"
                            className="h-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Graduation Year</Label>
                        <Select value={edu.year} onValueChange={v => updateEducation(idx, "year", v)}>
                          <SelectTrigger className="h-10 max-w-[160px]">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {GRAD_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addEducation}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-md border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    {profile.education.length === 0 ? "Add your first degree" : "Add another degree"}
                  </button>
                </div>
              </div>
            )}

            {/* ── PREFERENCES ───────────────────────────────────────── */}
            {currentStep === "preferences" && (
              <div className="animate-fade-in">
                <div className="mb-5">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Preferences</p>
                  <h2 className="text-xl font-bold">What are you looking for?</h2>
                </div>
                <div className="space-y-6">

                  {/* Target Roles */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Target Roles</Label>
                    <div className="flex flex-wrap gap-2 min-h-[36px]">
                      {roles.map((role, i) => (
                        <Badge key={i} variant="secondary" className="pl-3 pr-1.5 py-1.5 gap-1 text-sm bg-primary/10 text-primary border-primary/20">
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
                            if (currentRole.trim() && !roles.includes(currentRole.trim())) setRoles([...roles, currentRole.trim()]);
                            setCurrentRole("");
                          }
                        }}
                        placeholder="e.g. Senior Frontend Engineer"
                      />
                      <Button type="button" variant="secondary" size="icon" className="shrink-0"
                        onClick={() => { if (currentRole.trim() && !roles.includes(currentRole.trim())) setRoles([...roles, currentRole.trim()]); setCurrentRole(""); }}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Salary */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <Label className="text-sm font-semibold">Minimum Base Salary</Label>
                      <span className="text-base font-mono font-semibold">${salary[0].toLocaleString()}</span>
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
                          className={`h-10 rounded-md text-sm font-medium border-2 transition-all ${
                            remotePolicy === mode
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background border-border hover:border-primary/40 text-muted-foreground"
                          }`}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* What matters most */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-semibold">What matters most to you?</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Select all that apply</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {JOB_VALUES.map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => toggleJobValue(val)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                            jobValues.includes(val)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/30"
                          }`}
                        >
                          {jobValues.includes(val) && <span className="mr-1">✓</span>}
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Intensity */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <Label className="text-sm font-semibold">Search Intensity</Label>
                      <span className="text-xs font-medium text-primary tabular-nums">Level {aggressiveness[0]}</span>
                    </div>
                    <Slider value={aggressiveness} onValueChange={setAggressiveness} min={1} max={10} step={1} />
                    <p className="text-xs text-muted-foreground">{AGGRESSIVENESS_LABELS[aggressiveness[0]]}</p>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* ── Card footer navigation ─────────────────────────────────── */}
          {currentStep !== "method" && (
            <div className="sticky bottom-0 z-20 px-6 sm:px-8 py-4 flex items-center justify-between border-t border-border bg-background/80 backdrop-blur-sm -mx-6 sm:-mx-8 safe-area-inset-bottom">
              <Button
                variant="ghost"
                onClick={goBack}
                className="gap-1.5 text-muted-foreground hover:text-foreground h-11"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              {currentStep === "preferences" ? (
                <Button onClick={handleFinish} disabled={saving} className="gap-2 px-6 h-11">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving…" : "Complete setup"}
                </Button>
              ) : (
                <Button onClick={handleNext} className="gap-2 px-6 h-11">
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              )}
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

  const name = profile.identity.name;
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");

  return (
    <div className="space-y-5">
      {/* Avatar / name preview */}
      {name && (
        <div className="flex items-center gap-3 p-4 rounded-md bg-muted/40 border border-border">
          <div className="h-11 w-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{initials || "?"}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{profile.identity.email || "Add your email below"}</p>
          </div>
        </div>
      )}

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
        <div className="space-y-2">
          <Label>Current Location <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
          <SingleLocationPicker
            value={profile.identity.location || ""}
            onChange={loc => setProfile(p => ({ ...p, identity: { ...p.identity, location: loc } }))}
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
    <div className="space-y-5">
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-2 p-4 rounded-md bg-muted/30 border border-border min-h-[60px]">
          {skills.map((s, i) => (
            <Badge key={i} variant="secondary" className="pl-3 pr-1.5 py-1.5 gap-1 text-sm bg-primary/10 text-primary border-primary/20 animate-scale-in">
              {s.name}
              <button onClick={() => onRemove(i)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 rounded-md border-2 border-dashed border-border text-center">
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
                className="px-3 py-1.5 text-sm rounded-md border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
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
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-modal max-h-52 overflow-y-auto">
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
