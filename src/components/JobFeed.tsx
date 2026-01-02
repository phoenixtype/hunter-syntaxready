import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JobOpportunity, searchJobs, triggerJobCrawl, getJobCount } from "@/lib/crawler_engine";
import { CandidateProfile } from "@/lib/resume_engine";
import { calculateMatch, MatchResult } from "@/lib/matching_engine";
import { generateTailoredContent, TailoredContent } from "@/lib/writer_engine";
import { simulateApplication, ApplicationState, ComplianceError } from "@/lib/application_engine";
import { recordFeedback, getOptimizedWeights, MatchingWeights } from "@/lib/learning_engine";
import { ExternalLink, Sparkles, RefreshCw, Terminal, PenTool, Send, Check, GraduationCap, X, Loader2, Globe, Zap, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import InterviewPrepModal from "./InterviewPrep";
import { useAuth } from "@/hooks/useAuth";

interface JobFeedProps {
    profile: CandidateProfile | null;
}

interface EnrichedJob extends JobOpportunity {
    match?: MatchResult;
}

const JobFeed = ({ profile }: JobFeedProps) => {
    const { user } = useAuth();
    const [jobs, setJobs] = useState<EnrichedJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [crawling, setCrawling] = useState(false);
    const [jobCount, setJobCount] = useState<number>(0);
    const [activeApplication, setActiveApplication] = useState<ApplicationState | null>(null);
    const [stakeholders, setStakeholders] = useState<Record<string, any[]>>({});
    const [prepJob, setPrepJob] = useState<JobOpportunity | null>(null);

    const handleApply = async (job: JobOpportunity) => {
        toast.info(`Initiating Auto-Apply for ${job.company}...`);

        await recordFeedback({
            jobId: job.id,
            action: 'APPLY',
            timestamp: Date.now(),
            jobMetadata: {
                skills: job.tech_stack || [],
                company: job.company,
                source: job.source
            }
        });

        try {
            await simulateApplication(job, (state) => {
                setActiveApplication(state);
                if (state.status === 'applied') {
                    toast.success(`Application sent to ${job.company}!`);
                    setTimeout(() => setActiveApplication(null), 3000);
                }
            }, user?.id, true); // Pass userId and safeMode
        } catch (error) {
            if (error instanceof ComplianceError) {
                toast.warning("Application Blocked by Compliance Agent", {
                    description: error.message,
                    duration: 5000
                });
                setActiveApplication(null);
            } else {
                console.error("Application error:", error);
                toast.error("Application failed due to technical error.");
            }
            setActiveApplication(null);
        }
    };

    const handleDismiss = async (job: JobOpportunity) => {
        setJobs(current => current.filter(j => j.id !== job.id));
        await recordFeedback({
            jobId: job.id,
            action: 'DISMISS',
            timestamp: Date.now(),
            jobMetadata: { skills: [], company: job.company, source: job.source }
        });
        toast("Job dismissed", { description: "Hunter will show fewer jobs like this." });
    };

    const handleExpandJob = async (jobId: string) => {
        // Logic to fetch network data when expanding
        if (!stakeholders[jobId]) {
            const job = jobs.find(j => j.id === jobId);
            if (job) {
                // Dynamic import to avoid circular dep issues in some bundlers
                const { findStakeholders } = await import("@/lib/recruiter_engine");
                const network = await findStakeholders(job);
                setStakeholders(prev => ({ ...prev, [jobId]: network }));
            }
        }
    };

    const handleTailor = async (job: JobOpportunity) => {
        if (!profile) return;
        toast.info("Writer Agent is rewriting your resume...");
        try {
            const content = await generateTailoredContent(profile, job);
            toast.success("Resume optimized for role.", {
                description: content.changes_summary[0]
            });
        } catch (e) {
            toast.error("Tailoring failed.");
        }
    };

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const rawJobs = await searchJobs();
            const weights = getOptimizedWeights();
            const count = await getJobCount();
            setJobCount(count);

            // If we have a profile, calculate matches
            let enrichedJobs = rawJobs;
            if (profile) {
                const matches = await Promise.all(
                    rawJobs.map(async (job) => {
                        const match = await calculateMatch(profile, job, weights);
                        return { ...job, match };
                    })
                );
                // Filter out 0 scores (banned)
                enrichedJobs = matches
                    .filter(j => j.match.overall_score > 0)
                    .sort((a, b) => b.match.overall_score - a.match.overall_score);
            }

            setJobs(enrichedJobs);
            if (enrichedJobs.length > 0) {
                toast.success(`Loaded ${enrichedJobs.length} opportunities.`);
            }
        } catch (e) {
            console.error("Failed to fetch jobs:", e);
            toast.error("Failed to fetch jobs.");
        } finally {
            setLoading(false);
        }
    };

    const handleCrawl = async () => {
        setCrawling(true);

        // Personalized Crawl Logic
        let keywords: string[] = ['hiring now'];
        if (profile) {
            const topSkills = profile.skills.slice(0, 3).map(s => s.name);
            const latestRole = profile.experience_atoms?.[0]?.role; // e.g. "Marketing Manager"

            keywords = [];
            if (latestRole) keywords.push(latestRole);
            if (topSkills.length > 0) keywords.push(...topSkills);
        }

        const description = keywords.length > 0 ? `Targeting: ${keywords.slice(0, 2).join(', ')}...` : "Starting global hunt...";
        toast.info(description);

        try {
            const result = await triggerJobCrawl(undefined, keywords);

            if (result.success) {
                toast.success(`Crawl complete! Found ${result.inserted || 0} new jobs`);
                // Refresh the job list - use inline logic to avoid duplicate function
                setLoading(true);
                const rawJobs = await searchJobs();
                const weights = getOptimizedWeights();
                const count = await getJobCount();
                setJobCount(count);

                let enrichedJobs = rawJobs;
                if (profile) {
                    const matches = await Promise.all(
                        rawJobs.map(async (job) => {
                            const match = await calculateMatch(profile, job, weights);
                            return { ...job, match };
                        })
                    );
                    enrichedJobs = matches
                        .filter(j => j.match.overall_score > 0)
                        .sort((a, b) => b.match.overall_score - a.match.overall_score);
                }
                setJobs(enrichedJobs);
                setLoading(false);
            } else {
                toast.error("Crawl failed", { description: result.error });
            }
        } catch (err) {
            toast.error("Crawl error", {
                description: err instanceof Error ? err.message : "Unknown error"
            });
        } finally {
            setCrawling(false);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const rawJobs = await searchJobs();
            const weights = getOptimizedWeights();
            const count = await getJobCount();
            setJobCount(count);

            let enrichedJobs = rawJobs;
            if (profile) {
                const matches = await Promise.all(
                    rawJobs.map(async (job) => {
                        const match = await calculateMatch(profile, job, weights);
                        return { ...job, match };
                    })
                );
                enrichedJobs = matches
                    .filter(j => j.match.overall_score > 0)
                    .sort((a, b) => b.match.overall_score - a.match.overall_score);
            }

            setJobs(enrichedJobs);
            if (enrichedJobs.length > 0) {
                toast.success(`Loaded ${enrichedJobs.length} opportunities.`);
            }
        } catch (e) {
            console.error("Failed to fetch jobs:", e);
            toast.error("Failed to fetch jobs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        const loadJobs = async () => {
            setLoading(true);
            try {
                const rawJobs = await searchJobs();
                if (!isMounted) return;

                const weights = getOptimizedWeights();
                const count = await getJobCount();
                if (!isMounted) return;

                setJobCount(count);

                // If we have a profile, calculate matches
                let enrichedJobs = rawJobs;
                if (profile) {
                    const matches = await Promise.all(
                        rawJobs.map(async (job) => {
                            const match = await calculateMatch(profile, job, weights);
                            return { ...job, match };
                        })
                    );
                    // Filter out 0 scores (banned)
                    enrichedJobs = matches
                        .filter(j => (j.match.overall_score || 0) > 0)
                        .sort((a, b) => (b.match.overall_score || 0) - (a.match.overall_score || 0));
                }

                if (!isMounted) return;
                setJobs(enrichedJobs);
                if (enrichedJobs.length > 0) {
                    toast.success(`Loaded ${enrichedJobs.length} opportunities.`);
                }
            } catch (e) {
                console.error("Failed to fetch jobs:", e);
                if (isMounted) {
                    toast.error("Failed to fetch jobs.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadJobs();

        return () => {
            isMounted = false;
        };
    }, [profile]); // Re-run when profile changes

    return (
        <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-[600px] animate-fade-in">
            <div className="p-6 border-b border-border/50 flex items-center justify-between bg-secondary/10">
                <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-primary" />
                    <div className="flex flex-col">
                        <h2 className="font-semibold tracking-tight leading-none">Job Feed_</h2>
                        <span className="text-[10px] text-muted-foreground font-mono mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Auto-Hunt: <span className="text-primary">ON</span> (Every 6h)
                        </span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono font-normal bg-background/50 ml-2">
                        {jobCount > 0 ? `${jobCount} indexed` : 'LIVE'}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCrawl}
                        disabled={crawling || loading}
                        className="text-xs"
                    >
                        {crawling ? (
                            <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Crawling...
                            </>
                        ) : (
                            <>
                                <Globe className="w-3 h-3 mr-1" />
                                Crawl Jobs
                            </>
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={loading || crawling}
                        className={loading ? "animate-spin" : ""}
                        aria-label="Refresh job list"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 p-0">
                <div className="flex flex-col">
                    {jobs.map((job) => (
                        <div
                            key={job.id}
                            className="group p-6 border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer flex flex-col md:flex-row gap-4 md:items-start"
                        >
                            {/* Match Score Indicator */}
                            {job.match && (
                                <div className="flex flex-col items-center justify-center -ml-2 mr-2">
                                    <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-2
                    ${job.match.overall_score >= 80 ? 'border-green-500 text-green-500 bg-green-500/10' :
                                            job.match.overall_score >= 60 ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
                                                'border-muted text-muted-foreground bg-muted/10'}
                   `}>
                                        {job.match.overall_score}%
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground mt-1 tracking-wider">ATS Match</span>
                                </div>
                            )}

                            <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                                            {job.title}
                                            {job.freshness_score > 0.9 && (
                                                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500 ring-1 ring-inset ring-blue-500/20">
                                                    <Sparkles className="w-3 h-3 mr-1" /> New
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-muted-foreground font-medium">{job.company} • {job.location}</p>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                            onClick={(e) => { e.stopPropagation(); handleDismiss(job); }}
                                            title="Not interested"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                        <p className="font-mono text-sm font-medium">{job.salary_range}</p>
                                        <p className="text-xs text-muted-foreground">{job.posted_at}</p>
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                    {job.description}
                                </p>

                                <div className="flex items-center gap-2 pt-2">
                                    <Badge variant="secondary" className="font-normal text-xs">
                                        Source: {job.source}
                                    </Badge>
                                    {job.match?.reasoning[0] && (
                                        <span className="text-xs text-green-600/80 dark:text-green-400/80 font-medium flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" /> {job.match.reasoning[0]}
                                        </span>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] text-muted-foreground hover:text-primary"
                                        onClick={(e) => { e.stopPropagation(); handleExpandJob(job.id); }}
                                    >
                                        Network Intel
                                    </Button>
                                </div>

                                {/* Stakeholder Intel */}
                                {stakeholders[job.id] && (
                                    <div className="mt-3 bg-background/50 rounded-lg p-3 animate-fade-in border border-border/50">
                                        <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-2 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Hiring Team
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {stakeholders[job.id].map((person: any, i: number) => (
                                                <a
                                                    key={i}
                                                    href={person.profile_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group/person"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                                                            {person.avatar_url?.includes('http') ? (
                                                                <img src={person.avatar_url} alt="icon" className="w-full h-full object-cover rounded-full opacity-80" />
                                                            ) : (
                                                                <Users className="w-4 h-4" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-medium truncate text-foreground group-hover/person:text-primary transition-colors">{person.name}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{person.role}</p>
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-3 h-3 text-muted-foreground group-hover/person:text-primary" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Application Progress Bar */}
                                {activeApplication?.jobId === job.id && (
                                    <div className="mt-3 space-y-1">
                                        <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-300"
                                                style={{ width: `${activeApplication.progress}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-mono">
                                            {activeApplication.logs[activeApplication.logs.length - 1]}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
                                <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleTailor(job); }}>
                                    <PenTool className="w-3 h-3 mr-2" /> Tailor
                                </Button>
                                <Button size="sm" onClick={(e) => { e.stopPropagation(); handleApply(job); }}>
                                    <Send className="w-3 h-3 mr-2" /> Apply
                                </Button>
                                <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setPrepJob(job); }}>
                                    <GraduationCap className="w-3 h-3 mr-1" /> Prep
                                </Button>
                            </div>
                        </div>
                    ))}

                    {jobs.length === 0 && !loading && (
                        <div className="p-12 text-center text-muted-foreground">
                            No jobs found. The hunt continues...
                        </div>
                    )}
                </div>
            </ScrollArea>

            {prepJob && (
                <InterviewPrepModal
                    isOpen={!!prepJob}
                    onClose={() => setPrepJob(null)}
                    job={prepJob}
                />
            )}
        </div>
    );
};

export default JobFeed;
