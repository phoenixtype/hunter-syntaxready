import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Search, Briefcase, FileText, UserPlus, FileCheck,
  RotateCcw, Copy, HelpCircle, ExternalLink,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SEOHead from "@/components/SEOHead";
import { useSubscription } from "@/hooks/useSubscription";
import ProGate from "@/components/ProGate";
import PageTour, { PageTourHandle } from "@/components/PageTour";
import { Step } from "react-joyride";
import { JobOpportunity } from "@/lib/crawler_engine";
import { generateTailoredContent, TailoredContent } from "@/lib/writer_engine";
import { findStakeholders, Stakeholder } from "@/lib/recruiter_engine";
import { saveTailoredResume } from "@/lib/tailored_resume_store";
import { useResume } from "@/hooks/useResume";

const WIZARD_TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Application Wizard takes a job posting URL and instantly generates a tailored resume, cover letter, and outreach strategy.",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"aw-url\"]",
    content: "Paste any public job posting URL — LinkedIn, Greenhouse, Lever, Workday, and more are all supported.",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"aw-submit\"]",
    content: "Click Analyze to let the AI extract job requirements, tailor your resume, and identify the right people to contact.",
    disableBeacon: true,
  },
];

type Step_ = "input" | "analyzing" | "generating" | "results";

const ApplicationWizard = () => {
  const navigate = useNavigate();
  const { profile } = useResume();
  const { isPro, isLoading: subLoading, canAccess, recordUsage } = useSubscription();
  const tourRef = useRef<PageTourHandle>(null);

  const [url, setUrl] = useState("");
  const [_loading, setLoading] = useState(false);
  const [showProGate, setShowProGate] = useState(false);
  const [step, setStep] = useState<Step_>("input");

  // Results
  const [job, setJob] = useState<JobOpportunity | null>(null);
  const [recruiters, setRecruiters] = useState<Stakeholder[]>([]);
  const [tailoredAssets, setTailoredAssets] = useState<TailoredContent | null>(null);

  const reset = () => {
    setStep("input");
    setJob(null);
    setRecruiters([]);
    setTailoredAssets(null);
    setUrl("");
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) { toast.error("Paste a job posting URL to continue."); return; }
    if (!profile) {
      toast.error("Complete your profile first", {
        description: "Go to Profile and add your experience and skills.",
      });
      return;
    }

    setLoading(true);
    setStep("analyzing");

    try {
      const { data: { session } } = await import("@/integrations/supabase/client").then(m => m.supabase.auth.getSession());

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crawl-jobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      if (!result.success || !result.jobs?.length) {
        throw new Error(result.error || "Could not extract job details. Please ensure the link is public.");
      }

      const scrapedJob: JobOpportunity = result.jobs[0];

      if (!scrapedJob.title || scrapedJob.title === "Untitled Job") {
        toast.warning("The job details couldn't be fully extracted from this URL.");
      }

      setJob(scrapedJob);
      setRecruiters(await findStakeholders(scrapedJob));

      setStep("generating");

      if (!canAccess("cover_letters") || !canAccess("resume_generations")) {
        setShowProGate(true);
        setStep("input");
        return;
      }

      const assets = await generateTailoredContent(profile, scrapedJob);
      setTailoredAssets(assets);

      await saveTailoredResume(assets, { title: scrapedJob.title, company: scrapedJob.company, url });
      await recordUsage({ featureName: "cover_letters" });
      await recordUsage({ featureName: "resume_generations" });

      setStep("results");
      toast.success("Application package ready and saved!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to process job link. Please try again.");
      setStep("input");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProGate.Page featureLabel="Application Wizard" isPro={isPro} isLoading={subLoading}>
      <ProGate.Dialog open={showProGate} onOpenChange={setShowProGate} featureLabel="Application Wizard" />
      <div className="min-h-screen bg-background text-foreground flex flex-col" data-hide-footer>
        <SEOHead
          title="Application Wizard"
          description="Paste a job link — AI tailors your resume and writes your cover letter instantly."
          path="/application-wizard"
          noIndex
        />
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Application Wizard" },
          ]}
          icon={<Briefcase className="w-4 h-4 text-primary" />}
          actions={
            <div className="flex items-center gap-2">
              {step === "results" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  className="h-7 px-2 text-xs text-muted-foreground gap-1"
                  title="Start a new analysis"
                >
                  <RotateCcw className="w-3 h-3" />
                  New Analysis
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => tourRef.current?.start()}
                title="Page tour"
              >
                <HelpCircle className="w-4 h-4" />
              </Button>
            </div>
          }
        />

        {/* ── INPUT STEP ── */}
        {step === "input" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-lg mx-auto text-center w-full">
            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mb-6">
              <Briefcase className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Application Wizard</h2>
            <p className="text-muted-foreground mb-8">
              Paste a job link — Hunter AI extracts the requirements, tailors your resume, and writes your cover letter.
            </p>

            <form onSubmit={handleAnalyze} className="w-full space-y-3" data-tour="aw-url">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="aw-url-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/jobs/view/..."
                  className="h-11 pl-9"
                  autoFocus
                />
              </div>
              <Button
                id="aw-analyze-btn"
                type="submit"
                disabled={!url}
                className="w-full h-11"
                data-tour="aw-submit"
              >
                Analyze with AI
              </Button>
            </form>
          </div>
        )}

        {/* ── LOADING STEPS ── */}
        {(step === "analyzing" || step === "generating") && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              {step === "analyzing" ? "Analyzing Job Posting…" : "Tailoring Your Resume…"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {step === "analyzing"
                ? "Extracting requirements and matching your profile."
                : "Generating tailored resume changes and cover letter."}
            </p>
          </div>
        )}

        {/* ── RESULTS STEP ── */}
        {step === "results" && job && tailoredAssets && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

              {/* Job summary card */}
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="text-sm font-semibold">Extracted Job</h2>
                </div>
                <div className="p-4 space-y-3">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-base">{job.title}</p>
                    <p className="text-sm text-primary">{job.company}
                      <span className="text-muted-foreground font-normal ml-2">{job.source}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {job.location && (
                      <Badge variant="outline" className="text-xs">
                        <Briefcase className="w-3 h-3 mr-1" />{job.location}
                      </Badge>
                    )}
                    {job.salary_range && (
                      <Badge variant="secondary" className="text-xs">
                        {job.salary_range}
                      </Badge>
                    )}
                  </div>
                  {(job.tech_stack?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Targeted Keywords
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {job.tech_stack!.map((tech, i) => (
                          <Badge key={i} variant="secondary" className="text-xs font-medium">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tailored Resume */}
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="text-sm font-semibold">Tailored Resume</h2>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Auto-generated modifications optimised for {job.company}'s ATS requirements.
                  </p>
                  <div className="pl-3 space-y-2 border-l-2 border-primary/20">
                    {tailoredAssets.changes_summary.map((change, i) => (
                      <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary shrink-0 mt-0.5">•</span>
                        {change}
                      </p>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Button className="flex-1 h-10" onClick={() => navigate("/resume-builder")}>
                      Open Resume Builder
                    </Button>
                    <Button variant="outline" className="flex-1 h-10" onClick={() => navigate("/tailored-resumes")}>
                      View Saved Resumes
                    </Button>
                  </div>
                </div>
              </div>

              {/* Cover Letter */}
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="text-sm font-semibold">Cover Letter</h2>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-5 leading-relaxed">
                    "{tailoredAssets.coverLetter}"
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(tailoredAssets.coverLetter);
                      toast.success("Cover letter copied to clipboard!");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy to Clipboard
                  </Button>
                </div>
              </div>

              {/* Outreach */}
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="text-sm font-semibold">Direct Outreach</h2>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Find the hiring team at <strong className="text-foreground">{job.company}</strong> and connect before the ATS does.
                  </p>
                  <div className="space-y-2">
                    {recruiters.length > 0 ? recruiters.map((person, i) => (
                      <a
                        key={i}
                        href={person.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 p-3 rounded-md border border-border hover:border-primary/30 hover:bg-muted/40 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Search className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">{person.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{person.role}</p>
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-md italic">
                        No contacts found — try searching LinkedIn manually.
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Opens a LinkedIn search. Ensure you're signed in.</p>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
      <PageTour ref={tourRef} tourKey="application_wizard" steps={WIZARD_TOUR_STEPS} />
    </ProGate.Page>
  );
};

export default ApplicationWizard;
