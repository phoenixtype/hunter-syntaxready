import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JobOpportunity } from "@/lib/crawler_engine";
import { CandidateProfile } from "@/lib/resume_engine";
import { EnrichedJob } from "@/hooks/useJobs";
import { generateTailoredContent, TailoredContent } from "@/lib/writer_engine";
import { simulateApplication, ApplicationState, ComplianceError, getApplicationHistory } from "@/lib/application_engine";
import { recordFeedback, getOptimizedWeights, MatchingWeights } from "@/lib/learning_engine";
import { ExternalLink, Sparkles, RefreshCw, Terminal, PenTool, Send, Check, GraduationCap, X, Loader2, Globe, Zap, Clock, Users, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import InterviewPrepModal from "./InterviewPrep";
import { useAuth } from "@/hooks/useAuth";
import { Stakeholder } from "@/lib/recruiter_engine";

interface JobFeedProps {
    profile: CandidateProfile | null;
}

import { useJobs } from "@/hooks/useJobs";

const JobFeed = ({ profile }: JobFeedProps) => {
    const { user } = useAuth();
    const { jobs, jobCount, loading, crawling, refreshJobs, crawl } = useJobs(profile);
    const [activeApplication, setActiveApplication] = useState<ApplicationState | null>(null);
    const [stakeholders, setStakeholders] = useState<Record<string, Stakeholder[]>>({});
    const [prepJob, setPrepJob] = useState<EnrichedJob | null>(null);
    const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

    // Senior Dev Fix: Prevent duplicate applications
    useEffect(() => {
        if (!user) return;
        getApplicationHistory(user.id).then(history => {
            setAppliedJobIds(new Set(history.map(h => h.job_id)));
        });
    }, [user]);

    const handleApply = async (job: EnrichedJob) => {
        if (appliedJobIds.has(job.id)) {
            toast.error("You have already applied to this position.");
            return;
        }

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
                    setAppliedJobIds(prev => new Set(prev).add(job.id));
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
                toast.error("Application process interrupted. Please try again.");
            }
            setActiveApplication(null);
        }
    };

    const handleDismiss = async (job: EnrichedJob) => {
        // Optimistic update should be handled by cache invalidation in real app, but for now specific hook handling is better
        // The implementation here matches the original UX visually
        // ideally we'd call a mutation in useJobs but for now just removing from UI via toast and refresh
        await recordFeedback({
            jobId: job.id,
            action: 'DISMISS',
            timestamp: Date.now(),
            jobMetadata: { skills: [], company: job.company, source: job.source }
        });
        toast("Job dismissed", { description: "Hunter will show fewer jobs like this." });
        refreshJobs();
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

    const handleTailor = async (job: EnrichedJob) => {
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

    const handleCrawl = () => {
        toast.info(profile ? "Targeting your skills..." : "Starting global hunt...");
        crawl();
    };

    const handleRefresh = () => {
        refreshJobs();
        toast.info("Refreshing opportunities...");
    };

    return (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{jobCount > 0 ? `${jobCount} jobs found` : 'Finding jobs...'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCrawl}
                        disabled={crawling || loading}
                        className="text-xs h-7"
                    >
                        {crawling ? (
                            <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Searching...
                            </>
                        ) : (
                            <>
                                <Globe className="w-3 h-3 mr-1" />
                                Find More
                            </>
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={loading || crawling}
                        className={`h-7 w-7 ${loading ? "animate-spin" : ""}`}
                        aria-label="Refresh"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1 p-0">
                <div className="flex flex-col">
                    {jobs.map((job) => (
                        <div
                            key={job.id}
                            className="group p-4 border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer flex gap-3">

                            {/* Match Score */}
                            {job.match && (
                                <div className="flex flex-col items-center justify-center mr-3">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs border
                                        ${job.match.overall_score >= 80 ? 'border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10' :
                                            job.match.overall_score >= 60 ? 'border-yellow-500/50 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10' :
                                                'border-border text-muted-foreground bg-muted/50'}
                                    `}>
                                        {job.match.overall_score}%
                                    </div>
                                    <span className="text-[9px] text-muted-foreground mt-0.5">match</span>
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
                                            {stakeholders[job.id].map((person, i: number) => (
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

                            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 self-center shrink-0 translate-x-2 group-hover:translate-x-0">
                                <Button variant="secondary" size="sm" className="button-glow" onClick={(e) => { e.stopPropagation(); handleTailor(job); }}>
                                    <PenTool className="w-3 h-3 mr-2" /> Tailor
                                </Button>
                                <Button size="sm" variant="gradient" onClick={(e) => { e.stopPropagation(); handleApply(job); }} disabled={appliedJobIds.has(job.id)}>
                                    <Send className="w-3 h-3 mr-2" /> {appliedJobIds.has(job.id) ? "Applied" : "Apply"}
                                </Button>
                                <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setPrepJob(job); }}>
                                    <GraduationCap className="w-3 h-3 mr-1" /> Prep
                                </Button>
                            </div>
                        </div>
                    ))}

                    {jobs.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-2">
                                <Search className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div className="max-w-xs space-y-2">
                                <h3 className="font-semibold text-lg">No jobs found yet</h3>
                                <p className="text-sm text-muted-foreground">
                                    We couldn't find any matches. Try broadening your search or updating your profile skills.
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleCrawl}
                                disabled={crawling}
                                className="mt-4"
                            >
                                {crawling ? (
                                    <>
                                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                        Searching Wide...
                                    </>
                                ) : (
                                    <>
                                        <Globe className="w-3 h-3 mr-2" />
                                        Broaden Search
                                    </>
                                )}
                            </Button>
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
