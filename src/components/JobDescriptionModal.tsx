import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EnrichedJob } from "@/hooks/useJobs";
import type { Stakeholder } from "@/lib/recruiter_engine";
import type { CompanyResearch } from "@/lib/crawler_engine";
import {
  Send, PenTool, Bookmark, GraduationCap, Loader2, ExternalLink,
  MapPin, DollarSign, Building2, Cpu, Users, Newspaper, Lightbulb,
  ChevronDown, ChevronUp, FileText, Target, CheckCircle2
} from "lucide-react";
import MatchScoreTooltip from "./MatchScoreTooltip";
import SalaryInsights from "./SalaryInsights";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Progress } from "@/components/ui/progress";

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

  if (!job) return null;

  const postedDate = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <Dialog open={!!job} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl w-full p-0 gap-0 flex flex-col max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 bg-muted/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <span className="text-lg font-bold text-foreground">{job.company[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold leading-snug text-foreground">
                {job.title}
              </DialogTitle>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                {job.company}
                {job.location && (
                  <span className="inline-flex items-center gap-1 ml-3 text-muted-foreground/80">
                    <MapPin className="w-3.5 h-3.5" />{job.location}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {job.match && (
                  <MatchScoreTooltip match={job.match}>
                    <Badge variant="secondary" className="text-xs cursor-help bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                      {job.match.overall_score}% match
                    </Badge>
                  </MatchScoreTooltip>
                )}
                {job.salary_range && job.salary_range !== "Not specified" && (
                  <Badge variant="outline" className="text-xs gap-1 border-border bg-background">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />{job.salary_range}
                  </Badge>
                )}
                {job.freshness_score > 0.9 && (
                  <Badge variant="default" className="text-[10px] px-1.5 uppercase tracking-wider">New</Badge>
                )}
                {postedDate && (
                  <span className="text-xs text-muted-foreground ml-1">Posted {postedDate}</span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 min-h-0 bg-background">
          <div className="px-6 py-6 space-y-8">
            
            {/* Match Breakdown Section */}
            {job.match && (
               <div className="space-y-4">
                 <h4 className="text-sm font-semibold flex items-center gap-2 border-b border-border pb-2 text-foreground">
                   <Target className="w-4 h-4 text-primary" /> Match Breakdown
                 </h4>
                 <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 space-y-4">
                   <div>
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-sm font-semibold text-foreground/90">Overall Fit</span>
                       <span className="text-base font-bold text-primary">{Math.round(job.match.overall_score)}%</span>
                     </div>
                     <Progress value={job.match.overall_score} className="h-2.5 bg-primary/20 [&>div]:bg-primary" />
                   </div>
                   
                   {job.match.reasoning && (
                     <div className="pt-3 border-t border-primary/10">
                       <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Why it's a match</p>
                       <div className="flex items-start gap-2.5 bg-background border border-primary/10 rounded-md p-3 shadow-sm">
                         <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                         <p className="text-sm text-foreground/90 leading-relaxed">
                           {job.match.reasoning}
                         </p>
                       </div>
                     </div>
                   )}
                 </div>
               </div>
            )}

            {/* Tech stack / Skills */}
            {job.tech_stack && job.tech_stack.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 border-b border-border pb-2 text-foreground">
                  <Cpu className="w-4 h-4 text-primary" /> Skills Needed
                </h4>
                <div className="flex flex-wrap gap-2">
                  {job.tech_stack.map((t, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-md bg-muted text-xs font-semibold border border-border/60 text-foreground/80 shadow-sm">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Salary insights button */}
            <div className="pt-2">
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
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />{job.company} Intelligence
                  </span>
                  {companyResearch._scraped && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5 uppercase tracking-wider">
                      Live data
                    </span>
                  )}
                </div>
                {companyResearch.mission && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Mission: </span>{companyResearch.mission}
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                  {companyResearch.industry && <div><span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Industry</span><p className="text-sm font-medium mt-1 text-foreground">{companyResearch.industry}</p></div>}
                  {companyResearch.stage && <div><span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Stage</span><p className="text-sm font-medium mt-1 text-foreground">{companyResearch.stage}</p></div>}
                  {companyResearch.headcount && <div><span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Headcount</span><p className="text-sm font-medium mt-1 text-foreground">{companyResearch.headcount}</p></div>}
                </div>
                {companyResearch.culture_signals && companyResearch.culture_signals.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2"><Users className="w-3.5 h-3.5 text-muted-foreground" />Culture</p>
                    <ul className="space-y-1.5 pl-5">
                      {companyResearch.culture_signals.slice(0, 3).map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground list-disc">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {companyResearch.recent_news && companyResearch.recent_news.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2"><Newspaper className="w-3.5 h-3.5 text-muted-foreground" />Recent News</p>
                    <ul className="space-y-1.5 pl-5">
                      {companyResearch.recent_news.slice(0, 2).map((n, i) => (
                        <li key={i} className="text-sm text-muted-foreground list-disc">{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {companyResearch.interview_tip && (
                  <div className="flex items-start gap-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 p-3 mt-4">
                    <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Interview Tip</p>
                      <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">{companyResearch.interview_tip}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hiring Intel (collapsible) */}
            {(stakeholders && stakeholders.length > 0) || isLoadingStakeholders ? (
              <div className="border-t border-border pt-6 pb-2">
                <button
                  onClick={() => setIntelOpen(v => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {intelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Hiring Team Intelligence
                </button>
                {intelOpen && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {isLoadingStakeholders ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border border-border rounded-md">
                        <Loader2 className="w-4 h-4 animate-spin" /> Finding hiring team…
                      </div>
                    ) : stakeholders?.map((person, i) => (
                      <a
                        key={i}
                        href={person.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3 rounded-md border border-border bg-card hover:border-primary/40 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {person.name?.[0] || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            {person.name}
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                          <span className="block text-xs text-muted-foreground mt-0.5 truncate">{person.role}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Sticky footer actions */}
        <div className="px-6 py-4 border-t border-border bg-card shrink-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { if (!isApplied) onApply(); }}
                className="flex-1 sm:flex-none"
              >
                <Button
                  size="default"
                  variant={isApplied ? "secondary" : "default"}
                  disabled={isApplying}
                  className="w-full sm:w-auto gap-2 font-semibold shadow-sm"
                >
                  {isApplied ? (
                    <><Send className="w-4 h-4" />Applied</>
                  ) : isApplying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Applying…</>
                  ) : (
                    <><Send className="w-4 h-4" />Apply on Company Site</>
                  )}
                </Button>
              </a>
            )}
            <Button
              variant="outline"
              size="default"
              onClick={onTailor}
              disabled={isTailoring}
              className="gap-2 font-medium"
            >
              {isTailoring
                ? <><Loader2 className="w-4 h-4 animate-spin" />Tailoring…</>
                : <><PenTool className="w-4 h-4 text-muted-foreground" />Tailor Resume</>
              }
            </Button>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <Button variant="outline" size="default" onClick={onPrep} className="gap-2 flex-1 sm:flex-none font-medium">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />Interview Prep
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onSave}
              className="h-10 w-10 shrink-0 border-border bg-card hover:bg-muted"
              title={isSaved ? "Remove bookmark" : "Save job"}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
