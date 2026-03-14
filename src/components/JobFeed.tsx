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
import { ExternalLink, Sparkles, RefreshCw, Loader2, Globe, Search, MapPin, Building2, X, Bookmark, Link, ChevronDown, ChevronUp, Cpu, Newspaper, Users, Lightbulb } from "lucide-react";
import { researchCompany, crawlCareersPage, CompanyResearch } from "@/lib/crawler_engine";
import SalaryInsights from "./SalaryInsights";
import { useEffect, useState, useMemo } from "react";
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
  const [careersUrl, setCareersUrl] = useState("");
  const [showCareersImport, setShowCareersImport] = useState(false);
  const [importingCareers, setImportingCareers] = useState(false);
  const [companyResearch, setCompanyResearch] = useState<Record<string, CompanyResearch | null>>({});
  const [researchingJobId, setResearchingJobId] = useState<string | null>(null);

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
        if (filters.experienceLevel === "intern") return text.includes("intern") || text.includes("co-op") || text.includes("coop") || text.includes("student") || text.includes("new grad") || text.includes("graduate program") || text.includes("entry level");
        if (filters.experienceLevel === "entry") return text.includes("entry") || text.includes("junior") || text.includes("associate") || text.includes("new grad");
        if (filters.experienceLevel === "mid") return !text.includes("senior") && !text.includes("junior") && !text.includes("lead") && !text.includes("staff") && !text.includes("intern");
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
        if (filters.jobType === "internship") return text.includes("intern") || text.includes("co-op") || text.includes("coop") || text.includes("student") || text.includes("graduate");
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
  }, [jobs, dismissedJobIds, filters, showSavedOnly, isSaved]);

  useEffect(() => {
    if (!user) return;
    getApplicationHistory(user.id).then(history => {
      setAppliedJobIds(new Set(history.map(h => h.job_id)));
    });
  }, [user]);

  const handleApply = async (job: EnrichedJob) => {
    if (appliedJobIds.has(job.id)) { 
      // Do nothing, let the <a> tag handle navigation to the job URL
      return; 
    }
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
    if (!profile) { toast.error("Build your profile first."); return; }
    setTailoringJobId(job.id);
    const toastId = toast.loading("Tailoring resume…", { description: `Optimizing for ${job.title} at ${job.company}` });
    try {
      const content = await generateTailoredContent(profile, job);
      await saveTailoredResume(content, { title: job.title, company: job.company, url: job.url });
      setTailorResult({ content, job: { title: job.title, company: job.company } });
      toast.success("Resume tailored!", { id: toastId, description: "Your optimized resume is ready." });
    } catch {
      toast.error("Tailoring failed", { id: toastId, description: "Try again — this is usually a temporary issue.", action: { label: "Retry", onClick: () => handleTailor(job) } });
    } finally {
      setTailoringJobId(null);
    }
  };

  const handleCareersImport = async () => {
    const url = careersUrl.trim();
    if (!url) { toast.error("Enter a careers page URL"); return; }
    setImportingCareers(true);
    const toastId = toast.loading("Scanning careers page…", { description: url });
    try {
      const result = await crawlCareersPage(url);
      if (result.total > 0) {
        toast.success(`Imported ${result.total} job${result.total !== 1 ? 's' : ''}`, { id: toastId, description: "Refreshing your feed…" });
        setCareersUrl("");
        setShowCareersImport(false);
        refreshJobs();
      } else {
        toast.warning("No jobs found", { id: toastId, description: "The page may require login or the URL may not be a careers listing." });
      }
    } catch {
      toast.error("Import failed", { id: toastId });
    } finally {
      setImportingCareers(false);
    }
  };

  const handleResearchCompany = async (job: EnrichedJob) => {
    if (companyResearch[job.id] !== undefined) return; // already fetched or fetching
    setResearchingJobId(job.id);
    const research = await researchCompany(job.company, job.title);
    setCompanyResearch(prev => ({ ...prev, [job.id]: research }));
    setResearchingJobId(null);
  };

  const handleCrawl = () => {
    toast.info(profile ? "Searching for matching roles..." : "Starting job search...");
    const searchTerms = searchQuery.trim() ? searchQuery.trim().split(/\s+/) : [];
    // Automatically inject "internship" keyword for intern-level users
    if (preferences?.experience_level === "intern" && !searchTerms.some(t => t.toLowerCase().includes("intern"))) {
      searchTerms.push("internship");
    }
    crawl(searchTerms.length > 0 ? searchTerms : undefined);
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

      {/* Careers page import */}
      <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
        <button
          onClick={() => setShowCareersImport(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5" />Import from careers page</span>
          {showCareersImport ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showCareersImport && (
          <div className="px-3 pb-3 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="https://company.com/careers"
                value={careersUrl}
                onChange={e => setCareersUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCareersImport()}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={handleCareersImport}
              disabled={importingCareers || !careersUrl.trim()}
              className="h-9 gap-1.5 shrink-0"
            >
              {importingCareers ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Scanning…</> : <><Sparkles className="w-3.5 h-3.5" />Import Jobs</>}
            </Button>
          </div>
        )}
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

      {/* Job List */}
      <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
        {filteredJobs.map((job) => {
          const isExpanded = expandedJob === job.id;
          const isApplied = appliedJobIds.has(job.id);
          const isApplying = activeApplication?.jobId === job.id;
          const jobSaved = isSaved(job.id);

          return (
            <div
              key={job.id}
              className="bg-card"
            >
              {/* Row */}
              <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handleExpandJob(job.id)}>
                {/* Company initial */}
                <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-foreground">{job.company[0]}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug">{job.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {job.company}{job.location ? ` · ${job.location}` : ""}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {job.match && (
                      <MatchScoreTooltip match={job.match}>
                        <span className="text-xs text-muted-foreground cursor-help">{job.match.overall_score}% match</span>
                      </MatchScoreTooltip>
                    )}
                    {job.salary_range && job.salary_range !== "Not specified" && (
                      <span className="text-xs text-muted-foreground">{job.salary_range}</span>
                    )}
                    {job.freshness_score > 0.9 && (
                      <span className="text-[10px] font-medium text-primary">New</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/40">{job.source}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { toggleSave(job.id); toast(jobSaved ? "Removed from saved" : "Saved"); }}
                    className={`p-1.5 rounded-sm transition-colors ${jobSaved ? "text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                    title={jobSaved ? "Remove bookmark" : "Save job"}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${jobSaved ? "fill-current" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleDismiss(job)}
                    className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border bg-muted/20">
                  <p className="text-sm text-muted-foreground py-3 leading-relaxed whitespace-pre-line">{job.description}</p>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <SalaryInsights
                      jobTitle={job.title}
                      company={job.company}
                      location={job.location}
                      salaryRange={job.salary_range}
                      description={job.description}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      disabled={researchingJobId === job.id}
                      onClick={() => handleResearchCompany(job)}
                    >
                      {researchingJobId === job.id
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Researching…</>
                        : <><Building2 className="w-3 h-3" />Research Company</>}
                    </Button>
                  </div>

                  {/* Company Research Panel */}
                  {companyResearch[job.id] && (
                    <div className="mb-4 rounded-md border border-border bg-card p-3 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{job.company} Intelligence</span>
                        {companyResearch[job.id]!._scraped && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">Live data</span>}
                      </div>
                      {companyResearch[job.id]!.mission && (
                        <p className="text-muted-foreground leading-relaxed"><span className="font-medium text-foreground">Mission: </span>{companyResearch[job.id]!.mission}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {companyResearch[job.id]!.industry && <div><span className="text-muted-foreground">Industry</span><p className="font-medium mt-0.5">{companyResearch[job.id]!.industry}</p></div>}
                        {companyResearch[job.id]!.stage && <div><span className="text-muted-foreground">Stage</span><p className="font-medium mt-0.5">{companyResearch[job.id]!.stage}</p></div>}
                        {companyResearch[job.id]!.headcount && <div><span className="text-muted-foreground">Headcount</span><p className="font-medium mt-0.5">{companyResearch[job.id]!.headcount}</p></div>}
                      </div>
                      {companyResearch[job.id]!.tech_stack?.length > 0 && (
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1 mb-1"><Cpu className="w-3 h-3" />Tech Stack</p>
                          <div className="flex flex-wrap gap-1">
                            {companyResearch[job.id]!.tech_stack.map((t, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{t}</span>)}
                          </div>
                        </div>
                      )}
                      {companyResearch[job.id]!.culture_signals?.length > 0 && (
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1 mb-1"><Users className="w-3 h-3" />Culture</p>
                          <ul className="space-y-0.5">
                            {companyResearch[job.id]!.culture_signals.slice(0, 3).map((s, i) => <li key={i} className="text-muted-foreground">· {s}</li>)}
                          </ul>
                        </div>
                      )}
                      {companyResearch[job.id]!.recent_news?.length > 0 && (
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1 mb-1"><Newspaper className="w-3 h-3" />Recent News</p>
                          <ul className="space-y-0.5">
                            {companyResearch[job.id]!.recent_news.slice(0, 2).map((n, i) => <li key={i} className="text-muted-foreground">· {n}</li>)}
                          </ul>
                        </div>
                      )}
                      {companyResearch[job.id]!.interview_tip && (
                        <div className="flex items-start gap-1.5 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
                          <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-amber-700 dark:text-amber-300">{companyResearch[job.id]!.interview_tip}</p>
                        </div>
                      )}
                    </div>
                  )}

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
                      <div className="h-0.5 w-full bg-muted overflow-hidden rounded-full">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${activeApplication.progress}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">{activeApplication.logs[activeApplication.logs.length - 1]}</p>
                    </div>
                  )}

                  {/* Hiring team */}
                  {stakeholders[job.id] && (
                    <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Hiring team</p>
                      {stakeholders[job.id].map((person, i) => (
                        <a key={i} href={person.profile_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2.5 py-1.5 text-sm hover:text-primary transition-colors">
                          <div className="w-6 h-6 rounded-sm bg-muted flex items-center justify-center text-xs font-medium shrink-0">{person.name?.[0] || '?'}</div>
                          <span className="font-medium text-xs">{person.name}</span>
                          <span className="text-xs text-muted-foreground">{person.role}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground/50 ml-auto shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                  {expandedJob === job.id && !stakeholders[job.id] && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                      <Loader2 className="w-3 h-3 animate-spin" /> Finding hiring team...
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}

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
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-md bg-muted/20">
            <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-5">
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
    </div>
  );
};

export default JobFeed;
