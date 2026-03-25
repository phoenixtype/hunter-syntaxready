import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Users, Zap, CheckCircle2, Loader2, ArrowLeft, Target, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SEOHead from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

const BENEFITS = [
  { icon: Target, title: "AI-matched candidates", desc: "Hunter scores every candidate against your role automatically — you only see strong matches." },
  { icon: Users, title: "Active job seekers", desc: "Our candidates are actively job hunting and opted-in — far higher response rates than passive sourcing." },
  { icon: Zap, title: "Auto-apply pipeline", desc: "Qualified candidates can auto-apply to your roles, filling your pipeline 24/7 without manual outreach." },
  { icon: BrainCircuit, title: "Vetted profiles", desc: "Every candidate profile is AI-parsed and structured — skills, experience, and match score surfaced instantly." },
];

type Step = "form" | "submitted";

const RecruiterPortal = () => {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    companyName: "",
    companyWebsite: "",
    jobTitle: "",
    companySize: "",
    useCase: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.companyName || !form.jobTitle) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("recruiter-apply", {
        body: {
          fullName: form.fullName,
          email: form.email,
          companyName: form.companyName,
          companyWebsite: form.companyWebsite || undefined,
          jobTitle: form.jobTitle,
          companySize: form.companySize || undefined,
          useCase: form.useCase || undefined,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Submission failed");
      }

      setStep("submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Recruiter Portal"
        description="Apply to join Hunter as a recruiter and get access to AI-matched, active job seekers."
        path="/recruiter-portal"
      />

      <div className="min-h-screen bg-background">
        {/* Nav */}
        <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">H</span>
              </div>
              <span className="font-bold text-base tracking-tight">Hunter</span>
              <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">For Recruiters</span>
            </Link>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Already approved? <span className="text-primary font-medium">Sign in →</span>
            </Link>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-12 lg:py-20">
          {step === "submitted" ? (
            /* ── Success state ───────────────────────────────── */
            <div className="max-w-md mx-auto text-center space-y-6 py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">Application submitted</h1>
                <p className="text-muted-foreground leading-relaxed">
                  We've received your application and sent a confirmation to <strong>{form.email}</strong>.
                  Our team reviews applications manually and will get back to you within 2 business days.
                </p>
              </div>
              <div className="bg-muted/50 border border-border rounded-xl p-5 text-left space-y-3">
                <p className="text-sm font-semibold">What happens next</p>
                {[
                  "We verify your company details",
                  "You receive an approval email with your account setup link",
                  "Set up your recruiter profile and start posting jobs",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary-foreground text-[10px] font-bold">{i + 1}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
              <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to home
              </Link>
            </div>
          ) : (
            /* ── Main form layout ───────────────────────────── */
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              {/* Left — value prop */}
              <div className="space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold mb-4">
                    <Building2 className="w-3.5 h-3.5" /> For Recruiters & Hiring Managers
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight leading-tight mb-4">
                    Hire smarter with<br />
                    <span className="text-primary">AI-matched talent</span>
                  </h1>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Hunter's AI surfaces the best-fit candidates for every role automatically.
                    No resume sifting, no cold outreach — just matched, motivated candidates.
                  </p>
                </div>

                <div className="space-y-4">
                  {BENEFITS.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-4">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-[18px] h-[18px] text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{title}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-muted/40 border border-border rounded-xl p-5">
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    "We filled our senior engineering role in 4 days with Hunter. Every candidate was genuinely qualified — no noise."
                  </p>
                  <p className="text-xs font-semibold mt-3">— Engineering Manager, Series B startup</p>
                </div>
              </div>

              {/* Right — application form */}
              <div className="bg-card border border-border rounded-2xl p-8 shadow-card">
                <div className="mb-6">
                  <h2 className="text-xl font-bold tracking-tight">Apply to join Hunter</h2>
                  <p className="text-sm text-muted-foreground mt-1">We'll review your application within 2 business days.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName">Full name <span className="text-destructive">*</span></Label>
                      <Input id="fullName" value={form.fullName} onChange={set("fullName")} placeholder="Jane Smith" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Work email <span className="text-destructive">*</span></Label>
                      <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="jane@company.com" required />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName">Company name <span className="text-destructive">*</span></Label>
                      <Input id="companyName" value={form.companyName} onChange={set("companyName")} placeholder="Acme Corp" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="jobTitle">Your job title <span className="text-destructive">*</span></Label>
                      <Input id="jobTitle" value={form.jobTitle} onChange={set("jobTitle")} placeholder="Head of Talent" required />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyWebsite">Company website</Label>
                      <Input id="companyWebsite" value={form.companyWebsite} onChange={set("companyWebsite")} placeholder="https://company.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="companySize">Company size</Label>
                      <Select value={form.companySize} onValueChange={v => setForm(f => ({ ...f, companySize: v }))}>
                        <SelectTrigger id="companySize">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANY_SIZES.map(s => (
                            <SelectItem key={s} value={s}>{s} employees</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="useCase">How do you plan to use Hunter? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Textarea
                      id="useCase"
                      value={form.useCase}
                      onChange={set("useCase")}
                      placeholder="E.g. We're hiring 5 engineers this quarter and want a faster way to find qualified candidates..."
                      className="resize-none h-20"
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</> : "Submit application"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    By applying you agree to our{" "}
                    <Link to="/terms" className="underline hover:text-foreground">Terms</Link> and{" "}
                    <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
                  </p>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default RecruiterPortal;
