import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Save, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRecruiterProfile } from "@/hooks/useRecruiter";
import { upsertRecruiterProfile, type CompanySize } from "@/lib/recruiter_engine";

const SIZES: { value: CompanySize; label: string }[] = [
  { value: "1-10",      label: "1–10 employees" },
  { value: "11-50",     label: "11–50 employees" },
  { value: "51-200",    label: "51–200 employees" },
  { value: "201-500",   label: "201–500 employees" },
  { value: "501-1000",  label: "501–1,000 employees" },
  { value: "1001-5000", label: "1,001–5,000 employees" },
  { value: "5000+",     label: "5,000+ employees" },
];

const CompanyProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading, refresh } = useRecruiterProfile();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    company_website: "",
    industry: "",
    headquarters: "",
    company_size: "" as CompanySize | "",
    about: "",
    linkedin_url: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        company_name: profile.company_name ?? "",
        company_website: profile.company_website ?? "",
        industry: profile.industry ?? "",
        headquarters: profile.headquarters ?? "",
        company_size: (profile.company_size ?? "") as CompanySize | "",
        about: profile.about ?? "",
        linkedin_url: profile.linkedin_url ?? "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.company_name.trim()) { toast.error("Company name is required"); return; }
    setSaving(true);
    try {
      await upsertRecruiterProfile(user.id, {
        ...form,
        company_size: form.company_size || undefined,
      });
      await refresh();
      toast.success("Company profile saved.");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="h-14 border-b border-border bg-card" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold">Company Profile</h1>
            <p className="text-xs text-muted-foreground">Visible to candidates who view your job listings</p>
          </div>
        </div>
        <Button className="rounded-full gap-2 shadow-md-1" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Logo placeholder */}
          <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <p className="font-semibold">{form.company_name || "Your Company"}</p>
              <p className="text-sm text-muted-foreground">{form.industry || "Industry not set"}</p>
              {profile?.is_verified && (
                <span className="text-xs text-green-600 font-medium mt-0.5 block">✓ Verified employer</span>
              )}
            </div>
          </div>

          <section className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold">Company Details</h2>

            <div className="space-y-1.5">
              <Label htmlFor="name">Company Name <span className="text-destructive">*</span></Label>
              <Input id="name" value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} className="rounded-xl" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" placeholder="https://yourcompany.com" value={form.company_website} onChange={(e) => setForm((p) => ({ ...p, company_website: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkedin">LinkedIn URL</Label>
                <Input id="linkedin" placeholder="https://linkedin.com/company/..." value={form.linkedin_url} onChange={(e) => setForm((p) => ({ ...p, linkedin_url: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" placeholder="e.g. Software, FinTech, Healthcare" value={form.industry} onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hq">Headquarters</Label>
                <Input id="hq" placeholder="e.g. Toronto, ON" value={form.headquarters} onChange={(e) => setForm((p) => ({ ...p, headquarters: e.target.value }))} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Company Size</Label>
              <Select value={form.company_size} onValueChange={(v) => setForm((p) => ({ ...p, company_size: v as CompanySize }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  {SIZES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="about">About the Company</Label>
              <Textarea
                id="about"
                placeholder="Tell candidates what makes your company a great place to work…"
                value={form.about}
                onChange={(e) => setForm((p) => ({ ...p, about: e.target.value }))}
                className="rounded-xl min-h-[120px]"
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CompanyProfile;
