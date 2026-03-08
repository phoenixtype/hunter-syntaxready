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
import { ExternalLink, Sparkles, RefreshCw, Loader2, Globe, Search, MapPin, Building2, X, Bookmark } from "lucide-react";
import SalaryInsights from "./SalaryInsights";
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import JobFiltersBar, { JobFilters, DEFAULT_FILTERS, hasActiveFilters } from "./JobFiltersBar";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Stakeholder } from "@/lib/recruiter_engine";
import { useJobs } from "@/hooks/useJobs";
import { UserPreferences } from "@/lib/user_preferences";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useSubscription } from "@/hooks/useSubscription";
import PricingModal from "./PricingModal";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import MatchScoreTooltip from "./MatchScoreTooltip";
import JobCardActions from "./JobCardActions";

interface JobFeedProps {
  profile: CandidateProfile | null;
  preferences?: UserPreferences | null;
}

const JobFeed = ({ profile, preferences }: JobFeedProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const { jobs, jobCount, filteredJobCount, loading, crawling, refreshJobs, crawl, page: currentPage, setPage, totalPages } = useJobs(profile, preferences, searchQuery, locationQuery);
  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [activeApplication, setActiveApplication] = useState<ApplicationState | null>(null);
  const [stakeholders, setStakeholders] = useState<Record<string, Stakeholder[]>>({});
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("hunter_dismissed_jobs");
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);
  const [tailorResult, setTailorResult] = useState<{ content: TailoredContent; job: { title: string; company: string } } | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  
  const { subscription } = useSubscription();
  const [showPricingModal, setShowPricingModal] = useState(false);
  const { toggleSave, isSaved, savedCount } = useSavedJobs();

  const filteredJobs = useMemo(() => {
    let result = jobs.filter(job => !dismissedJobIds.has(job.id));

    // Saved filter
    if (showSavedOnly) {
      result = result.filter(job => isSaved(job.id));
    }

    if (filters.workMode !== "all") {
      result = result.filter(job => {
        const combined = ((job.location || "") + " " + (job.description || "")).toLowerCase();
        if (filters.workMode === "remote") return job.location?.toLowerCase().includes("remote") || combined.includes("remote");
        if (filters.workMode === "hybrid") return combined.includes("hybrid");
        if (filters.workMode === "onsite") return (
          combined.includes("on-site") || combined.includes("onsite") ||
          combined.includes("in-office") || combined.includes("in office") ||
          combined.includes("on site") ||
          (!combined.includes("remote") && !combined.includes("hybrid") && job.location !== "Remote")
        );
        return true;
      });
    }

    if (filters.experienceLevel !== "all") {
      result = result.filter(job => {
        const text = ((job.title || "") + " " + (job.description || "")).toLowerCase();
        if (filters.experienceLevel === "entry") return text.includes("entry") || text.includes("junior") || text.includes("associate") || text.includes("intern");
        if (filters.experienceLevel === "mid") return !text.includes("senior") && !text.includes("junior") && !text.includes("lead") && !text.includes("staff");
        if (filters.experienceLevel === "senior") return text.includes("senior") || text.includes("sr.");
        if (filters.experienceLevel === "lead") return text.includes("lead") || text.includes("staff") || text.includes("principal") || text.includes("director");
        return true;
      });
    }

    if (filters.minSalary > 0) {
      result = result.filter(job => {
        if (!job.salary_range || job.salary_range === "Not specified") return false;
        const nums = job.salary_range.match(/\d[\d,]*/g);
        if (!nums) return false;
        const maxSalary = Math.max(...nums.map(n => {
          const cleaned = parseInt(n.replace(/,/g, ""));
          return cleaned < 1000 ? cleaned * 1000 : cleaned;
        }));
        return maxSalary >= filters.minSalary * 1000;
      });
    }

    if (filters.jobType !== "all") {
      result = result.filter(job => {
        const text = ((job.title || "") + " " + (job.description || "")).toLowerCase();
        if (filters.jobType === "contract") return text.includes("contract") || text.includes("freelance") || text.includes("consulting") || text.includes("c2c") || text.includes("1099") || text.includes("temp");
        if (filters.jobType === "fulltime") return text.includes("full-time") || text.includes("full time") || text.includes("fulltime") || text.includes("permanent") || (!text.includes("contract") && !text.includes("part-time") && !text.includes("freelance"));
        if (filters.jobType === "parttime") return text.includes("part-time") || text.includes("part time") || text.includes("parttime");
        return true;
      });
    }

    if (filters.datePosted !== "all") {
      const now = Date.now();
      const cutoffs: Record<string, number> = {
        "24h": now - 24 * 60 * 60 * 1000,
        "week": now - 7 * 24 * 60 * 60 * 1000,
        "month": now - 30 * 24 * 60 * 60 * 1000,
      };
      const cutoff = cutoffs[filters.datePosted];
      result = result.filter(job => {
        if (!job.posted_at) return filters.datePosted === "month";
        const postedTime = new Date(job.posted_at).getTime();
        return !isNaN(postedTime) && postedTime >= cutoff;
      });
    }

    return result;
  }, [jobs, dismissedJobIds, searchQuery, filters, showSavedOnly, isSaved]);

  useEffect(() => {
    if (!user) return;
    getApplicationHistory(user.id).then(history => {
      setAppliedJobIds(new Set(history.map(h => h.job_id)));
    });
  }, [user]);

  const handleApply = async (job: EnrichedJob) => {
    if (subscription && subscription.usage.applications_this_month >= subscription.usage.applications_limit) {
      toast.error("Application Limit Reached", { description: "Upgrade to Pro for unlimited applications." });
      setShowPricingModal(true);
      return;
    }
    if (appliedJobIds.has(job.id)) { toast.error("You have already applied to this position."); return; }
    toast.info(`Applying to ${job.company}...`);
    await recordFeedback({ jobId: job.id, action: 'APPLY', timestamp: Date.now(), jobMetadata: { skills: job.tech_stack || [], company: job.company, source: job.source } });
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
    setDismissedJobIds(prev => {
      const next = new Set(prev).add(job.id);
      try { localStorage.setItem("hunter_dismissed_jobs", JSON.stringify([...next])); } catch { /* ignore quota */ }
      return next;
    });
    toast("Job hidden", { description: "It won't show again on this device." });
    recordFeedback({ jobId: job.id, action: 'DISMISS', timestamp: Date.now(), jobMetadata: { skills: [], company: job.company, source: job.source } });
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
    if (subscription && subscription.usage.applications_this_month >= subscription.usage.applications_limit) {
      toast.error("Application Limit Reached", { description: "Upgrade to Pro for unlimited applications." });
      setShowPricingModal(true);
      return;
    }
    if (!profile) { toast.error("Build your profile first."); return; }
    setTailoringJobId(job.id);
    try {
      const content = await generateTailoredContent(profile, job);
      await saveTailoredResume(content, { title: job.title, company: job.company, url: job.url });
      setTailorResult({ content, job: { title: job.title, company: job.company } });
    } catch {
      toast.error("Tailoring failed", { description: "Try again — this is usually a temporary issue.", action: { label: "Retry", onClick: () => handleTailor(job) } });
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
      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex flex-col sm:flex-row flex-1 gap-2">
          <div className="relative flex-[2]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search jobs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 sm:h-11 text-base sm:text-sm" />
          </div>
          <div className="relative flex-1">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Location..." value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} className="pl-10 h-12 sm:h-11 text-base sm:text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCrawl} disabled={crawling || loading} className="flex-1 sm:flex-none h-12 sm:h-11 px-4 shrink-0 gap-1.5 font-semibold sm:font-medium">
            {crawling ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Searching...</> : <><Globe className="w-3.5 h-3.5" />Find Jobs</>}
          </Button>
          <JobFiltersBar filters={filters} onChange={setFilters} />
          {/* Saved filter toggle */}
          <Button
            variant={showSavedOnly ? "default" : "ghost"}
            size="icon"
            onClick={() => setShowSavedOnly(!showSavedOnly)}
            className="h-12 w-12 sm:h-11 sm:w-11 shrink-0 relative"
            title={showSavedOnly ? "Show all jobs" : "Show saved jobs"}
          >
            <Bookmark className={`w-4 h-4 ${showSavedOnly ? "fill-current" : ""}`} />
            {savedCount > 0 && !showSavedOnly && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {savedCount > 9 ? "9+" : savedCount}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { refreshJobs(); toast.info("Refreshing..."); }} disabled={loading || crawling} className="h-12 w-12 sm:h-11 sm:w-11 shrink-0 bg-muted/30">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Active filter badges */}
      {(hasActiveFilters(filters) || showSavedOnly) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Active:</span>
          {showSavedOnly && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
              Saved ({savedCount})
              <button onClick={() => setShowSavedOnly(false)} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
            </Badge>
          )}
          {filters.workMode !== "all" && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">{filters.workMode}<button onClick={() => setFilters(f => ({ ...f, workMode: "all" }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button></Badge>
          )}
          {filters.experienceLevel !== "all" && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">{filters.experienceLevel}<button onClick={() => setFilters(f => ({ ...f, experienceLevel: "all" }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button></Badge>
          )}
          {filters.minSalary > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">${filters.minSalary}k+<button onClick={() => setFilters(f => ({ ...f, minSalary: 0 }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button></Badge>
          )}
          {filters.datePosted !== "all" && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
              {filters.datePosted === "24h" ? "Last 24h" : filters.datePosted === "week" ? "This week" : "This month"}
              <button onClick={() => setFilters(f => ({ ...f, datePosted: "all" }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
            </Badge>
          )}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {loading
          ? 'Loading...'
          : showSavedOnly
            ? `${filteredJobs.length} saved job${filteredJobs.length !== 1 ? 's' : ''}`
            : hasActiveFilters(filters) || searchQuery
              ? `${filteredJobs.length} of ${filteredJobCount} jobs`
              : filteredJobCount > 0
                ? `${filteredJobCount} jobs found`
                : jobCount > 0
                  ? `0 jobs matching your preferences (${jobCount} total in database — click Find Jobs)`
                  : 'No jobs yet — click Find Jobs to search'}
      </p>

      {/* Job Cards */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
        {filteredJobs.map((job, idx) => {
          const isExpanded = expandedJob === job.id;
          const isApplied = appliedJobIds.has(job.id);
          const isApplying = activeApplication?.jobId === job.id;
          const jobSaved = isSaved(job.id);

          return (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.2) }}
              className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
            >
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary/10 items-center justify-center shrink-0 border border-primary/10">
                    <span className="text-sm font-bold text-primary">{job.company[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[15px] sm:text-base leading-snug line-clamp-2">{job.title}</h3>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3 shrink-0" />{job.company}</span>
                          {job.location && <span className="flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-none"><MapPin className="w-3 h-3 shrink-0" />{job.location}</span>}
                          {job.match && (
                            <MatchScoreTooltip match={job.match}>
                              <span className={`inline-flex items-center font-semibold text-[11px] px-1.5 py-0.5 rounded-full border cursor-help ${
                                job.match.overall_score >= 70
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : job.match.overall_score >= 40
                                  ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {job.match.overall_score}% match
                              </span>
                            </MatchScoreTooltip>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Bookmark */}
                        <button
                          onClick={() => {
                            toggleSave(job.id);
                            toast(jobSaved ? "Removed from saved" : "Saved to bookmarks");
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            jobSaved
                              ? "text-primary bg-primary/10"
                              : "text-muted-foreground/60 hover:text-primary hover:bg-primary/5"
                          }`}
                          title={jobSaved ? "Remove bookmark" : "Save job"}
                        >
                          <Bookmark className={`w-4 h-4 ${jobSaved ? "fill-current" : ""}`} />
                        </button>
                        {/* Dismiss */}
                        <button
                          onClick={() => handleDismiss(job)}
                          className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 transition-colors"
                          title="Dismiss job"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mt-2.5 line-clamp-2 leading-relaxed">{job.description}</p>

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {job.salary_range ? (
                        <span className="text-xs font-mono font-semibold text-foreground/80 bg-muted px-2 py-0.5 rounded-md">{job.salary_range}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 italic">Salary not listed</span>
                      )}
                      <SalaryInsights
                        jobTitle={job.title}
                        company={job.company}
                        location={job.location}
                        salaryRange={job.salary_range}
                        description={job.description}
                      />
                      <Badge variant="outline" className="text-[10px] font-medium rounded-full">{job.source}</Badge>
                      {job.freshness_score > 0.9 && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-full gap-0.5"><Sparkles className="w-2.5 h-2.5" /> New</Badge>
                      )}
                    </div>

                    {/* Simplified actions */}
                    <JobCardActions
                      isApplied={isApplied}
                      isApplying={isApplying}
                      isTailoring={tailoringJobId === job.id}
                      jobUrl={job.url || "#"}
                      onApply={() => handleApply(job)}
                      onTailor={() => handleTailor(job)}
                      onPrep={() => navigate(`/interview-coach?title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.company)}&desc=${encodeURIComponent(job.description?.substring(0, 500) || '')}`)}
                      onIntel={() => handleExpandJob(job.id)}
                      isExpanded={isExpanded}
                    />

                    {isApplying && activeApplication && (
                      <div className="mt-3 space-y-1">
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${activeApplication.progress}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">{activeApplication.logs[activeApplication.logs.length - 1]}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-4 sm:p-5 bg-muted/20 animate-fade-in">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-3">Hiring Team</p>
                  {stakeholders[job.id] ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stakeholders[job.id].map((person, i) => (
                        <a key={i} href={person.profile_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-accent/60 transition-colors border border-border/60">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0 border border-primary/10">{person.name?.[0] || '?'}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{person.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{person.role}</p>
                          </div>
                          <ExternalLink className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding hiring team...</div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="pt-6 pb-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(Math.max(1, currentPage - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
                    return (
                      <PaginationItem key={p}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === p}
                          onClick={(e) => { e.preventDefault(); setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                  if ((p === 2 && currentPage > 3) || (p === totalPages - 1 && currentPage < totalPages - 2)) {
                    return <PaginationItem key={p}><PaginationEllipsis /></PaginationItem>;
                  }
                  return null;
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, currentPage + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Empty */}
        {filteredJobs.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl bg-muted/20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
              {showSavedOnly ? <Bookmark className="w-7 h-7 text-muted-foreground/60" /> : <Search className="w-7 h-7 text-muted-foreground/60" />}
            </div>
            {showSavedOnly ? (
              <div className="max-w-[260px] space-y-2">
                <h3 className="font-semibold text-base">No saved jobs yet</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Click the bookmark icon on any job card to save it for later.</p>
                <Button variant="outline" size="sm" onClick={() => setShowSavedOnly(false)} className="mt-3">Show all jobs</Button>
              </div>
            ) : !profile ? (
              <div className="max-w-[260px] space-y-2">
                <h3 className="font-semibold text-base">Build your profile first</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Complete onboarding so Hunter can find matching jobs for you.</p>
              </div>
            ) : !preferences?.target_roles?.length ? (
              <div className="max-w-[260px] space-y-2">
                <h3 className="font-semibold text-base">Set your preferences</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Add target roles and locations to start finding jobs.</p>
              </div>
            ) : jobCount > 0 && filteredJobCount === 0 ? (
              <div className="max-w-[280px] space-y-2">
                <h3 className="font-semibold text-base">No jobs match your preferences</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">There are {jobCount} jobs in the database but none match. Click Find Jobs to fetch fresh ones.</p>
              </div>
            ) : (
              <div className="max-w-[260px] space-y-2">
                <h3 className="font-semibold text-base">No jobs found yet</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Click below to search for matching roles based on your profile.</p>
              </div>
            )}
            {(hasActiveFilters(filters) || searchQuery || locationQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFilters(DEFAULT_FILTERS); setSearchQuery(""); setLocationQuery(""); }}
                className="mt-3"
              >
                Clear all filters
              </Button>
            )}
            {!showSavedOnly && (
              <Button size="sm" onClick={handleCrawl} disabled={crawling || !profile} className="mt-5 gap-1.5 px-5">
                {crawling ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Searching...</> : <><Globe className="w-3.5 h-3.5" />Find Jobs</>}
              </Button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
            <p className="text-xs text-muted-foreground">Loading jobs...</p>
          </div>
        )}
      </div>

      <TailorResultSheet
        open={!!tailorResult}
        onClose={() => setTailorResult(null)}
        content={tailorResult?.content ?? null}
        job={tailorResult?.job ?? null}
      />
      
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />
    </div>
  );
};

export default JobFeed;
