import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EnrichedJob } from "@/hooks/useJobs";
import type { Stakeholder } from "@/lib/recruiter_engine";
import type { CompanyResearch } from "@/lib/crawler_engine";
import ReactMarkdown from "react-markdown";
import {
  Send, PenTool, Bookmark, GraduationCap, Loader2, ExternalLink,
  MapPin, DollarSign, Building2, Cpu, Users, Newspaper, Lightbulb,
  ChevronDown, ChevronUp,
} from "lucide-react";
import MatchScoreTooltip from "./MatchScoreTooltip";
import SalaryInsights from "./SalaryInsights";
import { useState, useMemo } from "react";

/**
 * Clean up raw job descriptions so they render nicely in Markdown.
 *
 * Handles common crawled-text problems:
 *  - inline bullet characters (•, -, ▪, ►, ●, ◦, ■) → proper markdown list items
 *  - section-heading keywords smashed into the previous sentence → separated with ## heading
 *  - missing paragraph breaks between dense blocks
 */
function formatDescription(raw: string): string {
  let text = raw;

  // Normalise bullet-like characters that appear mid-line into newline + markdown bullet
  text = text.replace(/\s*[•●◦▪►■]\s*/g, '\n- ');

  // Common section-heading patterns: insert a blank line + ## heading before them
  const headingPatterns = [
    /(?<=\S)\s*((?:Why You Should Apply|What You(?:'ll| Will) (?:Be )?Do(?:ing)?|About (?:You|The (?:Role|Company|Team))|How To Apply|Requirements|Qualifications|Responsibilities|Benefits|Perks|Compensation|What We(?:'re| Are) (?:Looking For|Offering)|Who You Are|Key Skills|Nice To Have|Preferred|Must Have|Your Background|The Opportunity|The Role|Job Summary|Overview|Description|Duties|Skills|Education|Experience))/gi,
  ];

  for (const pat of headingPatterns) {
    text = text.replace(pat, '\n\n## $1');
  }

  // If a line starts with "- " (our bullets) ensure a blank line before the first bullet
  // so Markdown recognises the list.
  text = text.replace(/([^\n])\n(- )/g, '$1\n\n$2');

  // Collapse 3+ consecutive newlines to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

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
  const [intelOpen, setIntelOpen] = useState(false);

  const formattedDescription = useMemo(
    () => (job?.description ? formatDescription(job.description) : null),
    [job?.description]
  );

  if (!job) return null;

  const postedDate = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <Dialog open={!!job} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 flex flex-col max-h-[85vh]">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm font-bold text-foreground">{job.company[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold leading-snug">
                {job.title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {job.company}
                {job.location && (
                  <span className="inline-flex items-center gap-1 ml-2">
                    <MapPin className="w-3 h-3" />{job.location}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {job.match && (
                  <MatchScoreTooltip match={job.match}>
                    <Badge variant="secondary" className="text-[11px] cursor-help">
                      {job.match.overall_score}% match
                    </Badge>
                  </MatchScoreTooltip>
                )}
                {job.salary_range && job.salary_range !== "Not specified" && (
                  <Badge variant="outline" className="text-[11px] gap-1">
                    <DollarSign className="w-3 h-3" />{job.salary_range}
                  </Badge>
                )}
                {job.freshness_score > 0.9 && (
                  <Badge variant="default" className="text-[10px]">New</Badge>
                )}
                {postedDate && (
                  <span className="text-[11px] text-muted-foreground">Posted {postedDate}</span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-5">
            {/* Description */}
            {formattedDescription ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-muted-foreground [&_h2]:mt-6 [&_h2]:mb-2 [&_ul]:space-y-1">
                <ReactMarkdown>{formattedDescription}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description available.</p>
            )}

            {/* Tech stack */}
            {job.tech_stack && job.tech_stack.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> Tech Stack
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {job.tech_stack.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Salary insights */}
            <div className="flex items-center gap-2 flex-wrap">
              <SalaryInsights
                jobTitle={job.title}
                company={job.company}
                location={job.location}
                salaryRange={job.salary_range}
                description={job.description}
              />
            </div>

            {/* Company research */}
            {companyResearch && (
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />{job.company} Intelligence
                  </span>
                  {companyResearch._scraped && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                      Live data
                    </span>
                  )}
                </div>
                {companyResearch.mission && (
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Mission: </span>{companyResearch.mission}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {companyResearch.industry && <div><span className="text-muted-foreground">Industry</span><p className="font-medium mt-0.5">{companyResearch.industry}</p></div>}
                  {companyResearch.stage && <div><span className="text-muted-foreground">Stage</span><p className="font-medium mt-0.5">{companyResearch.stage}</p></div>}
                  {companyResearch.headcount && <div><span className="text-muted-foreground">Headcount</span><p className="font-medium mt-0.5">{companyResearch.headcount}</p></div>}
                </div>
                {companyResearch.culture_signals && companyResearch.culture_signals.length > 0 && (
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1 mb-1"><Users className="w-3 h-3" />Culture</p>
                    <ul className="space-y-0.5">
                      {companyResearch.culture_signals.slice(0, 3).map((s, i) => (
                        <li key={i} className="text-muted-foreground">· {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {companyResearch.recent_news && companyResearch.recent_news.length > 0 && (
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1 mb-1"><Newspaper className="w-3 h-3" />Recent News</p>
                    <ul className="space-y-0.5">
                      {companyResearch.recent_news.slice(0, 2).map((n, i) => (
                        <li key={i} className="text-muted-foreground">· {n}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {companyResearch.interview_tip && (
                  <div className="flex items-start gap-1.5 rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1.5">
                    <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-amber-700 dark:text-amber-300">{companyResearch.interview_tip}</p>
                  </div>
                )}
              </div>
            )}

            {/* Hiring Intel (collapsible) */}
            {(stakeholders && stakeholders.length > 0) || isLoadingStakeholders ? (
              <div className="border-t border-border pt-4">
                <button
                  onClick={() => setIntelOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {intelOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Hiring Intel
                </button>
                {intelOpen && (
                  <div className="mt-3 space-y-1.5">
                    {isLoadingStakeholders ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Finding hiring team…
                      </div>
                    ) : stakeholders?.map((person, i) => (
                      <a
                        key={i}
                        href={person.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 py-1.5 text-sm hover:text-primary transition-colors"
                      >
                        <div className="w-6 h-6 rounded-sm bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                          {person.name?.[0] || "?"}
                        </div>
                        <span className="font-medium text-xs">{person.name}</span>
                        <span className="text-xs text-muted-foreground">{person.role}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground/50 ml-auto shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Sticky footer actions */}
        <div className="px-6 py-4 border-t border-border bg-card shrink-0 flex items-center gap-2 flex-wrap">
          {job.url && (
            <a
              href={isApplied ? job.url : undefined}
              target={isApplied ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={(e) => { if (!isApplied) { e.preventDefault(); onApply(); } }}
              className="flex-1 sm:flex-none"
            >
              <Button
                size="sm"
                variant={isApplied ? "secondary" : "default"}
                disabled={isApplying}
                className="w-full sm:w-auto gap-1.5 font-semibold"
              >
                {isApplied ? (
                  <><Send className="w-3.5 h-3.5" />Applied</>
                ) : isApplying ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Applying…</>
                ) : (
                  <><Send className="w-3.5 h-3.5" />Apply Now</>
                )}
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onTailor}
            disabled={isTailoring}
            className="gap-1.5"
          >
            {isTailoring
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Tailoring…</>
              : <><PenTool className="w-3.5 h-3.5" />Tailor Resume</>
            }
          </Button>
          <Button variant="outline" size="sm" onClick={onPrep} className="gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" />Interview Prep
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSave}
            className="h-9 w-9 shrink-0"
            title={isSaved ? "Remove bookmark" : "Save job"}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current" : ""}`} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
