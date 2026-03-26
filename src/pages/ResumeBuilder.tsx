import { useState, useEffect, useRef } from "react";
import PageTour, { PageTourHandle } from "@/components/PageTour";
import { HelpCircle } from "lucide-react";
import type { Step } from "react-joyride";

const RESUME_TOUR_STEPS: Step[] = [
  { target: "body", title: "Resume Builder", content: "Build your profile step-by-step. Hunter uses it to match jobs and tailor your resume automatically.", placement: "center", disableBeacon: true },
  { target: '[data-tour="resume-upload"]', title: "Upload your resume", content: "Upload an existing resume and Hunter will parse it to pre-fill your profile.", disableBeacon: true },
  { target: '[data-tour="resume-sections"]', title: "Edit your profile", content: "Step through each section — identity, experience, education, and skills — to complete your profile." },
  { target: '[data-tour="resume-export"]', title: "Export your resume", content: "Download an ATS-clean PDF or DOCX at any time. Hunter keeps it up to date as you edit." },
];
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useResume } from "@/hooks/useResume";
import SEOHead from "@/components/SEOHead";
import { saveCandidateProfile, CandidateProfile, ExperienceAtom, Education } from "@/lib/resume_engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, X, Plus, User, Briefcase,
  Sparkles, GraduationCap, FileText, Download, Loader2, Check, Layout,
  Eye, ShieldCheck, Copy, Share
} from "lucide-react";
import { exportResumeToDocx } from "@/lib/pdf_export";
import { analyzeResumeForJob, ATSResult } from "@/lib/ats_engine";
import PageHeader from "@/components/PageHeader";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { useSubscription } from "@/hooks/useSubscription";
import ProGate from "@/components/ProGate";
import { classifyInvokeError } from "@/lib/invoke-error";

const STEPS = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "template", label: "Template", icon: Layout },
  { id: "generate", label: "Generate", icon: FileText },
] as const;

type StepId = typeof STEPS[number]["id"];

const TEMPLATES = [
  {
    id: "minimalist",
    name: "Professional Minimalist",
    desc: "Clean, ultra-modern sans-serif layout. Focuses entirely on content readability and elegant whitespace. Perfect for tech and modern corporate roles.",
    preview: "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950",
    tag: "Popular",
  },
  {
    id: "executive",
    name: "Executive Premium",
    desc: "Authoritative serif typography with strong dividing lines and a sophisticated structural grid. Ideal for senior, management, and traditional roles.",
    preview: "bg-gradient-to-br from-stone-50 to-neutral-100 dark:from-stone-900 dark:to-neutral-950",
    tag: "Premium",
  },
  {
    id: "tech",
    name: "Modern Tech",
    desc: "Sleek, high-density layout optimized for engineers and developers. Highlights skills, projects, and metrics with technical precision.",
    preview: "bg-gradient-to-br from-zinc-50 to-blue-50 dark:from-zinc-900 dark:to-blue-950",
    tag: "New",
  },
  {
    id: "corporate",
    name: "Classic Corporate",
    desc: "Timeless and traditional format recognized by all major institutions. Strict, highly structured, and universally ATS compliant.",
    preview: "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950",
    tag: null,
  },
];

const ACCENT_COLORS = [
  { id: "slate", name: "Slate", hex: "#475569", bg: "bg-slate-500", ring: "ring-slate-500" },
  { id: "blue", name: "Blue", hex: "#2563eb", bg: "bg-blue-600", ring: "ring-blue-600" },
  { id: "teal", name: "Teal", hex: "#0d9488", bg: "bg-teal-600", ring: "ring-teal-600" },
  { id: "emerald", name: "Emerald", hex: "#059669", bg: "bg-emerald-600", ring: "ring-emerald-600" },
  { id: "crimson", name: "Crimson", hex: "#dc2626", bg: "bg-red-600", ring: "ring-red-600" },
  { id: "indigo", name: "Indigo", hex: "#4f46e5", bg: "bg-indigo-600", ring: "ring-indigo-600" },
];

const SUGGESTED_SKILLS = [
  "JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL",
  "AWS", "Docker", "Git", "Agile", "Project Management", "Communication",
  "Leadership", "Data Analysis", "Machine Learning", "Figma",
];

const ResumeBuilder = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile: existingProfile, loading: profileLoading, setProfile: setGlobalProfile } = useResume();
  const { isPro, isLoading: subLoading, canAccess, recordUsage } = useSubscription();
  const tourRef = useRef<PageTourHandle>(null);

  const [currentStep, setCurrentStep] = useState<StepId>("personal");
  const [selectedTemplate, setSelectedTemplate] = useState("minimalist");
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0]);
  const [fitToOnePage, setFitToOnePage] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [showProGate, setShowProGate] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [atsResult, setAtsResult] = useState<ATSResult | null>(null);
  const [skillInput, setSkillInput] = useState("");

  const [formData, setFormData] = useState<CandidateProfile>({
    identity: { name: "", email: "", phone: "", links: [] },
    skills: [],
    experience_atoms: [],
    education: [],
    summary: "",
  });

  // Pre-fill from existing profile
  useEffect(() => {
    if (existingProfile) {
      setFormData(JSON.parse(JSON.stringify(existingProfile)));
    }
  }, [existingProfile]);

  // Pre-fill email from auth
  useEffect(() => {
    if (user?.email && !formData.identity.email) {
      setFormData(prev => ({
        ...prev,
        identity: { ...prev.identity, email: user.email! },
      }));
    }
  }, [user, formData.identity.email]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progressPercent = ((stepIndex) / (STEPS.length - 1)) * 100;

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    // Gate: free users cannot proceed past the Template step
    if (currentStep === "template" && !isPro) {
      setShowProGate(true);
      return;
    }
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };

  const goBack = () => {
    const idx = STEPS.findIndex(s => s.id === currentStep);
    if (idx > 0) setCurrentStep(STEPS[idx - 1].id);
  };

  const updateIdentity = (field: string, value: string) =>
    setFormData(p => ({ ...p, identity: { ...p.identity, [field]: value } }));

  const addExperience = () =>
    setFormData(p => ({
      ...p,
      experience_atoms: [
        ...p.experience_atoms,
        { id: crypto.randomUUID(), company: "", role: "", duration: "", content: "", keywords: [] },
      ],
    }));

  const updateExperience = (idx: number, field: keyof ExperienceAtom, value: string | string[]) =>
    setFormData(p => {
      const atoms = [...p.experience_atoms];
      atoms[idx] = { ...atoms[idx], [field]: value };
      return { ...p, experience_atoms: atoms };
    });

  const removeExperience = (idx: number) =>
    setFormData(p => ({ ...p, experience_atoms: p.experience_atoms.filter((_, i) => i !== idx) }));

  const addEducation = () =>
    setFormData(p => ({ ...p, education: [...p.education, { school: "", degree: "", field: "", year: "" }] }));

  const updateEducation = (idx: number, field: keyof Education, value: string) =>
    setFormData(p => {
      const edu = [...p.education];
      edu[idx] = { ...edu[idx], [field]: value };
      return { ...p, education: edu };
    });

  const removeEducation = (idx: number) =>
    setFormData(p => ({ ...p, education: p.education.filter((_, i) => i !== idx) }));

  const addSkill = (name: string) => {
    if (!name.trim()) return;
    if (formData.skills.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) return;
    setFormData(p => ({ ...p, skills: [...p.skills, { name: name.trim(), proficiency: 3, evidence: [] }] }));
    setSkillInput("");
  };

  const removeSkill = (idx: number) =>
    setFormData(p => ({ ...p, skills: p.skills.filter((_, i) => i !== idx) }));

  const handleGenerate = async () => {
    if (!user) return;

    // Check usage limits before generating (safety net — goNext already gates this)
    if (!canAccess('resume_generations')) {
      setShowProGate(true);
      return;
    }

    // Validate all experience atoms have required content
    const incompleteExp = formData.experience_atoms.find(
      exp => !exp.role.trim() || !exp.company.trim() || !exp.content.trim()
    );
    if (incompleteExp) {
      toast.error("Incomplete experience entry", {
        description: `"${incompleteExp.role || incompleteExp.company || 'An experience'}" is missing required details. Go back and fill in the job title, company, and description for all entries.`,
      });
      return;
    }

    setGenerating(true);
    try {
      // Save the profile data first
      await saveCandidateProfile(user.id, formData);
      setGlobalProfile(formData);

      // Run ATS audit + edge function generation in parallel
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();

      const [atsRes, genRes] = await Promise.allSettled([
        analyzeResumeForJob(formData, ""),
        supabase.functions.invoke("generate-resume", {
          body: { profile: formData, template: selectedTemplate, accentColor: accentColor.hex, onePage: fitToOnePage },
          headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        }),
      ]);

      if (atsRes.status === "fulfilled") setAtsResult(atsRes.value);

      if (genRes.status === "fulfilled" && genRes.value.data?.content) {
        setGeneratedHtml(genRes.value.data.content);
        setGenerated(true);
        toast.success("Resume ready — preview and download below!");

        // Record usage for successful generation
        await recordUsage({ featureName: 'resume_generations' });
      } else {
        throw genRes.status === "fulfilled" && genRes.value.error ? genRes.value.error : new Error("Resume generation failed");
      }
    } catch (err) {
      const type = await classifyInvokeError(err);
      if (type === "pro_gate") {
        setShowProGate(true);
      } else {
        toast.error("Resume generation failed", { description: "Your profile was saved. Please try generating again." });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!generatedHtml) return;
    // Inject html via srcdoc so onload fires after content is fully parsed.
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-modals");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:8.5in;height:11in;border:none;";
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 4000);
      }, 500);
    };
    iframe.srcdoc = generatedHtml;
    document.body.appendChild(iframe);
  };

  const canProceed = () => {
    switch (currentStep) {
      case "personal":
        return formData.identity.name.trim().length > 0 && formData.identity.email.trim().length > 0;
      case "experience":
        return formData.experience_atoms.every(exp => exp.role.trim() && exp.company.trim() && exp.content.trim());
      case "education":
        return true; // Optional
      case "skills":
        return formData.skills.length > 0;
      case "template":
        return !!selectedTemplate;
      default:
        return true;
    }
  };

  if (authLoading || profileLoading) return <DashboardSkeleton />;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`Check out Hunter AI — the autonomous job search agent! ${window.location.origin}`);
      toast.success("Link copied!", { description: "Share Hunter with your network." });
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <>
    <div className="min-h-screen bg-background text-foreground">
      <ProGate.Dialog open={showProGate} onOpenChange={setShowProGate} featureLabel="Resume Builder" />
      <SEOHead title="Resume Builder" description="Build and optimize your professional resume with AI assistance." path="/resume-builder" noIndex />
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Resume Builder" },
        ]}
        icon={<FileText className="w-4 h-4 text-primary" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {STEPS[stepIndex].label} · Step {stepIndex + 1}/{STEPS.length}
            </span>
            <div className="hidden sm:flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => i <= stepIndex && setCurrentStep(s.id)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === stepIndex ? "bg-primary scale-125" : i < stepIndex ? "bg-primary/50 cursor-pointer" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <button onClick={() => tourRef.current?.start()} title="Take a tour" className="text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        }
      />
      <Progress value={progressPercent} className="h-1 rounded-none bg-muted [&>div]:bg-primary" />

      <div className="pt-16 sm:pt-20 pb-36 sm:pb-32 px-4">
        <div className="max-w-3xl mx-auto">

          {/* PERSONAL INFO */}
          {currentStep === "personal" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Personal Information</h2>
                <p className="text-muted-foreground">Your contact details and professional links.</p>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.identity.name}
                      onChange={e => updateIdentity("name", e.target.value)}
                      placeholder="Jane Smith"
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email <span className="text-destructive">*</span></Label>
                    <Input
                      value={formData.identity.email}
                      onChange={e => updateIdentity("email", e.target.value)}
                      placeholder="jane@example.com"
                      type="email"
                      className="h-12"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      value={formData.identity.phone || ""}
                      onChange={e => updateIdentity("phone", e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn / Portfolio <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input
                      value={formData.identity.links?.[0] || ""}
                      onChange={e => setFormData(p => ({ ...p, identity: { ...p.identity, links: e.target.value ? [e.target.value] : [] } }))}
                      placeholder="https://linkedin.com/in/janesmith"
                      className="h-12"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Professional Summary <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    value={formData.summary || ""}
                    onChange={e => setFormData(p => ({ ...p, summary: e.target.value }))}
                    placeholder="Experienced software engineer with 5+ years building scalable web applications..."
                    className="min-h-[120px] resize-y"
                  />
                </div>
              </div>
            </div>
          )}

          {/* EXPERIENCE */}
          {currentStep === "experience" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Work Experience</h2>
                <p className="text-muted-foreground">Add your most relevant positions. Use bullet points for impact.</p>
              </div>
              <div className="space-y-4">
                {formData.experience_atoms.map((exp, idx) => (
                  <Card key={exp.id || idx} className="border-border bg-card animate-fade-in">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Job Title</Label>
                            <Input value={exp.role} onChange={e => updateExperience(idx, "role", e.target.value)} placeholder="Software Engineer" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Company</Label>
                            <Input value={exp.company} onChange={e => updateExperience(idx, "company", e.target.value)} placeholder="Acme Inc." />
                          </div>
                        </div>
                        <button onClick={() => removeExperience(idx)} className="p-1.5 text-muted-foreground hover:text-destructive mt-5">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Duration</Label>
                        <Input value={exp.duration} onChange={e => updateExperience(idx, "duration", e.target.value)} placeholder="Jan 2022 — Present" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Key Responsibilities & Achievements</Label>
                        <Textarea
                          value={exp.content}
                          onChange={e => updateExperience(idx, "content", e.target.value)}
                          placeholder="• Led a team of 5 engineers to deliver..."
                          className="min-h-[120px] resize-y"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <button
                  onClick={addExperience}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-md border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-5 h-5" /> Add Position
                </button>
              </div>
            </div>
          )}

          {/* EDUCATION */}
          {currentStep === "education" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Education</h2>
                <p className="text-muted-foreground">Degrees, certifications, and relevant training.</p>
              </div>
              <div className="space-y-4">
                {formData.education.map((edu, idx) => (
                  <Card key={idx} className="border-border bg-card animate-fade-in">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">School / Institution</Label>
                            <Input value={edu.school} onChange={e => updateEducation(idx, "school", e.target.value)} placeholder="MIT" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Degree</Label>
                              <Input value={edu.degree} onChange={e => updateEducation(idx, "degree", e.target.value)} placeholder="B.S." />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Field of Study</Label>
                              <Input value={edu.field || ""} onChange={e => updateEducation(idx, "field", e.target.value)} placeholder="Computer Science" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Year</Label>
                              <Input value={edu.year} onChange={e => updateEducation(idx, "year", e.target.value)} placeholder="2020" />
                            </div>
                          </div>
                        </div>
                        <button onClick={() => removeEducation(idx)} className="p-1.5 text-muted-foreground hover:text-destructive mt-5">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <button
                  onClick={addEducation}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-md border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-5 h-5" /> Add Education
                </button>
              </div>
            </div>
          )}

          {/* SKILLS */}
          {currentStep === "skills" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Skills & Expertise</h2>
                <p className="text-muted-foreground">Add your technical and professional skills.</p>
              </div>

              {/* Current skills */}
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((s, i) => (
                    <Badge key={i} variant="secondary" className="pl-3 pr-1.5 py-1.5 gap-1 text-sm bg-primary/10 text-primary border-primary/20">
                      {s.name}
                      <button onClick={() => removeSkill(i)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Add skill input */}
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); addSkill(skillInput); }
                  }}
                  placeholder="Type a skill and press Enter"
                  className="h-12"
                />
                <Button onClick={() => addSkill(skillInput)} variant="outline" className="h-12 px-6">
                  Add
                </Button>
              </div>

              {/* Suggested skills */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-medium">Suggested Skills</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_SKILLS.filter(s => !formData.skills.some(sk => sk.name.toLowerCase() === s.toLowerCase())).map(s => (
                    <button
                      key={s}
                      onClick={() => addSkill(s)}
                      className="px-3 py-1.5 rounded-full text-sm border border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TEMPLATE SELECTION */}
          {currentStep === "template" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Choose a Template</h2>
                  <p className="text-muted-foreground">Select an ATS-friendly layout that fits your industry and career level.</p>
                </div>
                <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {TEMPLATES.map(t => (
                    <label
                      key={t.id}
                      className={`flex flex-col gap-3 p-4 rounded-md border-2 cursor-pointer transition-all ${
                        selectedTemplate === t.id
                          ? `border-primary bg-primary/5 shadow-md`
                          : "border-border hover:border-primary/30 hover:shadow-sm"
                      }`}
                      style={{ borderLeftColor: selectedTemplate === t.id ? accentColor.hex : undefined, borderLeftWidth: "4px" }}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={t.id} className="mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm">{t.name}</h3>
                            {t.tag && (
                              <Badge variant={t.tag === "Default" || t.tag === "Popular" ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                                {t.tag}
                              </Badge>
                            )}
                            {selectedTemplate === t.id && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] h-5 px-1.5 ml-auto">
                                <Check className="w-3 h-3 mr-0.5" /> Selected
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.desc}</p>
                        </div>
                      </div>
                      {/* Mini preview */}
                      <div className={`h-20 sm:h-24 rounded-md ${t.preview} border border-border p-3 flex flex-col justify-between`}>
                        <div className="space-y-1">
                          <div className="h-2.5 bg-foreground/25 rounded w-2/5" />
                          <div className="h-1.5 bg-foreground/10 rounded w-3/5" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-1.5 bg-foreground/8 rounded w-full" />
                          <div className="h-1.5 bg-foreground/8 rounded w-4/5" />
                          <div className="h-1.5 bg-foreground/8 rounded w-11/12" />
                        </div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-4 pt-6 border-t border-border">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Color Accent</h2>
                  <p className="text-sm text-muted-foreground">Choose a subtle color to highlight headers and key elements.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {ACCENT_COLORS.map(color => (
                    <button
                      key={color.id}
                      onClick={() => setAccentColor(color)}
                      className={`w-10 h-10 rounded-full transition-all flex items-center justify-center ${color.bg} ${
                        accentColor.id === color.id 
                          ? `ring-2 ring-offset-2 ring-offset-background ${color.ring} scale-110 shadow-md` 
                          : 'opacity-70 hover:opacity-100 border border-border'
                      }`}
                      title={color.name}
                    >
                      {accentColor.id === color.id && <Check className="w-5 h-5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* GENERATE */}
          {currentStep === "generate" && (
            <div className="animate-fade-in space-y-6 pt-8">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight">Generate Your Resume</h2>
                <p className="text-muted-foreground">AI will craft a polished, ATS-optimised resume from your profile.</p>
              </div>

              {/* Profile summary */}
              {!generated && (
                <Card className="border-border bg-card">
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                      <div><span className="text-muted-foreground">Name</span><p className="font-medium">{formData.identity.name || "—"}</p></div>
                      <div><span className="text-muted-foreground">Email</span><p className="font-medium">{formData.identity.email || "—"}</p></div>
                      <div><span className="text-muted-foreground">Experience</span><p className="font-medium">{formData.experience_atoms.length} position(s)</p></div>
                      <div><span className="text-muted-foreground">Skills</span><p className="font-medium">{formData.skills.length} skill(s)</p></div>
                      <div><span className="text-muted-foreground">Education</span><p className="font-medium">{formData.education.length} entry(ies)</p></div>
                      <div><span className="text-muted-foreground">Template</span><p className="font-medium">{TEMPLATES.find(t => t.id === selectedTemplate)?.name}</p></div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div>
                        <p className="text-sm font-medium">Fit to one page</p>
                        <p className="text-xs text-muted-foreground">AI will compress content to a single printed page</p>
                      </div>
                      <Switch checked={fitToOnePage} onCheckedChange={setFitToOnePage} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ATS Score */}
              {atsResult && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">ATS Compatibility Score</span>
                      </div>
                      <span className={`text-2xl font-bold ${atsResult.score >= 70 ? "text-primary" : atsResult.score >= 50 ? "text-warning" : "text-destructive"}`}>
                        {atsResult.score}/100
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${atsResult.score >= 70 ? "bg-primary" : atsResult.score >= 50 ? "bg-warning" : "bg-destructive"}`}
                        style={{ width: `${atsResult.score}%` }}
                      />
                    </div>
                    {atsResult.formatting_issues.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {atsResult.formatting_issues.map((issue, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    )}
                    {atsResult.score >= 70 && (
                      <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                        <Check className="w-3 h-3" /> Strong ATS visibility — your resume will parse correctly.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Live HTML Preview */}
              {generatedHtml && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Resume preview — scroll to review</span>
                  </div>
                  <div className="border border-border rounded-md overflow-hidden shadow-card">
                    <iframe
                      srcDoc={generatedHtml}
                      title="Resume Preview"
                      className="w-full h-80 md:h-[600px] bg-white"
                      sandbox=""
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col items-center gap-3">
                {!generated ? (
                  <Button
                    size="lg"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full max-w-md h-14 text-base"
                  >
                    {generating ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating…</>
                    ) : (
                      <><Sparkles className="w-5 h-5 mr-2" />Generate Resume</>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      onClick={handleDownloadPdf}
                      className="w-full max-w-md h-14 text-base gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Download as PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={async () => { await exportResumeToDocx(formData); toast.success("Word document downloaded"); }}
                      className="w-full max-w-md h-14 text-base gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Download as DOCX
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setGenerated(false); setGeneratedHtml(null); setAtsResult(null); }}
                      className="text-muted-foreground text-sm"
                    >
                      Regenerate
                    </Button>

                    <div className="pt-8 mt-8 border-t border-border flex flex-col items-center text-center w-full">
                      <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-500/10 mb-4">
                        <Share className="w-6 h-6 text-amber-500" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">Help a friend get hired!</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mb-6">
                        Share Hunter AI with your network. When you copy the link, we'll automatically add <span className="font-semibold text-foreground">5 free Auto-Applies</span> to your account!
                      </p>
                      <Button 
                        onClick={handleShare}
                        className="w-full max-w-md h-12 bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2 shadow-lg shadow-amber-500/20"
                      >
                        <Copy className="w-4 h-4" />
                        Share & Earn Auto-Applies
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      {currentStep !== "generate" && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
          {/* Mobile step indicator */}
          <div className="sm:hidden flex items-center justify-center gap-1.5 pt-3 pb-1">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? "bg-primary w-6" : i < stepIndex ? "bg-primary/50 w-1.5" : "bg-muted w-1.5"
                }`}
              />
            ))}
          </div>
          <div className="max-w-3xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => stepIndex > 0 ? goBack() : navigate("/dashboard")}
              className="gap-2 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{stepIndex > 0 ? "Back" : "Dashboard"}</span>
            </Button>
            <div className="flex flex-col items-end gap-1 min-w-0">
              {!canProceed() && (
                <p className="text-xs text-muted-foreground text-right hidden sm:block">
                  {currentStep === "personal"
                    ? "Name and email are required"
                    : currentStep === "skills"
                    ? "Add at least one skill to continue"
                    : null}
                </p>
              )}
              <Button
                onClick={goNext}
                disabled={!canProceed()}
                className="gap-2 transition-all"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    <PageTour ref={tourRef} tourKey="resume_builder" steps={RESUME_TOUR_STEPS} />
    </>
  );
};

export default ResumeBuilder;
