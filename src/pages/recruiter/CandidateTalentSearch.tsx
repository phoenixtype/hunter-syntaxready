import { useState, useEffect, useCallback, useRef } from "react";
import { Search, SlidersHorizontal, Users, Star, MapPin, Briefcase, Mail, Loader2, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  searchCandidates,
  type TalentCandidate,
  type TalentSearchFilters,
} from "@/lib/recruiter_engine";
import { useMyJobs } from "@/hooks/useRecruiter";
import CandidateProfileDrawer from "@/components/recruiter/CandidateProfileDrawer";
import OutreachModal from "@/components/recruiter/OutreachModal";

const REMOTE_OPTIONS = [
  { value: "__all__", label: "Any work style" },
  { value: "remote", label: "Remote only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const MatchBadge = ({ score }: { score?: number }) => {
  if (score === undefined) return null;
  const color =
    score >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    score >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
      <Star className="w-3 h-3" />{score}%
    </span>
  );
};

const CandidateCard = ({
  candidate,
  onView,
  onOutreach,
}: {
  candidate: TalentCandidate;
  onView: (c: TalentCandidate) => void;
  onOutreach: (c: TalentCandidate) => void;
}) => {
  const initials = candidate.full_name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 2);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all duration-150 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/15 text-primary font-semibold text-sm flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm leading-tight">{candidate.full_name}</span>
            <MatchBadge score={candidate.match_score} />
          </div>
          {candidate.headline && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{candidate.headline}</p>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {candidate.locations.length > 0 && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {candidate.locations.slice(0, 1).join(", ")}
          </span>
        )}
        {candidate.experience_years > 0 && (
          <span className="flex items-center gap-1">
            <Briefcase className="w-3 h-3 shrink-0" />
            {candidate.experience_years}y exp
          </span>
        )}
        {candidate.remote_policy && candidate.remote_policy !== "any" && (
          <span className="capitalize">{candidate.remote_policy}</span>
        )}
      </div>

      {/* Skills */}
      {candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {candidate.skills.slice(0, 5).map(s => (
            <Badge key={s} variant="secondary" className="text-[11px] rounded-full font-normal py-0">{s}</Badge>
          ))}
          {candidate.skills.length > 5 && (
            <span className="text-[11px] text-muted-foreground self-center">+{candidate.skills.length - 5}</span>
          )}
        </div>
      )}

      {/* Target roles */}
      {candidate.target_roles.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Seeking: {candidate.target_roles.slice(0, 2).join(", ")}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 text-xs rounded-full"
          onClick={() => onView(candidate)}
        >
          View profile
        </Button>
        <Button
          size="sm"
          className="h-8 px-3 text-xs rounded-full gap-1"
          onClick={() => onOutreach(candidate)}
        >
          <Mail className="w-3 h-3" />
          Reach out
        </Button>
      </div>
    </div>
  );
};

const CandidateTalentSearch = () => {
  const { jobs } = useMyJobs();
  const activeJobs = jobs.filter(j => j.status === "active");

  const [candidates, setCandidates] = useState<TalentCandidate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [remotePolicy, setRemotePolicy] = useState("__all__");
  const [selectedJobId, setSelectedJobId] = useState("__none__");
  const [showFilters, setShowFilters] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState<TalentCandidate | null>(null);
  const [outreachTarget, setOutreachTarget] = useState<TalentCandidate | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCandidates = useCallback(async (filters: TalentSearchFilters) => {
    setLoading(true);
    try {
      const result = await searchCandidates(filters);
      setCandidates(result.candidates);
      setTotal(result.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on filter change (debounced for search text)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const filters: TalentSearchFilters = {
        skills: searchText.trim() ? searchText.split(/[\s,]+/).filter(Boolean) : [],
        remotePolicy: remotePolicy !== "__all__" ? remotePolicy : undefined,
        jobId: selectedJobId !== "__none__" ? selectedJobId : undefined,
        limit: 60,
      };
      fetchCandidates(filters);
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchText, remotePolicy, selectedJobId, fetchCandidates]);

  const clearSearch = () => {
    setSearchText("");
    setRemotePolicy("__all__");
    setSelectedJobId("__none__");
  };

  const hasFilters = searchText || remotePolicy !== "__all__" || selectedJobId !== "__none__";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
        <div>
          <h1 className="text-base font-semibold">Talent Search</h1>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${total} active candidate${total !== 1 ? "s" : ""} available`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs rounded-full"
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </Button>
      </header>

      {/* Filters panel */}
      {showFilters && (
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Skill / name search */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Search by skill</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="e.g. React, TypeScript, Python…"
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            {/* Remote policy */}
            <div className="min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Work style</label>
              <Select value={remotePolicy} onValueChange={setRemotePolicy}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMOTE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Match against job */}
            <div className="min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Match against job</label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="No job selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No job selected</SelectItem>
                  {activeJobs.map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-muted-foreground rounded-full" onClick={clearSearch}>
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            )}
          </div>

          {selectedJobId !== "__none__" && (
            <p className="text-xs text-primary mt-2 flex items-center gap-1">
              <Star className="w-3 h-3" />
              Match scores shown — candidates ranked by fit for{" "}
              <strong>{activeJobs.find(j => j.id === selectedJobId)?.title ?? "selected job"}</strong>
            </p>
          )}
        </div>
      )}

      {/* Default search bar (when filters panel hidden) */}
      {!showFilters && (
        <div className="border-b border-border px-6 py-3 bg-background">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search by skill, e.g. React, Python, AWS…"
              className="pl-9 h-9 text-sm"
            />
            {searchText && (
              <button onClick={() => setSearchText("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Finding candidates…</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">No candidates found</p>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                {hasFilters
                  ? "Try broadening your filters — fewer skill keywords or a different work style."
                  : "Candidates appear here once they enable auto-apply in their hunter.ai account. Share hunter.ai with your network to grow the talent pool."}
              </p>
            </div>
            {hasFilters && (
              <Button variant="outline" size="sm" className="rounded-full gap-1.5" onClick={clearSearch}>
                <X className="w-3.5 h-3.5" /> Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {candidates.map(c => (
                <CandidateCard
                  key={c.user_id}
                  candidate={c}
                  onView={setSelectedCandidate}
                  onOutreach={setOutreachTarget}
                />
              ))}
            </div>

            {candidates.length < total && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  className="rounded-full gap-1.5"
                  onClick={() => {
                    const filters: TalentSearchFilters = {
                      skills: searchText.trim() ? searchText.split(/[\s,]+/).filter(Boolean) : [],
                      remotePolicy: remotePolicy !== "__all__" ? remotePolicy : undefined,
                      jobId: selectedJobId !== "__none__" ? selectedJobId : undefined,
                      limit: 60,
                      offset: candidates.length,
                    };
                    setLoading(true);
                    searchCandidates(filters)
                      .then(r => {
                        setCandidates(prev => [...prev, ...r.candidates]);
                        setTotal(r.total);
                      })
                      .catch(() => toast.error("Failed to load more"))
                      .finally(() => setLoading(false));
                  }}
                >
                  <ChevronDown className="w-4 h-4" />
                  Load more ({total - candidates.length} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Profile drawer */}
      {selectedCandidate && (
        <CandidateProfileDrawer
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onOutreach={(c) => {
            setSelectedCandidate(null);
            setOutreachTarget(c);
          }}
        />
      )}

      {/* Outreach modal */}
      {outreachTarget && (
        <OutreachModal
          candidate={outreachTarget}
          jobs={jobs}
          onClose={() => setOutreachTarget(null)}
        />
      )}
    </div>
  );
};

export default CandidateTalentSearch;
