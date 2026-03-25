import { Brain, TrendingUp, GraduationCap, Info, Sparkles, Target, Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { VisibilityScore } from "@/lib/visibility_engine";
import { SkillRecommendation } from "@/lib/skill_coach_engine";
import { CandidateProfile } from "@/lib/resume_engine";

interface InsightsViewProps {
  visibility: VisibilityScore | null | undefined;
  skillRecommendations: SkillRecommendation[];
  profile: CandidateProfile | null;
  onConsultCoach: () => void;
  onOptimizeLinkedIn?: () => void;
}

const InsightsView = ({ visibility, skillRecommendations, profile, onConsultCoach, onOptimizeLinkedIn }: InsightsViewProps) => {
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">Build your profile first</p>
          <p className="text-sm text-muted-foreground mt-1">Insights are generated once your resume or profile is complete.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Visibility Index */}
      {visibility && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Visibility Index</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] text-xs leading-relaxed">
                  How ATS algorithms and recruiters perceive your profile across 6 dimensions — including how likely you are to be found and selected for the specific roles you're targeting.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="rounded-md border border-border bg-card p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div>
                  <div className="text-4xl font-bold tracking-tight">{visibility.totalScore}%</div>
                  <p className="text-sm text-muted-foreground mt-1">Overall visibility score</p>
                </div>
                {/* Role fit likelihood inline indicator */}
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs text-muted-foreground truncate">
                        {visibility.roleFitDetail.targetRoles.length > 0
                          ? `Role fit: ${visibility.roleFitDetail.targetRoles[0]}`
                          : 'Role fit: no target roles set'}
                      </span>
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${
                        visibility.roleFitLikelihood >= 70 ? 'text-emerald-500' :
                        visibility.roleFitLikelihood >= 40 ? 'text-amber-500' : 'text-destructive'
                      }`}>{visibility.roleFitLikelihood}%</span>
                    </div>
                    <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          visibility.roleFitLikelihood >= 70 ? 'bg-emerald-500' :
                          visibility.roleFitLikelihood >= 40 ? 'bg-amber-500' : 'bg-destructive'
                        }`}
                        style={{ width: `${visibility.roleFitLikelihood}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                {visibility.totalScore >= 80 && (
                  <Badge className="text-xs">Top 5%</Badge>
                )}
              </div>
            </div>

            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={visibility.radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: "currentColor", opacity: 0.5, fontSize: 11, fontWeight: 500 }}
                  />
                  <Radar
                    name="Visibility"
                    dataKey="A"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.15}
                    animationDuration={1000}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <Button variant="outline" className="w-full" onClick={onConsultCoach}>
              View AI Analysis
              <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 font-semibold border-primary/30 text-primary">PRO</Badge>
            </Button>
          </div>
        </section>
      )}

      {/* Skill Development */}
      {skillRecommendations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Skill Development</h2>

          <div className="rounded-md border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Based on your recent applications and target roles, here are your highest-impact growth areas.
            </p>

            <div className="space-y-2">
              {skillRecommendations.slice(0, 5).map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="mt-0.5 shrink-0">
                    {rec.type === "certification" ? (
                      <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                        <GraduationCap className="w-3.5 h-3.5 text-primary" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                        <Brain className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{rec.name}</span>
                      {rec.demand_trend === "rising" && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          <TrendingUp className="w-2.5 h-2.5 mr-1" />
                          Rising
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LinkedIn Optimizer */}
      {onOptimizeLinkedIn && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn Profile</h2>
          <div className="rounded-md border border-border bg-card p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Linkedin className="w-5 h-5 text-[#0077B5]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium flex items-center gap-2">
                Optimize your LinkedIn profile
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold border-primary/30 text-primary">PRO</Badge>
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Get AI-powered suggestions to improve your headline, summary, and skills section to attract more recruiter views.
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={onOptimizeLinkedIn}>
              Optimize
            </Button>
          </div>
        </section>
      )}

      {!visibility && !skillRecommendations.length && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Insights loading</p>
            <p className="text-sm text-muted-foreground mt-1">Apply to a few jobs to unlock personalized skill recommendations.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsView;
