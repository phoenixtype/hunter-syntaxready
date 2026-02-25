import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, Briefcase, FileText, UserPlus, FileCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
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
        <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
            <PageHeader
              breadcrumbs={[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Application Wizard" },
              ]}
              icon={<Briefcase className="w-4 h-4 text-primary" />}
            />
            <div className="container max-w-4xl mx-auto px-6 pt-8 pb-6 animate-fade-in-up">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Targeted Application Wizard</h1>
              <p className="text-muted-foreground text-lg mt-1">Paste a job link to generate a tailored strategy using Auto-Applier AI.</p>
            </div>

            <main className="container max-w-4xl mx-auto px-6 space-y-8 pb-12 animate-fade-in-up">

                {/* INPUT STEP */}
                {step === 'input' && (
                    <Card className="border-border bg-card/50 backdrop-blur-md shadow-xl">
                        <CardContent className="p-8 md:p-10">
                            <form onSubmit={handleAnalyze} className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-base font-medium">Job URL (LinkedIn, Indeed, Company Site)</label>
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <Input
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            placeholder="https://www.linkedin.com/jobs/view/..."
                                            className="h-14 text-lg bg-background/50 border-border focus:border-primary"
                                        />
                                        <Button type="submit" disabled={!url} size="lg" className="h-14 px-8 text-lg font-medium shadow-glow hover:shadow-glow-lg transition-all rounded-xl whitespace-nowrap">
                                            Analyze with AI
                                        </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground">The bot will instantly parse the JD to extract required skills, keywords, and compensation data.</p>
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
                            <div className="flex items-center gap-2 px-2">
                                <FileCheck className="w-5 h-5 text-primary" />
                                <h2 className="text-xl font-semibold">Parsed Extracted Strategy</h2>
                            </div>
                            <Card className="border-border bg-card/50 backdrop-blur-md shadow-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-primary/20 via-primary/5 to-transparent p-6 border-b border-border flex justify-between items-start">
                                    <div>
                                        <h3 className="text-2xl font-bold tracking-tight text-foreground">{job.title}</h3>
                                        <p className="text-lg text-primary font-medium mt-1">{job.company}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-border text-xs px-3 py-1 text-muted-foreground">{job.source}</Badge>
                                </div>
                                <CardContent className="p-6">
                                    <div className="flex gap-4 mb-6 text-sm text-muted-foreground font-medium">
                                        <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-md"><Briefcase className="w-4 h-4" /> {job.location || 'Remote'}</span>
                                        {job.salary_range && <span className="flex items-center gap-1.5 bg-secondary/50 px-3 py-1.5 rounded-md"><span className="text-foreground">$</span> {job.salary_range}</span>}
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Required Skills Matching</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {job.tech_stack?.map((tech, i) => (
                                                <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">{tech}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>

                        <div className="grid md:grid-cols-2 gap-6">

                            {/* 2. Tailored Assets */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 px-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    <h2 className="text-xl font-semibold">Application Assets</h2>
                                </div>
                                <Card className="h-full border-border bg-card/50 backdrop-blur-md shadow-lg">
                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 font-medium text-lg">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
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
                                            <Button className="w-full mt-4 shadow-glow" onClick={() => navigate('/resume-builder')}>Open Resume Builder</Button>
                                        </div>

                                        <div className="pt-6 border-t border-border space-y-3">
                                            <div className="flex items-center gap-2 font-medium text-lg">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                                  <FileText className="w-4 h-4" />
                                                </div>
                                                Cover Letter
                                            </div>
                                            <p className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded-lg border border-border line-clamp-4">"{tailoredAssets.coverLetter}"</p>
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
                                    <h2 className="text-xl font-semibold">Recruiting Team</h2>
                                </div>
                                <Card className="h-full border-border bg-card/50 backdrop-blur-md shadow-lg">
                                    <CardContent className="p-6 space-y-6">
                                        <p className="text-sm text-muted-foreground text-center bg-primary/10 text-primary border border-primary/20 rounded-lg p-3">Smart connections increase callback rates by 40%.</p>
                                        <div className="space-y-3">
                                            {recruiters.map((person, i) => (
                                                <a
                                                    key={i}
                                                    href={person.profile_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl hover:bg-muted transition-all border border-border hover:border-primary/20"
                                                >
                                                    <div className="flex items-center gap-4">
                                                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground font-bold group-hover:bg-primary/20 transition-colors">
                                                          <Search className="w-5 h-5 group-hover:text-primary" />
                                                      </div>
                                                      <div>
                                                          <p className="font-semibold text-base group-hover:text-primary transition-colors">{person.name}</p>
                                                          <p className="text-sm text-muted-foreground">{person.role}</p>
                                                      </div>
                                                    </div>
                                                    <Button variant="secondary" size="sm" className="w-full sm:w-auto opacity-80 group-hover:opacity-100 transition-opacity">Connect</Button>
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
