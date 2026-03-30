import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, Briefcase, FileText, UserPlus, FileCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SEOHead from "@/components/SEOHead";
import { useSubscription } from "@/hooks/useSubscription";
import ProGate from "@/components/ProGate";
import { JobOpportunity } from "@/lib/crawler_engine";
import { generateTailoredContent, TailoredContent } from "@/lib/writer_engine";
import { findStakeholders, Stakeholder } from "@/lib/recruiter_engine";
import { saveTailoredResume } from "@/lib/tailored_resume_store";
import { useResume } from "@/hooks/useResume";

const ApplicationWizard = () => {
    const navigate = useNavigate();
    const { profile } = useResume();
    const { isPro, isLoading: subLoading, canAccess, recordUsage, getRemainingUsage } = useSubscription();

    const [url, setUrl] = useState("");
    const [_loading, setLoading] = useState(false);
    const [showProGate, setShowProGate] = useState(false);
    const [step, setStep] = useState<'input' | 'analyzing' | 'generating' | 'results'>('input');

    // Results
    const [job, setJob] = useState<JobOpportunity | null>(null);
    const [recruiters, setRecruiters] = useState<Stakeholder[]>([]);
    const [tailoredAssets, setTailoredAssets] = useState<TailoredContent | null>(null);

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) { toast.error("Paste a job posting URL to continue."); return; }
        if (!profile) { toast.error("Complete your profile first", { description: "Go to Profile and add your experience and skills." }); return; }

        setLoading(true);
        setStep('analyzing');

        try {
            // 1. Crawl the job URL via the crawl-jobs edge function
            const { data: { session } } = await import('@/integrations/supabase/client').then(m => m.supabase.auth.getSession());

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crawl-jobs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: url })
            });

            const result = await response.json();

            if (!result.success || !result.jobs || result.jobs.length === 0) {
                const errorMsg = result.error || "Could not extract job details. Please ensure the link is public.";
                throw new Error(errorMsg);
            }

            const scrapedJob = result.jobs[0];

            // Validate scraped job has minimal content
            if (!scrapedJob.title || scrapedJob.title === 'Untitled Job') {
                toast.warning("The job details couldn't be fully extracted given the URL.");
            }

            setJob(scrapedJob);

            // 2. Generate Strategy (Recruiters)
            setRecruiters(await findStakeholders(scrapedJob));

            // 3. Generate Assets (Tailored Resume & Cover Letter)
            setStep('generating');

            // Check usage limits before generating
            if (!canAccess('cover_letters')) {
                setShowProGate(true);
                setStep('input');
                return;
            }

            if (!canAccess('resume_generations')) {
                setShowProGate(true);
                setStep('input');
                return;
            }

            const assets = await generateTailoredContent(profile, scrapedJob);
            setTailoredAssets(assets);

            // Persist the tailored resume automatically
            await saveTailoredResume(assets, {
                title: scrapedJob.title,
                company: scrapedJob.company,
                url: url
            });

            // Record usage for both features
            await recordUsage({ featureName: 'cover_letters' });
            await recordUsage({ featureName: 'resume_generations' });

            setStep('results');
            toast.success("Application package ready and saved!");

        } catch (error) {
            console.error(error);
            toast.error("Failed to process job link. Please try again.");
            setStep('input');
        } finally {
            setLoading(false);
        }
    };

    return (
    <ProGate.Page featureLabel="Application Wizard" isPro={isPro} isLoading={subLoading}>
    <div className="min-h-screen bg-background text-foreground">
      <ProGate.Dialog open={showProGate} onOpenChange={setShowProGate} featureLabel="Application Wizard" />
      <SEOHead title="Application Wizard" description="Find and apply to jobs with AI-powered automation." path="/application-wizard" noIndex />
            <PageHeader
              breadcrumbs={[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Application Wizard" },
              ]}
              icon={<Briefcase className="w-4 h-4 text-primary" />}
            />
            <div className="container max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-6 animate-fade-in-up">
              <h1 className="text-2xl font-bold tracking-tight">Targeted Application Wizard</h1>
              <p className="text-muted-foreground text-sm mt-1">Paste a job link — hunter.ai scrapes the posting, tailors your resume, and writes your cover letter.</p>
            </div>

            <main className="container max-w-4xl mx-auto px-4 sm:px-6 space-y-8 pb-12 animate-fade-in-up">

                {/* INPUT STEP */}
                {step === 'input' && (
                    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow max-w-2xl mx-auto rounded-2xl overflow-hidden">
                        <CardContent className="p-8 sm:p-10 text-center">
                            <form onSubmit={handleAnalyze} className="space-y-8">
                                <div className="space-y-3">
                                    <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
                                        <Briefcase className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-2xl font-semibold tracking-tight">Paste a Job Link</h2>
                                    <p className="text-base text-muted-foreground max-w-md mx-auto">
                                        hunter.ai will extract the details, tailor your resume, and write a custom cover letter instantly.
                                    </p>
                                </div>
                                <div className="space-y-4 max-w-lg mx-auto">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                        <Input
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://www.linkedin.com/jobs/view/..."
                                            className="h-14 pl-12 rounded-xl border-border focus:border-primary text-base shadow-sm transition-colors bg-background/50 hover:bg-background"
                                        />
                                    </div>
                                    <Button type="submit" disabled={!url} size="lg" className="w-full h-14 rounded-xl text-base font-semibold shadow-sm hover:shadow-md transition-all">
                                        Analyze with AI
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* LOADING STEPS */}
                {(step === 'analyzing' || step === 'generating') && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <h2 className="text-xl font-semibold">
                            {step === 'analyzing' ? "Analyzing Job Details..." : "Tailoring Your Resume..."}
                        </h2>
                        <p className="text-muted-foreground">This uses AI to extract requirements and match your skills.</p>
                    </div>
                )}

                {/* RESULTS STEP */}
                {step === 'results' && job && tailoredAssets && (
                    <div className="space-y-8 animate-scale-in">

                        {/* 1. Job Summary */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 rounded-lg bg-primary/10">
                                    <FileCheck className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-lg font-bold tracking-tight">Extracted Job Requirements</h2>
                            </div>
                            <Card className="border-border bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden border">
                                <div className="p-6 sm:p-8 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-br from-card to-muted/20">
                                    <div className="space-y-1.5">
                                        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{job.title}</h3>
                                        <p className="text-base text-primary font-medium flex items-center gap-2">
                                            {job.company}
                                            <span className="text-muted-foreground font-normal text-sm bg-muted px-2 py-0.5 rounded-full">{job.source}</span>
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 items-end">
                                        {job.location && (
                                            <Badge variant="outline" className="bg-background font-medium py-1 px-3 text-sm">
                                                <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                                                {job.location}
                                            </Badge>
                                        )}
                                        {job.salary_range && (
                                            <Badge variant="secondary" className="font-semibold text-primary py-1 px-3 text-sm bg-primary/10 border-none">
                                                <span className="text-foreground/70 mr-1">$</span> {job.salary_range}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <CardContent className="p-6 sm:p-8 space-y-5">
                                    <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Targeted Keywords</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {job.tech_stack?.length ? job.tech_stack.map((tech, i) => (
                                            <Badge key={i} variant="secondary" className="px-3 py-1.5 font-medium bg-muted text-muted-foreground hover:bg-muted/80">{tech}</Badge>
                                        )) : <span className="text-sm text-muted-foreground italic">No specific hard skills extracted.</span>}
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* 2. Tailored Assets */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-primary/10">
                                        <FileText className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-lg font-bold tracking-tight">Application Assets</h2>
                                </div>
                                <Card className="h-full border-border bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden border">
                                    <CardContent className="p-6 sm:p-8 space-y-8">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 font-semibold text-lg border-b border-border/50 pb-4">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                                                  <FileCheck className="w-5 h-5 text-primary" />
                                                </div>
                                                Tailored Resume
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed">Auto-generated modifications optimized specifically for {job.company}'s ATS requirements.</p>
                                            <div className="pl-4 space-y-3 border-l-2 border-primary/20 mt-4 py-1">
                                                {tailoredAssets.changes_summary.map((change, i) => (
                                                    <p key={i} className="text-sm text-muted-foreground/80 leading-relaxed font-medium flex items-start gap-2">
                                                      <span className="text-primary mt-1 text-[10px]">•</span>
                                                      {change}
                                                    </p>
                                                ))}
                                            </div>
                                            <div className="flex flex-col gap-3 mt-6">
                                                <Button className="w-full rounded-xl h-11 shadow-sm" onClick={() => navigate('/resume-builder')}>Open Resume Builder</Button>
                                                <Button variant="outline" className="w-full rounded-xl h-11 border-border/60 hover:bg-muted/50" onClick={() => navigate('/tailored-resumes')}>View All Saved Resumes</Button>
                                            </div>
                                        </div>

                                        <div className="pt-8 border-t border-border/50 space-y-4">
                                            <div className="flex items-center gap-3 font-semibold text-lg border-b border-border/50 pb-4">
                                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                                                  <FileText className="w-5 h-5 text-primary" />
                                                </div>
                                                Cover Letter
                                            </div>
                                            <div className="relative">
                                                <p className="text-sm text-foreground/80 leading-relaxed bg-muted/40 p-5 rounded-xl border border-border/50 line-clamp-4 shadow-inner">
                                                    "{tailoredAssets.coverLetter}"
                                                </p>
                                                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted/40 to-transparent rounded-b-xl"></div>
                                            </div>
                                            <Button variant="outline" className="w-full rounded-xl h-11 border-border/60 hover:bg-muted/50 shadow-sm" onClick={() => {
                                                if (tailoredAssets?.coverLetter) {
                                                    navigator.clipboard.writeText(tailoredAssets.coverLetter);
                                                    toast.success("Cover letter copied to clipboard!");
                                                }
                                            }}>Copy to Clipboard</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                            {/* 3. Networking Strategy */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-primary/10">
                                        <UserPlus className="w-5 h-5 text-primary" />
                                    </div>
                                    <h2 className="text-lg font-bold tracking-tight">Direct Outreach</h2>
                                </div>
                                <Card className="h-full border-border bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden border">
                                    <CardContent className="p-6 sm:p-8 space-y-6">
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Find the hiring team at <strong className="text-foreground">{job?.company}</strong> and reach out directly. A personal connection often gets your application noticed before the ATS even scans it.
                                        </p>
                                        <div className="space-y-3 pt-2">
                                            {recruiters.length > 0 ? recruiters.map((person, i) => (
                                                <a
                                                    key={i}
                                                    href={person.profile_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group flex items-center justify-between gap-4 p-4 rounded-xl hover:bg-muted/50 transition-all border border-border/60 hover:border-primary/30 hover:shadow-sm bg-background/50"
                                                >
                                                    <div className="flex items-center gap-4">
                                                      <div className="w-10 h-10 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                                                          <Search className="w-4 h-4 text-primary" />
                                                      </div>
                                                      <div>
                                                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">{person.name}</p>
                                                          <p className="text-xs text-muted-foreground/80 mt-0.5">{person.role}</p>
                                                      </div>
                                                    </div>
                                                    <span className="text-xs text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-primary/10 px-2.5 py-1 rounded-md">Search →</span>
                                                </a>
                                            )) : (
                                                <p className="text-sm text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-xl">No immediate contacts found. Try searching LinkedIn manually.</p>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground/60 pt-2 text-center">
                                            Opens a LinkedIn search. Ensure you are signed in.
                                        </p>
                                    </CardContent>
                                </Card>
                            </section>

                        </div>
                    </div>
                )}
            </main>
        </div>
    </ProGate.Page>
    );
};

export default ApplicationWizard;
