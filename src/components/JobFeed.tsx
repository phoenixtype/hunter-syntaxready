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
import JobDescriptionModal from "./JobDescriptionModal";
import { recordFeedback } from "@/lib/learning_engine";
import { Sparkles, RefreshCw, Loader2, Globe, Search, MapPin, X, Bookmark, Link, ChevronDown, ChevronUp } from "lucide-react";
import { researchCompany, crawlCareersPage, CompanyResearch } from "@/lib/crawler_engine";
import { useEffect, useState, useMemo } from "react";
import JobFiltersBar, { JobFilters, DEFAULT_FILTERS, hasActiveFilters } from "./JobFiltersBar";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { Stakeholder } from "@/lib/recruiter_engine";
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
import { useSubscription } from "@/hooks/useSubscription";
import ProGate from "@/components/ProGate";

// Helper function to check if salary should be displayed
const shouldShowSalary = (salaryRange: string | null | undefined): boolean => {
  if (!salaryRange || salaryRange === "Not specified") return false;
  try {
    // Check for various forms of "0-0" patterns
    const normalizedSalary = salaryRange.toLowerCase().trim();
    if (normalizedSalary === "0-0" ||
        normalizedSalary === "0-0k" ||
        normalizedSalary === "0 - 0" ||
        normalizedSalary === "0 - 0k" ||
        normalizedSalary.match(/^0\s*[-–—]\s*0[k]?\s*$/)) {
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Error checking salary pattern:', error, salaryRange);
    return true; // Show it if we can't determine
  }
};

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
  const [selectedJob, setSelectedJob] = useState<EnrichedJob | null>(null);
  const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);
  const [tailorResult, setTailorResult] = useState<{ content: TailoredContent; job: { title: string; company: string } } | null>(null);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [careersUrl, setCareersUrl] = useState("");
  const [showCareersImport, setShowCareersImport] = useState(false);
  const [importingCareers, setImportingCareers] = useState(false);
  const [companyResearch, setCompanyResearch] = useState<Record<string, CompanyResearch | null>>({});
  const [researchingJobId, setResearchingJobId] = useState<string | null>(null);

  const { toggleSave, isSaved, savedCount } = useSavedJobs();
  const { isPro, canAccess, recordUsage } = useSubscription();
  const [gateOpen, setGateOpen] = useState(false);
  const [gateFeature, setGateFeature] = useState<string | undefined>();

  const requirePro = (featureLabel: string) => {
    if (isPro) return true;
    setGateFeature(featureLabel);
    setGateOpen(true);
    return false;
  };

  const filteredJobs = useMemo(() => {
    if (!Array.isArray(jobs)) {
      console.warn('Jobs data is not an array:', jobs);
      return [];
    }

    let result = jobs.filter(job => {
      // Safety check - ensure job has required properties
      if (!job || typeof job !== 'object' || !job.id) {
        console.warn('Invalid job object found:', job);
        return false;
      }
      return !dismissedJobIds.has(job.id) && !appliedJobIds.has(job.id);
    });

    // Hide jobs older than 90 days client-side
    result = result.filter(job => {
      if (!job.posted_at) return true;
      const postedTime = new Date(job.posted_at).getTime();
      if (isNaN(postedTime)) return true;
      return Date.now() - postedTime < 90 * 24 * 60 * 60 * 1000;
    });

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
  }, [jobs, dismissedJobIds, appliedJobIds, filters, showSavedOnly, isSaved]);

  useEffect(() => {
    if (!user) return;
    getApplicationHistory(user.id).then(history => {
      setAppliedJobIds(new Set(history.map(h => h.job_id)));
    });
  }, [user]);

  const handleApply = async (job: EnrichedJob) => {
    try {
      // Safety checks
      if (!job?.id) {
        console.error('Invalid job object passed to handleApply:', job);
        toast.error('Unable to apply. Invalid job data.');
        return;
      }

      if (appliedJobIds.has(job.id)) {
        // Do nothing, let the <a> tag handle navigation to the job URL
        return;
      }

      if (!canAccess('job_applications')) {
        setGateFeature('Job Applications');
        setGateOpen(true);
        return;
      }

      // Fire it in the background if we're not waiting for a specific simulation
      simulateApplication(job, (state) => {
        if (state.status === 'applied') {
          toast.success(`Recorded application!`);
          setAppliedJobIds(prev => new Set(prev).add(job.id));
        }
      }, user?.id, true);

      // Record usage after successful application
      await recordUsage({ featureName: 'job_applications' });
    } catch (error) {
      console.error('Error in handleApply:', error);
      if (error instanceof ComplianceError) {
        toast.warning("Blocked by compliance", { description: error.message, duration: 5000 });
      } else {
        toast.error("Application failed. Please try again.");
      }
      setActiveApplication(null);
    }
  };

  const handleDismiss = async (job: EnrichedJob) => {
    try {
      // Safety checks
      if (!job?.id) {
        console.error('Invalid job object passed to handleDismiss:', job);
        toast.error('Unable to hide job. Invalid job data.');
        return;
      }

      if (!requirePro("Job Actions")) return;

      setDismissedJobIds(prev => {
        const next = new Set(prev).add(job.id);
        try { localStorage.setItem("hunter_dismissed_jobs", JSON.stringify([...next])); } catch { /* ignore quota */ }
        return next;
      });

      toast("Job hidden", { description: "It won't show again on this device." });

      recordFeedback({
        jobId: job.id,
        action: 'DISMISS',
        timestamp: Date.now(),
        jobMetadata: {
          skills: [],
          company: job.company || 'Unknown Company',
          source: job.source || 'Unknown Source'
        }
      });
    } catch (error) {
      console.error('Error in handleDismiss:', error);
      toast.error('Unable to hide job. Please try again.');
    }
  };

  const handleSelectJob = async (job: EnrichedJob | null) => {
    try {
      // Safety check for job object
      if (job && (!job.id || !job.title || !job.company)) {
        console.error('Invalid job object passed to handleSelectJob:', job);
        toast.error('Unable to open job details. Invalid job data.');
        return;
      }

      setSelectedJob(job);

      if (job && !stakeholders[job.id]) {
        try {
          const { findStakeholders } = await import("@/lib/recruiter_engine");
          const network = await findStakeholders(job);
          setStakeholders(prev => ({ ...prev, [job.id]: network }));
        } catch (error) {
          console.error('Error finding stakeholders for job:', error, job.id);
          // Don't show error to user as this is optional functionality
        }
      }
    } catch (error) {
      console.error('Error in handleSelectJob:', error);
      toast.error('Unable to open job details. Please try again.');
      setSelectedJob(null);
    }
  };

  const handleTailor = async (job: EnrichedJob) => {
    try {
      // Safety checks
      if (!job?.id || !job?.title || !job?.company) {
        console.error('Invalid job object passed to handleTailor:', job);
        toast.error('Unable to tailor resume. Invalid job data.');
        return;
      }

      if (!requirePro("Resume Tailoring")) return;
      if (!profile) { toast.error("Build your profile first."); return; }

      setTailoringJobId(job.id);
      const toastId = toast.loading("Tailoring resume…", { description: `Optimizing for ${job.title} at ${job.company}` });

      try {
        const content = await generateTailoredContent(profile, job);
        await saveTailoredResume(content, { title: job.title, company: job.company, url: job.url || '' });
        setTailorResult({ content, job: { title: job.title, company: job.company } });
        toast.success("Resume tailored!", { id: toastId, description: "Your optimized resume is ready." });
      } catch (tailorError) {
        console.error('Error tailoring resume:', tailorError);
        toast.error("Tailoring failed", { id: toastId, description: "Try again — this is usually a temporary issue.", action: { label: "Retry", onClick: () => handleTailor(job) } });
      } finally {
        setTailoringJobId(null);
      }
    } catch (error) {
      console.error('Error in handleTailor:', error);
      toast.error('Unable to tailor resume. Please try again.');
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
    try {
      // Safety checks
      if (!job?.id || !job?.company) {
        console.error('Invalid job object passed to handleResearchCompany:', job);
        return;
      }

      if (companyResearch[job.id] !== undefined) return; // already fetched or fetching

      setResearchingJobId(job.id);
      const research = await researchCompany(job.company, job.title || '');
      setCompanyResearch(prev => ({ ...prev, [job.id]: research }));
    } catch (error) {
      console.error('Error researching company:', error);
      setCompanyResearch(prev => ({ ...prev, [job.id]: null }));
    } finally {
      setResearchingJobId(null);
    }
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
          <div className="relative flex-[2]" data-tour="job-search">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search jobs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 sm:h-11 text-base sm:text-sm" />
          </div>
          <div className="relative flex-1" data-tour="job-location">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Location..." value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} className="pl-10 h-12 sm:h-11 text-base sm:text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCrawl} disabled={crawling || loading} className="flex-1 sm:flex-none h-12 sm:h-11 px-4 shrink-0 gap-1.5 font-semibold sm:font-medium" data-tour="find-jobs-btn">
            {crawling ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Searching...</> : <><Globe className="w-3.5 h-3.5" />Find Jobs</>}
          </Button>
          <div data-tour="job-filters"><JobFiltersBar filters={filters} onChange={setFilters} /></div>
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

      {/* Careers page import - Enhanced visibility */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 overflow-hidden ring-1 ring-primary/10">
        <button
          onClick={() => setShowCareersImport(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <span className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Link className="w-4 h-4" />
            </div>
            <span>Import from career page</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 bg-primary/10 text-primary border-primary/20">
              Fast & Fresh
            </Badge>
          </span>
          {showCareersImport ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showCareersImport && (
          <div className="px-3 pb-3 pt-1 border-t border-primary/10 bg-background/50">
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Get the latest jobs directly from company career pages - often 24-48h before they appear on job boards.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
                <Input
                  placeholder="https://company.com/careers"
                  value={careersUrl}
                  onChange={e => setCareersUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCareersImport()}
                  className="pl-10 h-10 text-sm border-primary/20 focus:border-primary focus:ring-primary/20"
                />
              </div>
              <Button
                size="sm"
                onClick={handleCareersImport}
                disabled={importingCareers || !careersUrl.trim()}
                className="h-10 gap-2 shrink-0 bg-primary hover:bg-primary/90"
              >
                {importingCareers ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning…</> : <><Sparkles className="w-4 h-4" />Import Jobs</>}
              </Button>
            </div>
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
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">{filters.minSalary >= 1000 ? `${(filters.minSalary / 1000).toFixed(filters.minSalary % 1000 === 0 ? 0 : 1)}M+` : `${filters.minSalary}k+`}<button onClick={() => setFilters(f => ({ ...f, minSalary: 0 }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button></Badge>
          )}
          {filters.datePosted !== "all" && (
            <Badge variant="secondary" className="text-[10px] gap-1 pr-1">
              {filters.datePosted === "24h" ? "Last 24h" : filters.datePosted === "week" ? "This week" : "This month"}
              <button onClick={() => setFilters(f => ({ ...f, datePosted: "all" }))} className="ml-0.5 hover:text-destructive"><X className="w-2.5 h-2.5" /></button>
            </Badge>
          )}
        </div>
      )}

      {/* Job List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {filteredJobs.map((job) => {
          const isApplied = appliedJobIds.has(job.id);
          const jobSaved = isSaved(job.id);

          return (
            <div
              key={job.id}
              className="group relative flex flex-col bg-card border border-border/50 hover:border-primary/30 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
              data-tour="job-card-actions"
              onClick={() => handleSelectJob(job)}
            >
              {/* Quick Actions (Absolute) */}
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { if (!requirePro("Save Jobs")) return; toggleSave(job.id); toast(jobSaved ? "Removed from saved" : "Saved"); }}
                    className={`p-2 rounded-md transition-colors backdrop-blur-md ${jobSaved ? "text-primary bg-primary/10 opacity-100" : "text-muted-foreground bg-background/80 hover:bg-muted hover:text-foreground"}`}
                    title={jobSaved ? "Remove bookmark" : "Save job"}
                  >
                    <Bookmark className={`w-4 h-4 ${jobSaved ? "fill-current" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleDismiss(job)}
                    className="p-2 rounded-md text-muted-foreground bg-background/80 backdrop-blur-md hover:bg-muted hover:text-foreground transition-colors hidden sm:flex"
                    title="Hide this job"
                  >
                    <X className="w-4 h-4" />
                  </button>
              </div>

              {/* Card Body: Title, Company, Details */}
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-base font-semibold leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors pr-10">{job.title || 'Job Title Not Available'}</h3>
                <p className="text-sm text-muted-foreground mb-4 font-medium">{job.company || 'Company Not Available'}</p>

                <div className="flex flex-wrap items-center gap-2 mt-auto">
                  {job.location && (
                    <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                    </Badge>
                  )}
                  {shouldShowSalary(job.salary_range) && (
                    <Badge variant="secondary" className="text-[10px] font-medium bg-muted/50 text-muted-foreground">
                      {job.salary_range}
                    </Badge>
                  )}
                  {job.match && (
                    <MatchScoreTooltip match={job.match}>
                      <Badge className="text-[10px] font-semibold bg-primary/10 text-primary border-none cursor-help hover:bg-primary/20" data-tour="match-score">
                        {Math.round(job.match.overall_score)}% match
                      </Badge>
                    </MatchScoreTooltip>
                  )}
                  {job.freshness_score > 0.9 && (
                    <Badge className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-none">
                      New
                    </Badge>
                  )}
                  {isApplied && (
                    <Badge variant="outline" className="text-[10px] font-medium border-primary/30 text-primary">
                      Applied
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination & States (Moved outside grid) */}
      <div className="mt-6">
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
                <h3 className="font-semibold text-base">We're finding jobs for you</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Hunter is searching for roles that match your profile. Complete your profile and preferences to get better matches.</p>
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

      <JobDescriptionModal
        job={selectedJob}
        stakeholders={selectedJob ? stakeholders[selectedJob.id] : undefined}
        isLoadingStakeholders={selectedJob ? !stakeholders[selectedJob.id] : false}
        companyResearch={selectedJob ? companyResearch[selectedJob.id] : undefined}
        isApplied={selectedJob ? appliedJobIds.has(selectedJob.id) : false}
        isApplying={selectedJob ? activeApplication?.jobId === selectedJob.id : false}
        isTailoring={selectedJob ? tailoringJobId === selectedJob.id : false}
        isSaved={selectedJob ? isSaved(selectedJob.id) : false}
        isPro={isPro}
        onClose={() => setSelectedJob(null)}
        onApply={() => selectedJob && handleApply(selectedJob)}
        onTailor={() => selectedJob && handleTailor(selectedJob)}
        onSave={() => {
          if (!selectedJob) return;
          if (!requirePro("Save Jobs")) return;
          toggleSave(selectedJob.id);
          toast(isSaved(selectedJob.id) ? "Removed from saved" : "Saved");
        }}
        onPrep={() => {
          if (!selectedJob) return;
          if (!requirePro("Interview Coach")) return;
          navigate(`/interview-coach?title=${encodeURIComponent(selectedJob.title)}&company=${encodeURIComponent(selectedJob.company)}&desc=${encodeURIComponent(selectedJob.description?.substring(0, 500) || '')}`);
        }}
      />

      <TailorResultSheet
        open={!!tailorResult}
        onClose={() => setTailorResult(null)}
        content={tailorResult?.content ?? null}
        job={tailorResult?.job ?? null}
      />

      <ProGate.Dialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        featureLabel={gateFeature}
      />
    </div>
  );
};

export default JobFeed;
