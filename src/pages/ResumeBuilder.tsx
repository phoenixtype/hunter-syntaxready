import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useResume } from "@/hooks/useResume";
import { saveCandidateProfile, CandidateProfile, ExperienceAtom, Education, Skill } from "@/lib/resume_engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, X, Plus, User, Briefcase,
  Sparkles, GraduationCap, FileText, Download, Loader2, Check, Layout
} from "lucide-react";
import DashboardSkeleton from "@/components/DashboardSkeleton";

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
    id: "classic",
    name: "Classic Professional",
    desc: "Clean, traditional layout. Ideal for corporate roles.",
    preview: "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900",
  },
  {
    id: "modern",
    name: "Modern Minimal",
    desc: "Sleek, contemporary design. Great for tech & creative roles.",
    preview: "bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-950",
  },
  {
    id: "executive",
    name: "Executive",
    desc: "Bold, authoritative layout for senior/leadership positions.",
    preview: "bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-950",
  },
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

  const [currentStep, setCurrentStep] = useState<StepId>("personal");
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
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
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading]);

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

  const updateExperience = (idx: number, field: keyof ExperienceAtom, value: any) =>
    setFormData(p => {
      const atoms = [...p.experience_atoms];
      atoms[idx] = { ...atoms[idx], [field]: value };
      return { ...p, experience_atoms: atoms };
    });

  const removeExperience = (idx: number) =>
    setFormData(p => ({ ...p, experience_atoms: p.experience_atoms.filter((_, i) => i !== idx) }));

  const addEducation = () =>
    setFormData(p => ({ ...p, education: [...p.education, { school: "", degree: "", year: "" }] }));

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
    setGenerating(true);
    try {
      // Save the profile data first
      await saveCandidateProfile(user.id, formData);
      setGlobalProfile(formData);

      // Call edge function to generate resume document
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("generate-resume", {
        body: {
          profile: formData,
          template: selectedTemplate,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (error) throw error;

      if (data?.content) {
        const blob = new Blob([data.content], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        setGeneratedUrl(url);
        toast.success("Resume generated successfully!");
      } else {
        throw new Error("No content returned");
      }
    } catch (err) {
      console.error("Generate failed:", err);
      // Still save the profile
      toast.success("Profile saved!");
      toast.error("Resume generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "personal":
        return formData.identity.name.trim().length > 0 && formData.identity.email.trim().length > 0;
      case "experience":
        return true; // Optional
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Progress Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <Progress value={progressPercent} className="h-1 rounded-none bg-muted [&>div]:bg-primary" />
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => stepIndex > 0 ? goBack() : navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-muted-foreground">
              {STEPS[stepIndex].label} · Step {stepIndex + 1} of {STEPS.length}
            </span>
          </div>
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
        </div>
      </div>

      <div className="pt-20 pb-32 px-4">
        <div className="max-w-3xl mx-auto">

          {/* PERSONAL INFO */}
          {currentStep === "personal" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Personal Information</h2>
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
                <h2 className="text-2xl font-bold">Work Experience</h2>
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
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
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
                <h2 className="text-2xl font-bold">Education</h2>
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
                              <Input value={edu.degree} onChange={e => updateEducation(idx, "degree", e.target.value)} placeholder="B.S. Computer Science" />
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
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
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
                <h2 className="text-2xl font-bold">Skills & Expertise</h2>
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
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Choose a Template</h2>
                <p className="text-muted-foreground">Select an ATS-friendly template for your resume.</p>
              </div>
              <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate} className="grid gap-4">
                {TEMPLATES.map(t => (
                  <label
                    key={t.id}
                    className={`flex items-start gap-4 p-5 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedTemplate === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <RadioGroupItem value={t.id} className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{t.name}</h3>
                        {selectedTemplate === t.id && (
                          <Badge className="bg-primary text-primary-foreground text-xs">
                            <Check className="w-3 h-3 mr-1" /> Selected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{t.desc}</p>
                      {/* Template preview swatch */}
                      <div className={`h-20 rounded-lg ${t.preview} border border-border/50 flex items-center justify-center`}>
                        <div className="space-y-1.5 w-3/4">
                          <div className="h-2 bg-foreground/20 rounded w-1/2" />
                          <div className="h-1.5 bg-foreground/10 rounded w-full" />
                          <div className="h-1.5 bg-foreground/10 rounded w-3/4" />
                          <div className="h-1.5 bg-foreground/10 rounded w-5/6" />
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* GENERATE */}
          {currentStep === "generate" && (
            <div className="animate-fade-in space-y-8 pt-8">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold">Generate Your Resume</h2>
                <p className="text-muted-foreground">Review your details and generate a polished, ATS-friendly resume.</p>
              </div>

              {/* Summary preview */}
              <Card className="border-border bg-card">
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name</span>
                      <p className="font-medium">{formData.identity.name || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email</span>
                      <p className="font-medium">{formData.identity.email || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Experience</span>
                      <p className="font-medium">{formData.experience_atoms.length} position(s)</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Education</span>
                      <p className="font-medium">{formData.education.length} entry(ies)</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Skills</span>
                      <p className="font-medium">{formData.skills.length} skill(s)</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Template</span>
                      <p className="font-medium capitalize">{TEMPLATES.find(t => t.id === selectedTemplate)?.name}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col items-center gap-4">
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full max-w-md h-14 text-base shadow-glow hover:shadow-glow-lg transition-all"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 mr-2" />
                      Generate Resume
                    </>
                  )}
                </Button>

                {generatedUrl && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.open(generatedUrl, "_blank")}
                    className="w-full max-w-md h-14 text-base"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Resume
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      {currentStep !== "generate" && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => stepIndex > 0 ? goBack() : navigate("/dashboard")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {stepIndex > 0 ? "Back" : "Dashboard"}
            </Button>
            <Button
              onClick={goNext}
              disabled={!canProceed()}
              className="gap-2 shadow-glow hover:shadow-glow-lg transition-all"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeBuilder;
