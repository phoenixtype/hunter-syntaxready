import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CandidateProfile } from "@/lib/resume_engine";
import { EnrichedJob } from "@/hooks/useJobs";
import { generateTailoredContent, TailoredContent } from "@/lib/writer_engine";
import { simulateApplication, ApplicationState, ComplianceError, getApplicationHistory } from "@/lib/application_engine";
import { saveTailoredResume } from "@/lib/tailored_resume_store";
import TailorResultSheet from "./TailorResultSheet";
import { recordFeedback } from "@/lib/learning_engine";
import { ExternalLink, Sparkles, RefreshCw, PenTool, Send, GraduationCap, X, Loader2, Globe, Search, MapPin, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import JobFiltersBar, { JobFilters, DEFAULT_FILTERS, hasActiveFilters } from "./JobFiltersBar";
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { jobs, jobCount, loading, crawling, refreshJobs, crawl } = useJobs(profile, preferences);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [activeApplication, setActiveApplication] = useState<ApplicationState | null>(null);
  const [stakeholders, setStakeholders] = useState<Record<string, Stakeholder[]>>({});
  const [prepJob, setPrepJob] = useState<EnrichedJob | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(new Set());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);
  const [tailorResult, setTailorResult] = useState<{ content: TailoredContent; job: { title: string; company: string } } | null>(null);

  const filteredJobs = useMemo(() => {
    let result = jobs.filter(job => !dismissedJobIds.has(job.id));

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(job =>
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.description.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q)
      );
    }

    // Work mode filter
    if (filters.workMode !== "all") {
      result = result.filter(job => {
        const loc = (job.location || "").toLowerCase();
        const desc = (job.description || "").toLowerCase();
        const combined = loc + " " + desc;
        if (filters.workMode === "remote") return combined.includes("remote");
        if (filters.workMode === "hybrid") return combined.includes("hybrid");
        if (filters.workMode === "onsite") return combined.includes("onsite") || combined.includes("on-site") || combined.includes("in-office") || (!combined.includes("remote") && !combined.includes("hybrid"));
        return true;
      });
    }

    // Experience level filter
    if (filters.experienceLevel !== "all") {
      result = result.filter(job => {
        const text = ((job.title || "") + " " + (job.description || "")).toLowerCase();
        if (filters.experienceLevel === "entry") return text.includes("entry") || text.includes("junior") || text.includes("associate") || text.includes("intern") || text.includes("graduate");
        if (filters.experienceLevel === "mid") return text.includes("mid") || text.includes("intermediate") || (!text.includes("senior") && !text.includes("junior") && !text.includes("lead") && !text.includes("staff") && !text.includes("principal"));
        if (filters.experienceLevel === "senior") return text.includes("senior") || text.includes("sr.");
        if (filters.experienceLevel === "lead") return text.includes("lead") || text.includes("staff") || text.includes("principal") || text.includes("architect") || text.includes("director") || text.includes("manager");
        return true;
      });
    }

    // Salary filter
    if (filters.minSalary > 0) {
      result = result.filter(job => {
        if (!job.salary_range || job.salary_range === "Not specified") return false;
        // Extract numbers from salary string (e.g., "$120k-$150k", "$120,000")
        const nums = job.salary_range.match(/\d[\d,]*/g);
        if (!nums) return false;
        const maxSalary = Math.max(...nums.map(n => {
          const cleaned = parseInt(n.replace(/,/g, ""));
          // If value < 1000 it's probably in "k" notation
          return cleaned < 1000 ? cleaned * 1000 : cleaned;
        }));
        return maxSalary >= filters.minSalary * 1000;
      });
    }

    return result;
  }, [jobs, dismissedJobIds, searchQuery, filters]);

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
    toast.info(`Applying to ${job.company}...`);
    await recordFeedback({
      jobId: job.id, action: 'APPLY', timestamp: Date.now(),
      jobMetadata: { skills: job.tech_stack || [], company: job.company, source: job.source }
    });
    try {
      await simulateApplication(job, (state) => {
        setActiveApplication(state);
        if (state.status === 'applied') {
          toast.success(`Applied to ${job.company}!`);
          setAppliedJobIds(prev => new Set(prev).add(job.id));
          setTimeout(() => setActiveApplication(null), 3000);
        }
      }, user?.id, true);
    } catch (error) {
      if (error instanceof ComplianceError) {
        toast.warning("Blocked by compliance", { description: error.message, duration: 5000 });
      } else {
        toast.error("Application failed. Please try again.");
      }
      setActiveApplication(null);
    }
  };

  const handleDismiss = async (job: EnrichedJob) => {
    setDismissedJobIds(prev => new Set(prev).add(job.id));
    toast("Job dismissed");
    recordFeedback({
      jobId: job.id, action: 'DISMISS', timestamp: Date.now(),
      jobMetadata: { skills: [], company: job.company, source: job.source }
    });
  };

  const handleExpandJob = async (jobId: string) => {
    if (expandedJob === jobId) { setExpandedJob(null); return; }
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
    if (!profile) {
      toast.error("Build your profile first.", { description: "Use the Resume Builder to create your profile before tailoring." });
      return;
    }
    setTailoringJobId(job.id);
    try {
      const content = await generateTailoredContent(profile, job);
      await saveTailoredResume(content, { title: job.title, company: job.company, url: job.url });
      setTailorResult({ content, job: { title: job.title, company: job.company } });
    } catch {
      toast.error("Tailoring failed.");
    } finally {
      setTailoringJobId(null);
    }
  };

  const handleCrawl = () => {
    toast.info(profile ? "Searching for matching roles..." : "Starting job search...");
    const extra = searchQuery.trim() ? searchQuery.trim().split(/\s+/) : undefined;
    crawl(extra);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleCrawl} disabled={crawling || loading} className="h-10 px-4 shrink-0">
          {crawling ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Searching...</> : <><Globe className="w-3.5 h-3.5 mr-1.5" />Find Jobs</>}
        </Button>
        <JobFiltersBar filters={filters} onChange={setFilters} />
        <Button variant="ghost" size="icon" onClick={() => { refreshJobs(); toast.info("Refreshing..."); }} disabled={loading || crawling} className="h-10 w-10 shrink-0">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters(filters) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Active:</span>
          {filters.workMode !== "all" && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
              {filters.workMode}
              <button onClick={() => setFilters(f => ({ ...f, workMode: "all" }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
            </Badge>
          )}
          {filters.experienceLevel !== "all" && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
              {filters.experienceLevel}
              <button onClick={() => setFilters(f => ({ ...f, experienceLevel: "all" }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
            </Badge>
          )}
          {filters.minSalary > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
              ${filters.minSalary}k+
              <button onClick={() => setFilters(f => ({ ...f, minSalary: 0 }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
            </Badge>
          )}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {loading ? 'Loading...' : hasActiveFilters(filters) || searchQuery ? `${filteredJobs.length} of ${jobCount} jobs` : `${jobCount} jobs found`}
      </p>

      {/* Job Cards */}
      <div className="space-y-3">
        {filteredJobs.map((job) => {
          const isExpanded = expandedJob === job.id;
          const isApplied = appliedJobIds.has(job.id);
          const isApplying = activeApplication?.jobId === job.id;

          return (
            <div key={job.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/20 transition-all">
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  {/* Company Initial */}
                  <div className="hidden sm:flex w-10 h-10 rounded-lg bg-muted items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-muted-foreground">{job.company[0]}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{job.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>
                          {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                          {job.match && (
                            <span className="text-primary font-semibold">{job.match.overall_score}% match</span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDismiss(job)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{job.description}</p>

                    {/* Tags */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {job.salary_range && <span className="text-xs font-mono font-medium">{job.salary_range}</span>}
                      <Badge variant="outline" className="text-[10px] font-normal">{job.source}</Badge>
                      {job.freshness_score > 0.9 && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                          <Sparkles className="w-2.5 h-2.5 mr-0.5" /> New
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Button
                        size="sm"
                        variant={isApplied ? "secondary" : "default"}
                        onClick={() => handleApply(job)}
                        disabled={isApplied || isApplying}
                        className="h-8 text-xs"
                      >
                        {isApplied ? <><Send className="w-3 h-3 mr-1.5" />Applied</> : isApplying ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Applying...</> : <><Send className="w-3 h-3 mr-1.5" />Apply</>}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTailor(job)}
                        disabled={tailoringJobId === job.id}
                        className="h-8 text-xs"
                      >
                        {tailoringJobId === job.id
                          ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Tailoring...</>
                          : <><PenTool className="w-3 h-3 mr-1.5" />Tailor</>
                        }
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/interview-coach?title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}&desc=${encodeURIComponent(job.description?.substring(0, 500) || '')}`)} className="h-8 text-xs">
                        <GraduationCap className="w-3 h-3 mr-1.5" />Prep
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleExpandJob(job.id)} className="h-8 text-xs ml-auto">
                        {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                        Intel
                      </Button>
                      {job.url && (
                        <a href={job.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="w-3.5 h-3.5" /></Button>
                        </a>
                      )}
                    </div>

                    {/* Apply progress */}
                    {isApplying && activeApplication && (
                      <div className="mt-3 space-y-1">
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
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

              {/* Intel Section */}
              {isExpanded && (
                <div className="border-t border-border p-4 bg-muted/30 animate-fade-in">
                  <h4 className="text-[10px] uppercase font-bold text-muted-foreground mb-3">Hiring Team</h4>
                  {stakeholders[job.id] ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stakeholders[job.id].map((person, i) => (
                        <a key={i} href={person.profile_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-accent transition-colors border border-border">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
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
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty */}
        {filteredJobs.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            {!profile ? (
              <div className="max-w-xs space-y-2">
                <h3 className="font-semibold">Build your profile to start</h3>
                <p className="text-sm text-muted-foreground">Complete onboarding or use the Resume Builder so Hunter can find matching jobs.</p>
              </div>
            ) : !preferences?.target_roles?.length ? (
              <div className="max-w-xs space-y-2">
                <h3 className="font-semibold">Set your preferences</h3>
                <p className="text-sm text-muted-foreground">Add target roles and locations to start finding jobs.</p>
              </div>
            ) : (
              <div className="max-w-xs space-y-2">
                <h3 className="font-semibold">No jobs found yet</h3>
                <p className="text-sm text-muted-foreground">Click below to search for matching roles.</p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleCrawl} disabled={crawling || !profile} className="mt-4">
              {crawling ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Searching...</> : <><Globe className="w-3 h-3 mr-1.5" />Find Jobs</>}
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {prepJob && <InterviewPrepModal isOpen={!!prepJob} onClose={() => setPrepJob(null)} job={prepJob} />}

      <TailorResultSheet
        open={!!tailorResult}
        onClose={() => setTailorResult(null)}
        content={tailorResult?.content ?? null}
        job={tailorResult?.job ?? null}
      />
    </div>
  );
};

export default JobFeed;
