import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CandidateProfile } from "@/lib/resume_engine";
import { EnrichedJob } from "@/hooks/useJobs";
import { generateTailoredContent } from "@/lib/writer_engine";
import { simulateApplication, ApplicationState, ComplianceError, getApplicationHistory } from "@/lib/application_engine";
import { recordFeedback } from "@/lib/learning_engine";
import { ExternalLink, Sparkles, RefreshCw, PenTool, Send, GraduationCap, X, Loader2, Globe, Search, MapPin, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import InterviewPrepModal from "./InterviewPrep";
import { useAuth } from "@/hooks/useAuth";
import { Stakeholder } from "@/lib/recruiter_engine";
import { useJobs } from "@/hooks/useJobs";
import { UserPreferences } from "@/lib/user_preferences";

interface JobFeedProps {
  profile: CandidateProfile | null;
  preferences?: UserPreferences | null;
}

const JobFeed = ({ profile, preferences }: JobFeedProps) => {
  const { user } = useAuth();
  const { jobs, jobCount, loading, crawling, refreshJobs, crawl } = useJobs(profile, preferences);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeApplication, setActiveApplication] = useState<ApplicationState | null>(null);
  const [stakeholders, setStakeholders] = useState<Record<string, Stakeholder[]>>({});
  const [prepJob, setPrepJob] = useState<EnrichedJob | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Client-side search filtering
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const q = searchQuery.toLowerCase();
    return jobs.filter(job =>
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.description.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q)
    );
  }, [jobs, searchQuery]);

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
      jobMetadata: { skills: job.tech_stack || [], company: job.company, source: job.source }
    });

    try {
      await simulateApplication(job, (state) => {
        setActiveApplication(state);
        if (state.status === 'applied') {
          toast.success(`Application sent to ${job.company}!`);
          setAppliedJobIds(prev => new Set(prev).add(job.id));
          setTimeout(() => setActiveApplication(null), 3000);
        }
      }, user?.id, true);
    } catch (error) {
      if (error instanceof ComplianceError) {
        toast.warning("Application Blocked by Compliance Agent", {
          description: error.message, duration: 5000
        });
      } else {
        console.error("Application error:", error);
        toast.error("Application process interrupted. Please try again.");
      }
      setActiveApplication(null);
    }
  };

  const handleDismiss = async (job: EnrichedJob) => {
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
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);
    if (!stakeholders[jobId]) {
      const job = jobs.find(j => j.id === jobId);
      if (job) {
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
      toast.success("Resume optimized for role.", { description: content.changes_summary[0] });
    } catch {
      toast.error("Tailoring failed.");
    }
  };

  const handleCrawl = () => {
    toast.info(profile ? "Targeting your skills..." : "Starting global hunt...");
    // Pass search bar terms as extra keywords to supplement profile data
    const extra = searchQuery.trim() ? searchQuery.trim().split(/\s+/) : undefined;
    crawl(extra);
  };

  const getScoreColor = (_score: number) => {
    return "text-foreground bg-secondary border-border";
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs by title, company, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleCrawl} disabled={crawling || loading} className="text-xs h-9 shrink-0">
            {crawling ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Searching...</>
            ) : (
              <><Globe className="w-3 h-3 mr-1.5" />Find More</>
            )}
          </Button>
        <Button variant="ghost" size="icon" onClick={() => { refreshJobs(); toast.info("Refreshing..."); }} disabled={loading || crawling} className="h-9 w-9 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {loading ? 'Loading...' : searchQuery ? `${filteredJobs.length} of ${jobCount} jobs` : `${jobCount} jobs found`}
        </span>
      </div>

      {/* Job Cards */}
      <div className="space-y-3">
        {filteredJobs.map((job) => {
          const isExpanded = expandedJob === job.id;
          const isApplied = appliedJobIds.has(job.id);
          const isApplying = activeApplication?.jobId === job.id;

          return (
            <div
              key={job.id}
              className="rounded-xl border border-border/50 bg-card overflow-hidden transition-all duration-200 hover:border-border hover:shadow-sm"
            >
              {/* Main card content */}
              <div className="p-4 sm:p-5">
                <div className="flex gap-3 sm:gap-4">
                  {/* Match Score */}
                  {job.match && (
                    <div className="hidden sm:flex flex-col items-center justify-start pt-0.5">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold text-xs border ${getScoreColor(job.match.overall_score)}`}>
                        {job.match.overall_score}%
                      </div>
                    </div>
                  )}

                  {/* Job Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{job.title}</h3>
                          {job.freshness_score > 0.9 && (
                            <Badge variant="secondary" className="text-[10px]">
                              <Sparkles className="w-2.5 h-2.5 mr-0.5" /> New
                            </Badge>
                          )}
                          {/* Mobile match score */}
                          {job.match && (
                            <span className={`sm:hidden text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${getScoreColor(job.match.overall_score)}`}>
                              {job.match.overall_score}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />{job.company}
                          </span>
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{job.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dismiss */}
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDismiss(job)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Description preview */}
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {job.salary_range && (
                        <span className="text-xs font-mono font-medium text-foreground">{job.salary_range}</span>
                      )}
                      <Badge variant="outline" className="text-[10px] font-normal">{job.source}</Badge>
                      {job.match?.reasoning[0] && (
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> {job.match.reasoning[0]}
                        </span>
                      )}
                    </div>

                    {/* Action buttons - always visible */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Button
                        size="sm"
                        variant={isApplied ? "secondary" : "default"}
                        onClick={() => handleApply(job)}
                        disabled={isApplied || isApplying}
                        className="h-8 text-xs"
                      >
                        {isApplied ? (
                          <><Send className="w-3 h-3 mr-1.5" />Applied</>
                        ) : isApplying ? (
                          <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Applying...</>
                        ) : (
                          <><Send className="w-3 h-3 mr-1.5" />Quick Apply</>
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleTailor(job)} className="h-8 text-xs">
                        <PenTool className="w-3 h-3 mr-1.5" />Tailor
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPrepJob(job)} className="h-8 text-xs">
                        <GraduationCap className="w-3 h-3 mr-1.5" />Prep
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleExpandJob(job.id)} className="h-8 text-xs ml-auto">
                        {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                        Intel
                      </Button>
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                    </div>

                    {/* Application Progress */}
                    {isApplying && activeApplication && (
                      <div className="mt-3 space-y-1">
                        <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${activeApplication.progress}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {activeApplication.logs[activeApplication.logs.length - 1]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Intel Section */}
              {isExpanded && (
                <div className="border-t border-border/50 p-4 bg-secondary/20 animate-fade-in">
                  <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground" /> Hiring Team Intel
                  </h4>
                  {stakeholders[job.id] ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stakeholders[job.id].map((person, i) => (
                        <a
                          key={i}
                          href={person.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2.5 rounded-lg bg-card hover:bg-card/80 transition-colors border border-border/50"
                        >
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-foreground text-xs font-bold shrink-0">
                            {person.name?.[0] || '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{person.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{person.role}</p>
                          </div>
                          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading network data...
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {filteredJobs.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 border border-dashed border-border/50 rounded-xl">
            <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="max-w-xs space-y-1.5">
              <h3 className="font-semibold">No jobs found yet</h3>
              <p className="text-sm text-muted-foreground">
                Try broadening your search or updating your profile skills.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCrawl} disabled={crawling}>
              {crawling ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Searching...</> : <><Globe className="w-3 h-3 mr-1.5" />Find Jobs</>}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {prepJob && (
        <InterviewPrepModal isOpen={!!prepJob} onClose={() => setPrepJob(null)} job={prepJob} />
      )}
    </div>
  );
};

export default JobFeed;
