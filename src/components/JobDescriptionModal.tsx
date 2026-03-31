import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EnrichedJob } from "@/hooks/useJobs";
import type { Stakeholder } from "@/lib/recruiter_engine";
import type { CompanyResearch } from "@/lib/crawler_engine";
import {
  Send, PenTool, Bookmark, GraduationCap, Loader2, ExternalLink,
  MapPin, DollarSign, Building2, Cpu, Users, ChevronDown, ChevronUp,
  Target, CheckCircle2, Sparkles
} from "lucide-react";
import MatchScoreTooltip from "./MatchScoreTooltip";
import SalaryInsights from "./SalaryInsights";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

// Helper function to check if salary should be displayed
const shouldShowSalary = (salaryRange: string | null | undefined): boolean => {
  if (!salaryRange || salaryRange === "Not specified") return false;
  try {
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
    return true;
  }
};

interface Props {
  job: EnrichedJob | null;
  stakeholders?: Stakeholder[];
  isLoadingStakeholders?: boolean;
  companyResearch?: CompanyResearch | null;
  isApplied: boolean;
  isApplying: boolean;
  isTailoring: boolean;
  isSaved: boolean;
  isPro: boolean;
  onClose: () => void;
  onApply: () => void;
  onTailor: () => void;
  onSave: () => void;
  onPrep: () => void;
}

export default function JobDescriptionModal({
  job,
  stakeholders,
  isLoadingStakeholders,
  companyResearch,
  isApplied,
  isApplying,
  isTailoring,
  isSaved,
  isPro,
  onClose,
  onApply,
  onTailor,
  onSave,
  onPrep,
}: Props) {
  const [showAITools, setShowAITools] = useState(false);

  if (!job) return null;

  // Safe data extraction with fallbacks to prevent errors
  const safeJob = {
    ...job,
    title: job.title || 'Job Title Not Available',
    company: job.company || 'Company Not Available',
    location: job.location || '',
    description: job.description || '',
    salary_range: job.salary_range || '',
    tech_stack: job.tech_stack || [],
    match: job.match || null,
    posted_at: job.posted_at,
    freshness_score: job.freshness_score || 0
  };

  const postedDate = safeJob.posted_at
    ? (() => {
        try {
          return new Date(safeJob.posted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <Dialog open={!!job} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 flex flex-col max-h-[90vh]">
        {/* Compact Header with Primary CTA */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0 bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-sm font-bold text-foreground">{safeJob.company[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold leading-snug text-foreground pr-2">
                {safeJob.title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                <span>{safeJob.company}</span>
                {safeJob.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{safeJob.location}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {safeJob.match && (
                  <MatchScoreTooltip match={safeJob.match}>
                    <Badge variant="secondary" className="text-xs cursor-help bg-primary/10 text-primary border-primary/20">
                      {Math.round(safeJob.match.overall_score)}% match
                    </Badge>
                  </MatchScoreTooltip>
                )}
                {shouldShowSalary(safeJob.salary_range) && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <DollarSign className="w-3 h-3" />{safeJob.salary_range}
                  </Badge>
                )}
                {safeJob.freshness_score > 0.9 && (
                  <Badge variant="default" className="text-[10px] px-1.5 uppercase tracking-wider">New</Badge>
                )}
                {postedDate && (
                  <span className="text-xs text-muted-foreground">Posted {postedDate}</span>
                )}
              </div>
            </div>
            {/* Primary Apply CTA in header */}
            <div className="shrink-0 flex gap-2">
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { if (!isApplied) onApply(); }}
                >
                  <Button
                    size="sm"
                    variant={isApplied ? "secondary" : "default"}
                    disabled={isApplying}
                    className="gap-2 font-semibold"
                  >
                    {isApplied ? (
                      <><Send className="w-4 h-4" />Applied</>
                    ) : isApplying ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Applying…</>
                    ) : (
                      <><Send className="w-4 h-4" />Apply</>
                    )}
                  </Button>
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                className="p-2"
                title={isSaved ? "Remove bookmark" : "Save job"}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Compact Content - No scrolling */}
        <div className="flex-1 px-4 py-3 space-y-3 overflow-hidden">

          {/* Compact Match Breakdown */}
          {safeJob.match && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Overall Fit</span>
                </div>
                <span className="text-lg font-bold text-primary">{Math.round(safeJob.match.overall_score)}%</span>
              </div>
              <Progress value={safeJob.match.overall_score} className="h-2 bg-primary/20 [&>div]:bg-primary mb-2" />
              {safeJob.match.reasoning && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{safeJob.match.reasoning.slice(0, 150)}{safeJob.match.reasoning.length > 150 ? '...' : ''}</p>
                </div>
              )}
            </div>
          )}

          {/* Compact Skills */}
          {safeJob.tech_stack && safeJob.tech_stack.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-foreground">
                <Cpu className="w-4 h-4 text-primary" /> Skills Needed
              </h4>
              <div className="flex flex-wrap gap-1">
                {safeJob.tech_stack.slice(0, 8).map((skill, i) => (
                  <span key={i} className="px-2 py-1 text-xs bg-muted rounded border border-border/60">{skill}</span>
                ))}
                {safeJob.tech_stack.length > 8 && (
                  <span className="text-xs text-muted-foreground self-center">+{safeJob.tech_stack.length - 8} more</span>
                )}
              </div>
            </div>
          )}

          {/* Compact Company Info */}
          {companyResearch && (
            <div className="border border-border bg-card rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{safeJob.company}</span>
                {companyResearch._scraped && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 bg-emerald-50 text-emerald-600 border-emerald-200">Live</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {companyResearch.industry && (
                  <div>
                    <p className="text-muted-foreground font-medium">Industry</p>
                    <p className="font-semibold">{companyResearch.industry}</p>
                  </div>
                )}
                {companyResearch.stage && (
                  <div>
                    <p className="text-muted-foreground font-medium">Stage</p>
                    <p className="font-semibold">{companyResearch.stage}</p>
                  </div>
                )}
                {companyResearch.headcount && (
                  <div>
                    <p className="text-muted-foreground font-medium">Size</p>
                    <p className="font-semibold">{companyResearch.headcount}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compact Hiring Team */}
          {((stakeholders && stakeholders.length > 0) || isLoadingStakeholders) && (
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" /> Hiring Team
              </h4>
              <div className="flex gap-2">
                {isLoadingStakeholders ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 border rounded-md">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                  </div>
                ) : stakeholders?.slice(0, 2).map((person, i) => (
                  <a
                    key={i}
                    href={person.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 border rounded-md hover:border-primary/40 transition-colors text-xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                      {person.name?.[0] || "?"}
                    </div>
                    <div>
                      <p className="font-semibold">{person.name}</p>
                      <p className="text-muted-foreground">{person.role}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Tools Toggle */}
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAITools(!showAITools)}
            className="w-full gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="w-4 h-4" />
            AI-Powered Tools
            {showAITools ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {showAITools && (
            <div className="flex gap-2 mt-2">
              <SalaryInsights
                jobTitle={safeJob.title}
                company={safeJob.company}
                location={safeJob.location}
                salaryRange={safeJob.salary_range}
                description={safeJob.description}
                trigger={
                  <Button variant="outline" size="sm" className="flex-1 gap-2 text-xs">
                    <DollarSign className="w-3 h-3" />
                    Salary Insights
                  </Button>
                }
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onTailor}
                disabled={isTailoring}
                className="flex-1 gap-2 text-xs"
              >
                {isTailoring ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Tailoring…</>
                ) : (
                  <><PenTool className="w-3 h-3" />Tailor Resume</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onPrep}
                className="flex-1 gap-2 text-xs"
              >
                <GraduationCap className="w-3 h-3" />Interview Prep
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
