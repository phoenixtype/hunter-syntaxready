import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Loader2, Eye, Save, Trash2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import ProGate from "@/components/ProGate";
import {
  getRecruiterJobById,
  updateJob,
  deleteJob,
  LOCATION_TYPE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  type RecruiterJob,
  type RecruiterJobInsert,
} from "@/lib/recruiter_engine";
import { classifyInvokeError, getInvokeErrorMessage } from "@/lib/invoke-error";
import { RecruiterPaywall } from "@/components/recruiter/RecruiterPaywall";

const EXPERIENCE_LEVELS = [
  { value: "entry",      label: "Entry Level" },
  { value: "junior",     label: "Junior" },
  { value: "mid",        label: "Mid-Level" },
  { value: "senior",     label: "Senior" },
  { value: "lead",       label: "Lead" },
  { value: "principal",  label: "Principal" },
  { value: "executive",  label: "Executive" },
] as const;

const EditJob = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<RecruiterJob | null>(null);
  const [form, setForm] = useState<Partial<RecruiterJobInsert>>({});
  const [techInput, setTechInput] = useState("");
  const [loadingJob, setLoadingJob] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showProGate, setShowProGate] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    getRecruiterJobById(jobId).then((j) => {
      if (!j) { toast.error("Job not found"); navigate("/recruiter/jobs"); return; }
      setJob(j);
      setForm({
        title: j.title,
        company: j.company,
        location: j.location,
        location_type: j.location_type,
        employment_type: j.employment_type,
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        salary_currency: j.salary_currency,
        description: j.description,
        requirements: j.requirements,
        responsibilities: j.responsibilities,
        benefits: j.benefits,
        tech_stack: j.tech_stack ?? [],
        experience_level: j.experience_level,
        visa_sponsorship: j.visa_sponsorship,
        application_deadline: j.application_deadline,
        max_applicants: j.max_applicants ?? undefined,
      });
      setLoadingJob(false);
    });
  }, [jobId, navigate]);

  const set = <K extends keyof RecruiterJobInsert>(key: K, val: RecruiterJobInsert[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const addTech = () => {
    const tag = techInput.trim();
    if (!tag) return;
    if (!(form.tech_stack ?? []).includes(tag)) set("tech_stack", [...(form.tech_stack ?? []), tag]);
    setTechInput("");
  };

  const removeTech = (tag: string) =>
    set("tech_stack", (form.tech_stack ?? []).filter((t) => t !== tag));

  const validate = (isPublish?: boolean): string | null => {
    if (!form.title?.trim()) return "Job title is required";
    if (!form.company?.trim()) return "Company name is required";
    if (isPublish) {
      if (!form.description?.trim() || form.description.trim().length < 50)
        return "Description must be at least 50 characters to publish";
    }
    return null;
  };

  const handleSave = async (publish?: boolean) => {
    if (!jobId) return;

    const validationError = validate(publish);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const setter = publish ? setPublishing : setSaving;
    setter(true);
    try {
      const updates: Partial<RecruiterJobInsert> = { ...form };
      if (publish !== undefined) updates.status = publish ? "active" : "draft";
      await updateJob(jobId, updates);
      toast.success(publish ? "Job published!" : "Changes saved.");
      navigate(`/recruiter/jobs/${jobId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setter(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!form.title?.trim()) {
      toast.error("Add a job title first so the AI knows what to write");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          type: "job_description",
          profile: {},
          job: {
            title: form.title,
            company: form.company || job?.company || "",
            location_type: form.location_type,
            employment_type: form.employment_type,
            experience_level: form.experience_level,
            location: form.location,
            tech_stack: form.tech_stack ?? [],
            salary_min: form.salary_min,
            salary_max: form.salary_max,
            salary_currency: form.salary_currency,
            description: form.description || "",
          },
        },
      });
      if (error || !data?.content) throw error || new Error("No content returned");
      let parsed: { description?: string; responsibilities?: string; requirements?: string; benefits?: string };
      try {
        const raw = data.content.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/g, "").trim();
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("AI returned malformed content — please try again");
      }
      setForm((prev) => ({
        ...prev,
        description: parsed.description ?? prev.description,
        responsibilities: parsed.responsibilities ?? prev.responsibilities,
        requirements: parsed.requirements ?? prev.requirements,
        benefits: parsed.benefits ?? prev.benefits,
      }));
      toast.success("Job description regenerated! Review before saving.");
    } catch (e) {
      const type = await classifyInvokeError(e);
      if (type === "pro_gate") {
        setShowProGate(true);
      } else {
        const msg = await getInvokeErrorMessage(e) || (e instanceof Error ? e.message : "Generation failed — please try again");
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!jobId) return;
    setDeleting(true);
    try {
      await deleteJob(jobId);
      toast.success("Job deleted.");
      navigate("/recruiter/jobs");
    } catch {
      toast.error("Failed to delete job");
      setDeleting(false);
    }
  };

  if (loadingJob) {
    return (
      <RecruiterPaywall>
        <div className="flex flex-col min-h-screen">
          <div className="h-14 border-b border-border bg-card" />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </RecruiterPaywall>
    );
  }

  return (
    <RecruiterPaywall>
      <div className="flex flex-col min-h-screen">
        <ProGate.Dialog open={showProGate} onOpenChange={setShowProGate} featureLabel="AI Job Description" />
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-base font-semibold">Edit Job</h1>
              <p className="text-xs text-muted-foreground">{job?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full text-destructive/70 hover:bg-destructive/10 hover:text-destructive" title="Delete job">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete <strong>{job?.title}</strong> and remove it from the candidate feed. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="rounded-full bg-destructive hover:bg-destructive/90" onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button variant="outline" className="rounded-full gap-2" onClick={() => handleSave()} disabled={saving || publishing}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
            {job?.status !== "active" && (
              <Button className="rounded-full gap-2 shadow-md-1" onClick={() => handleSave(true)} disabled={saving || publishing}>
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Publish
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-8">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <h2 className="text-sm font-semibold">Basic Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Job Title</Label>
                  <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Work Type</Label>
                  <Select value={form.location_type} onValueChange={(v) => set("location_type", v as RecruiterJobInsert["location_type"])}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(LOCATION_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Employment Type</Label>
                  <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v as RecruiterJobInsert["employment_type"])}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Experience Level</Label>
                  <Select value={form.experience_level ?? "mid"} onValueChange={(v) => set("experience_level", v as RecruiterJobInsert["experience_level"])}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{EXPERIENCE_LEVELS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} className="rounded-xl" />
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <h2 className="text-sm font-semibold">Compensation</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Min Salary</Label>
                  <Input type="number" value={form.salary_min ?? ""} onChange={(e) => set("salary_min", e.target.value ? Number(e.target.value) : undefined)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Salary</Label>
                  <Input type="number" value={form.salary_max ?? ""} onChange={(e) => set("salary_max", e.target.value ? Number(e.target.value) : undefined)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={form.salary_currency ?? "USD"} onValueChange={(v) => set("salary_currency", v)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{["USD","CAD","GBP","EUR","AUD","NGN"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="visa" checked={form.visa_sponsorship ?? false} onCheckedChange={(c) => set("visa_sponsorship", c)} />
                <Label htmlFor="visa" className="cursor-pointer">Visa sponsorship available</Label>
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Job Details</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Or let AI regenerate the full description.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={handleGenerateWithAI}
                  disabled={generating}
                >
                  {generating
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                    : <><Sparkles className="w-3.5 h-3.5" /> Regenerate with AI</>}
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className="rounded-xl min-h-[140px]" />
              </div>
              <div className="space-y-1.5">
                <Label>Responsibilities</Label>
                <Textarea value={form.responsibilities ?? ""} onChange={(e) => set("responsibilities", e.target.value)} className="rounded-xl min-h-[100px]" />
              </div>
              <div className="space-y-1.5">
                <Label>Requirements</Label>
                <Textarea value={form.requirements ?? ""} onChange={(e) => set("requirements", e.target.value)} className="rounded-xl min-h-[100px]" />
              </div>
              <div className="space-y-1.5">
                <Label>Benefits</Label>
                <Textarea value={form.benefits ?? ""} onChange={(e) => set("benefits", e.target.value)} className="rounded-xl min-h-[80px]" />
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold">Tech Stack</h2>
              <div className="flex gap-2">
                <Input placeholder="Add skill…" value={techInput} onChange={(e) => setTechInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTech(); }}} className="rounded-xl flex-1" />
                <Button variant="outline" className="rounded-xl gap-1" onClick={addTech}><Plus className="w-4 h-4" /> Add</Button>
              </div>
              {(form.tech_stack ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(form.tech_stack ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-full gap-1 pr-1.5 text-xs">
                      {tag}
                      <button onClick={() => removeTech(tag)} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold">Application Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Application Deadline (optional)</Label>
                  <Input type="date" value={form.application_deadline?.split("T")[0] ?? ""} onChange={(e) => set("application_deadline", e.target.value || undefined)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Applicant Cap (optional)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 50"
                    value={form.max_applicants ?? ""}
                    onChange={(e) => set("max_applicants", e.target.value ? Number(e.target.value) : undefined)}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">Only the top-scoring candidates (up to this number) will be shortlisted. Leave blank for no cap.</p>
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-3 pb-4">
              <Button variant="outline" className="rounded-full" onClick={() => navigate(-1)}>Cancel</Button>
              <Button variant="outline" className="rounded-full gap-2" onClick={() => handleSave()} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save</Button>
              {job?.status !== "active" && (
                <Button className="rounded-full gap-2 shadow-md-1" onClick={() => handleSave(true)} disabled={publishing}>{publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}Publish</Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </RecruiterPaywall>
  );
};

export default EditJob;
