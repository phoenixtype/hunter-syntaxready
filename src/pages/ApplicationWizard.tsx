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
                    <Card className="border-border bg-card shadow-card">
                        <CardContent className="p-5 sm:p-6">
                            <form onSubmit={handleAnalyze} className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-base font-medium">Job URL (LinkedIn, Indeed, Company Site)</label>
                                    <div className="flex flex-col gap-3">
                                        <Input
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://www.linkedin.com/jobs/view/..."
                                            className="h-12 border-border focus:border-primary text-base"
                                        />
                                        <Button type="submit" disabled={!url} size="lg" className="w-full h-12 text-base font-semibold">
                                            Analyze with AI
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground">hunter.ai scrapes the job page and uses AI to extract skills, keywords, and compensation data to tailor your application.</p>
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
                            <div className="flex items-center gap-2 px-2">
                                <FileCheck className="w-5 h-5 text-primary" />
                                <h2 className="text-sm font-semibold">Parsed Extracted Strategy</h2>
                            </div>
                            <Card className="border-border bg-card shadow-card overflow-hidden">
                                <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start gap-2">
                                    <div>
                                        <h3 className="text-lg font-bold tracking-tight text-foreground">{job.title}</h3>
                                        <p className="text-sm text-primary font-medium mt-1">{job.company}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-border text-xs px-3 py-1 text-muted-foreground">{job.source}</Badge>
                                </div>
                                <CardContent className="p-4 sm:p-6">
                                    <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 text-sm text-muted-foreground font-medium">
                                        <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-md"><Briefcase className="w-4 h-4" /> {job.location || 'Remote'}</span>
                                        {job.salary_range && <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-md"><span className="text-foreground">$</span> {job.salary_range}</span>}
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Required Skills Matching</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {job.tech_stack?.map((tech, i) => (
                                                <Badge key={i} variant="secondary" className="">{tech}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* 2. Tailored Assets */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    <h2 className="text-sm font-semibold">Application Assets</h2>
                                </div>
                                <Card className="h-full border-border bg-card shadow-card">
                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 font-medium">
                                                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                                                  <FileCheck className="w-4 h-4" />
                                                </div>
                                                Tailored Resume
                                            </div>
                                            <p className="text-sm text-muted-foreground">Auto-generated modifications optimized for {job.company} ATS.</p>
                                            <div className="pl-2 space-y-2 border-l-2 border-primary/30 mt-4 py-1">
                                                {tailoredAssets.changes_summary.map((change, i) => (
                                                    <p key={i} className="text-sm text-muted-foreground pl-3">{change}</p>
                                                ))}
                                            </div>
                                            <div className="flex flex-col gap-2 mt-4">
                                                <Button className="w-full" onClick={() => navigate('/resume-builder')}>Open Resume Builder</Button>
                                                <Button variant="outline" className="w-full" onClick={() => navigate('/tailored-resumes')}>View All Saved Resumes</Button>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-border space-y-3">
                                            <div className="flex items-center gap-2 font-medium">
                                                <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                                                  <FileText className="w-4 h-4" />
                                                </div>
                                                Cover Letter
                                            </div>
                                            <p className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded-md border border-border line-clamp-4">"{tailoredAssets.coverLetter}"</p>
                                            <Button variant="outline" className="w-full" onClick={() => {
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
                                <div className="flex items-center gap-2 px-2">
                                    <UserPlus className="w-5 h-5 text-primary" />
                                    <h2 className="text-sm font-semibold">Find the Team on LinkedIn</h2>
                                </div>
                                <Card className="h-full border-border bg-card shadow-card">
                                    <CardContent className="p-6 space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Use these searches to find real people at <strong>{job?.company}</strong> and reach out directly. A personal connection often gets your application noticed.
                                        </p>
                                        <div className="space-y-2.5">
                                            {recruiters.map((person, i) => (
                                                <a
                                                    key={i}
                                                    href={person.profile_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group flex items-center justify-between gap-4 p-3.5 rounded-md hover:bg-muted transition-all border border-border hover:border-primary/20"
                                                >
                                                    <div className="flex items-center gap-3">
                                                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                                                          <Search className="w-4 h-4 text-primary" />
                                                      </div>
                                                      <div>
                                                          <p className="font-medium text-sm group-hover:text-primary transition-colors">{person.name}</p>
                                                          <p className="text-xs text-muted-foreground">{person.role}</p>
                                                      </div>
                                                    </div>
                                                    <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Search →</span>
                                                </a>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground/70 pt-1">
                                            These open LinkedIn people searches. You'll need to be signed into LinkedIn to see results.
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
