import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Search, Briefcase, FileText, UserPlus, FileCheck } from "lucide-react";
import { triggerJobCrawl, JobOpportunity } from "@/lib/crawler_engine";
import { generateTailoredContent, TailoredContent } from "@/lib/writer_engine";
import { findStakeholders, Stakeholder } from "@/lib/recruiter_engine";
import { useResume } from "@/hooks/useResume";

const ApplicationWizard = () => {
    const navigate = useNavigate();
    const { profile } = useResume();

    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'input' | 'analyzing' | 'generating' | 'results'>('input');

    // Results
    const [job, setJob] = useState<JobOpportunity | null>(null);
    const [recruiters, setRecruiters] = useState<Stakeholder[]>([]);
    const [tailoredAssets, setTailoredAssets] = useState<TailoredContent | null>(null);

    const handleAnalyze = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url || !profile) return;

        setLoading(true);
        setStep('analyzing');

        try {
            // 1. Crawl URL
            // We use triggerJobCrawl but currently it's hardcoded to trigger 'crawl-jobs'. 
            // We need to pass the URL. The existing triggerJobCrawl might need a tiny update or we call edge function directly.
            // For now, let's assume we can pass optional body via a direct fetch or updated helper.
            // I'll use a direct fetch here to be safe and precise, rather than relying on the helper that might assume search.
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

            // 3. Generate Assets (Tailored Resume)
            setStep('generating');
            const assets = await generateTailoredContent(profile, scrapedJob);
            setTailoredAssets(assets);

            setStep('results');
            toast.success("Application package ready!");

        } catch (error) {
            console.error(error);
            toast.error("Failed to process job link. Please try again.");
            setStep('input');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-6">
            <header className="mb-8 container max-w-4xl mx-auto">
                <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2 mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Button>
                <h1 className="text-3xl font-bold">Targeted Application</h1>
                <p className="text-muted-foreground">Paste a job link to generate a tailored strategy.</p>
            </header>

            <main className="container max-w-4xl mx-auto space-y-8 animate-fade-in">

                {/* INPUT STEP */}
                {step === 'input' && (
                    <Card className="">
                        <CardContent className="p-8">
                            <form onSubmit={handleAnalyze} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Job URL (LinkedIn, Indeed, Company Site)</label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://www.linkedin.com/jobs/view/..."
                                            className="h-12"
                                        />
                                        <Button type="submit" disabled={!url} size="lg" className="h-12 px-8">
                                            Analyze
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* LOADING STEPS */}
                {(step === 'analyzing' || step === 'generating') && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
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
                            <div className="flex items-center gap-2 text-primary">
                                <Briefcase className="w-5 h-5" />
                                <h2 className="text-xl font-semibold">Target Role</h2>
                            </div>
                            <Card className="">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-2xl font-bold">{job.title}</h3>
                                            <p className="text-lg text-muted-foreground">{job.company}</p>
                                            <p className="text-sm text-muted-foreground mt-1">{job.location} • {job.salary_range}</p>
                                        </div>
                                        <Badge variant="outline" className="text-xs">{job.source}</Badge>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {job.tech_stack?.map((tech, i) => (
                                            <Badge key={i} variant="secondary">{tech}</Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <div className="grid md:grid-cols-2 gap-6">

                            {/* 2. Tailored Assets */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <FileText className="w-5 h-5" />
                                    <h2 className="text-xl font-semibold">Application Assets</h2>
                                </div>
                                <Card className=" h-full">
                                    <CardContent className="p-6 space-y-4">
                                        <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
                                            <div className="flex items-center gap-2 font-medium">
                                                <FileCheck className="w-4 h-4 text-foreground" />
                                                Tailored Resume
                                            </div>
                                            <p className="text-xs text-muted-foreground">Optimized for {job.company} ATS</p>
                                            <div className="pl-6 space-y-1">
                                                {tailoredAssets.changes_summary.map((change, i) => (
                                                    <p key={i} className="text-xs text-muted-foreground">• {change}</p>
                                                ))}
                                            </div>
                                            <Button variant="outline" size="sm" className="w-full mt-2">Download PDF (Coming Soon)</Button>
                                        </div>

                                        <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
                                            <div className="flex items-center gap-2 font-medium">
                                                <FileText className="w-4 h-4" />
                                                Cover Letter
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-3 italic">"{tailoredAssets.coverLetter.substring(0, 100)}..."</p>
                                            <Button variant="outline" size="sm" className="w-full">Copy to Clipboard</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                            {/* 3. Networking Strategy */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <UserPlus className="w-5 h-5" />
                                    <h2 className="text-xl font-semibold">Recruiting Team</h2>
                                </div>
                                <Card className=" h-full">
                                    <CardContent className="p-6 space-y-4">
                                        <p className="text-sm text-muted-foreground">Use these search strategies to find key people.</p>
                                        <div className="space-y-3">
                                            {recruiters.map((person, i) => (
                                                <a
                                                    key={i}
                                                    href={person.profile_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground font-bold text-xs">
                                                        <Search className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{person.name}</p>
                                                        <p className="text-xs text-muted-foreground">{person.role}</p>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </section>

                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ApplicationWizard;
