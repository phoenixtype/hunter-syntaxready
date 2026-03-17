import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, Loader2, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRecruiterProfile } from "@/hooks/useRecruiter";
import {
  createJob,
  RecruiterJobInsert,
  LOCATION_TYPE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
} from "@/lib/recruiter_engine";

const EXPERIENCE_LEVELS = [
  { value: "entry",      label: "Entry Level" },
  { value: "junior",     label: "Junior" },
  { value: "mid",        label: "Mid-Level" },
  { value: "senior",     label: "Senior" },
  { value: "lead",       label: "Lead" },
  { value: "principal",  label: "Principal" },
  { value: "executive",  label: "Executive" },
] as const;

const DEFAULT_FORM: RecruiterJobInsert = {
  title: "",
  company: "",
  location: "",
  location_type: "hybrid",
  employment_type: "full_time",
  salary_min: undefined,
  salary_max: undefined,
  salary_currency: "USD",
  description: "",
  requirements: "",
  responsibilities: "",
  benefits: "",
  tech_stack: [],
  experience_level: "mid",
  visa_sponsorship: false,
  status: "draft",
  application_deadline: undefined,
};

const PostJob = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useRecruiterProfile();

  const [form, setForm] = useState<RecruiterJobInsert>({
    ...DEFAULT_FORM,
    company: profile?.company_name ?? "",
  });
  const [techInput, setTechInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const set = <K extends keyof RecruiterJobInsert>(key: K, val: RecruiterJobInsert[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const addTech = () => {
    const tag = techInput.trim();
    if (!tag) return;
    if (!(form.tech_stack ?? []).includes(tag)) {
      set("tech_stack", [...(form.tech_stack ?? []), tag]);
    }
    setTechInput("");
  };

  const removeTech = (tag: string) =>
    set("tech_stack", (form.tech_stack ?? []).filter((t) => t !== tag));

  const validate = (): string | null => {
    if (!form.title.trim()) return "Job title is required";
    if (!form.company.trim()) return "Company name is required";
    if (!form.description.trim() || form.description.trim().length < 50)
      return "Description must be at least 50 characters";
    if (form.salary_min && form.salary_max && form.salary_min > form.salary_max)
      return "Salary min cannot exceed salary max";
    return null;
  };

  const handleSave = async (publishNow: boolean) => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!user) { toast.error("Not authenticated"); return; }

    const setter = publishNow ? setPublishing : setSaving;
    setter(true);
    try {
      const job = await createJob(user.id, { ...form, status: publishNow ? "active" : "draft" });
      toast.success(publishNow ? "Job published! Candidates can now discover and apply." : "Draft saved.");
      navigate(publishNow ? `/recruiter/jobs/${job.id}` : "/recruiter/jobs");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save job");
    } finally {
      setter(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold">Post a Job</h1>
            <p className="text-xs text-muted-foreground">Fill in the details to attract the right candidates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-full gap-2"
            onClick={() => handleSave(false)}
            disabled={saving || publishing}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </Button>
          <Button
            className="rounded-full gap-2 shadow-md-1"
            onClick={() => handleSave(true)}
            disabled={saving || publishing}
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            Publish Now
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Basic Info */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Basic Information</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Job Title <span className="text-destructive">*</span></Label>
                <Input id="title" placeholder="e.g. Senior Software Engineer" value={form.title} onChange={(e) => set("title", e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company <span className="text-destructive">*</span></Label>
                <Input id="company" placeholder="e.g. Acme Corp" value={form.company} onChange={(e) => set("company", e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Work Type</Label>
                <Select value={form.location_type} onValueChange={(v) => set("location_type", v as RecruiterJobInsert["location_type"])}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOCATION_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Employment Type</Label>
                <Select value={form.employment_type} onValueChange={(v) => set("employment_type", v as RecruiterJobInsert["employment_type"])}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Experience Level</Label>
                <Select value={form.experience_level ?? "mid"} onValueChange={(v) => set("experience_level", v as RecruiterJobInsert["experience_level"])}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVELS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="e.g. Toronto, ON or Remote" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} className="rounded-xl" />
            </div>
          </section>

          {/* Compensation */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold">Compensation</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sal-min">Min Salary</Label>
                <Input id="sal-min" type="number" placeholder="80000" value={form.salary_min ?? ""} onChange={(e) => set("salary_min", e.target.value ? Number(e.target.value) : undefined)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sal-max">Max Salary</Label>
                <Input id="sal-max" type="number" placeholder="120000" value={form.salary_max ?? ""} onChange={(e) => set("salary_max", e.target.value ? Number(e.target.value) : undefined)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.salary_currency} onValueChange={(v) => set("salary_currency", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD", "CAD", "GBP", "EUR", "AUD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="visa" checked={form.visa_sponsorship} onCheckedChange={(c) => set("visa_sponsorship", c)} />
              <Label htmlFor="visa" className="cursor-pointer">Visa sponsorship available</Label>
            </div>
          </section>

          {/* Job Details */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold">Job Details</h2>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Description <span className="text-destructive">*</span></Label>
              <Textarea
                id="desc"
                placeholder="Describe the role, your team, and what makes this opportunity exciting…"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="rounded-xl min-h-[140px]"
              />
              <p className="text-xs text-muted-foreground">{form.description.length} chars (min 50)</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="responsibilities">Responsibilities</Label>
              <Textarea id="responsibilities" placeholder="• Lead technical architecture decisions&#10;• Mentor junior engineers&#10;• Ship features end-to-end" value={form.responsibilities ?? ""} onChange={(e) => set("responsibilities", e.target.value)} className="rounded-xl min-h-[110px]" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea id="requirements" placeholder="• 5+ years of experience with React&#10;• Strong TypeScript skills&#10;• Experience with cloud platforms (AWS/GCP)" value={form.requirements ?? ""} onChange={(e) => set("requirements", e.target.value)} className="rounded-xl min-h-[110px]" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="benefits">Benefits & Perks</Label>
              <Textarea id="benefits" placeholder="• Competitive salary + equity&#10;• Unlimited PTO&#10;• Remote-first culture" value={form.benefits ?? ""} onChange={(e) => set("benefits", e.target.value)} className="rounded-xl min-h-[90px]" />
            </div>
          </section>

          {/* Tech Stack */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold">Tech Stack / Skills</h2>
            <p className="text-xs text-muted-foreground">Add technologies to improve candidate matching accuracy.</p>

            <div className="flex gap-2">
              <Input
                placeholder="e.g. React, TypeScript, Python…"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTech(); } }}
                className="rounded-xl flex-1"
              />
              <Button variant="outline" className="rounded-xl gap-1" onClick={addTech}>
                <Plus className="w-4 h-4" /> Add
              </Button>
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

          {/* Application Settings */}
          <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold">Application Settings</h2>
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Application Deadline (optional)</Label>
              <Input id="deadline" type="date" value={form.application_deadline?.split("T")[0] ?? ""} onChange={(e) => set("application_deadline", e.target.value || undefined)} className="rounded-xl w-full sm:w-64" />
            </div>
          </section>

          {/* Footer CTA */}
          <div className="flex justify-end gap-3 pb-4">
            <Button variant="outline" className="rounded-full" onClick={() => navigate(-1)}>Cancel</Button>
            <Button variant="outline" className="rounded-full gap-2" onClick={() => handleSave(false)} disabled={saving || publishing}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </Button>
            <Button className="rounded-full gap-2 shadow-md-1" onClick={() => handleSave(true)} disabled={saving || publishing}>
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Publish Now
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PostJob;
