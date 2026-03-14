import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bot, Zap, Target, Network, ArrowRight, Loader2, Rocket, ShieldCheck, TrendingUp, BarChart3, CheckCircle2, Sparkles } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { VisibilityScore, CoachAdvice, getCoachAdvice } from "@/lib/visibility_engine";
import { useNavigate } from "react-router-dom";
import { SkillRecommendation } from "@/lib/skill_coach_engine";
import { Badge } from "@/components/ui/badge";

interface VisibilityCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CandidateProfile | null;
  score: VisibilityScore | null;
  skillRecommendations: SkillRecommendation[];
}

const VisibilityCoachModal = ({ isOpen, onClose, profile, score, skillRecommendations }: VisibilityCoachModalProps) => {
  const [loading, setLoading] = useState(true);
  const [advice, setAdvice] = useState<CoachAdvice[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && profile && score) {
      const loadAdvice = async () => {
        setLoading(true);
        try {
          const result = await getCoachAdvice(profile, score);
          setAdvice(result);
        } catch (error) {
          console.error("Failed to load coach advice:", error);
        } finally {
          setLoading(false);
        }
      };
      loadAdvice();
    }
  }, [isOpen, profile, score]);

  const getIcon = (type: CoachAdvice['type']) => {
    switch (type) {
      case 'quick_win': return <Zap className="h-4 w-4 text-amber-500" />;
      case 'strategic': return <Target className="h-4 w-4 text-primary" />;
      case 'network': return <Network className="h-4 w-4 text-purple-500" />;
      default: return <Sparkles className="h-4 w-4" />;
    }
  };

  // Derive trending skills from the user's actual profile signals
  const trendingSkills = profile?.skills
    ?.filter(s => {
      const name = s.name.toLowerCase();
      return ['ai', 'llm', 'react', 'typescript', 'python', 'aws', 'rust', 'go', 'kubernetes', 'machine learning', 'devops'].some(h => name.includes(h));
    })
    .slice(0, 6) ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Visibility Command Center</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  AI strategy & analysis for your job search
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden px-6 pt-4">
          <Tabs defaultValue="roadmap" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 h-9 mb-4">
              <TabsTrigger value="roadmap" className="text-xs gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Roadmap
              </TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="text-xs gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Market Info
              </TabsTrigger>
              <TabsTrigger value="growth" className="text-xs gap-1.5">
                <Rocket className="h-3.5 w-3.5" />
                Growth
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 -mr-4 pr-4">
              <div className="pb-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-foreground">Analysing your profile...</p>
                      <p className="text-xs text-muted-foreground">Mapping against current market signals</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Roadmap Tab */}
                    <TabsContent value="roadmap" className="mt-0 outline-none space-y-4">
                      <div className="relative pl-8">
                        {/* Timeline line */}
                        <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

                        {advice.map((item, idx) => (
                          <div key={idx} className="relative mb-4 last:mb-0">
                            {/* Timeline node */}
                            <div className="absolute -left-[18px] top-3.5 h-5 w-5 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            </div>

                            <div className="rounded-md border border-border bg-card p-4 space-y-2 hover:border-primary/30 transition-colors">
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                      Priority {idx + 1}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.type.replace('_', ' ')}</span>
                                  </div>
                                  <h4 className="font-semibold text-sm">{item.title}</h4>
                                </div>
                                <div className="p-1.5 rounded-md bg-muted shrink-0">
                                  {getIcon(item.type)}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                              {item.actionRoute && (
                                <Button
                                  variant="link"
                                  className="h-auto p-0 text-xs font-medium gap-1 text-primary hover:text-primary/80"
                                  onClick={() => { navigate(item.actionRoute!); onClose(); }}
                                >
                                  {item.actionLabel}
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Future placeholder */}
                        <div className="relative opacity-40">
                          <div className="absolute -left-[18px] top-3.5 h-5 w-5 rounded-full border-2 border-muted bg-background flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-muted" />
                          </div>
                          <div className="rounded-md border border-dashed border-border p-4">
                            <p className="text-xs text-muted-foreground italic">More milestones unlock as you complete the steps above.</p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Analysis Tab */}
                    <TabsContent value="analysis" className="mt-0 outline-none space-y-3">
                      {score?.breakdown.map((item, idx) => (
                        <div key={idx} className="rounded-md border border-border bg-card p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">{item.category}</span>
                            <span className="text-sm font-semibold tabular-nums">{item.score}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-700"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.feedback}</p>
                        </div>
                      ))}
                    </TabsContent>

                    {/* Market Info Tab */}
                    <TabsContent value="intelligence" className="mt-0 outline-none space-y-4">
                      {trendingSkills.length > 0 ? (
                        <div className="rounded-md border border-border bg-card p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Rocket className="h-4 w-4 text-primary" />
                            <h4 className="text-sm font-medium">High-demand skills on your profile</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {trendingSkills.map(skill => (
                              <div key={skill.name} className="px-2.5 py-1 rounded-md bg-muted border border-border text-xs font-medium text-foreground flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                {skill.name}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md border border-border">
                            These skills match patterns in high-frequency recruiter searches. Keep them prominent in your summary and experience bullets for maximum ATS visibility.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-md border border-border bg-card p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Rocket className="h-4 w-4 text-muted-foreground" />
                            <h4 className="text-sm font-medium">No high-signal skills detected yet</h4>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Add in-demand skills like TypeScript, React, Python, AWS, or AI/ML to your profile to show up in more recruiter searches.
                          </p>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigate('/resume-builder'); onClose(); }}>
                            Add Skills <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Recommendations from the score engine */}
                      {score && score.recommendations.length > 0 && (
                        <div className="rounded-md border border-border bg-card p-4 space-y-3">
                          <h4 className="text-sm font-medium">Visibility recommendations</h4>
                          <ul className="space-y-2">
                            {score.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </TabsContent>

                    {/* Growth Tab */}
                    <TabsContent value="growth" className="mt-0 outline-none space-y-4">
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <h4 className="text-sm font-semibold">Skill Development Roadmap</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">AI-curated growth paths based on your application history.</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                          Context Aware
                        </Badge>
                      </div>

                      {skillRecommendations.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border p-6 text-center space-y-2">
                          <p className="text-sm text-muted-foreground">No skill recommendations yet.</p>
                          <p className="text-xs text-muted-foreground">Apply to more roles to unlock personalised growth paths.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {skillRecommendations.map((rec, idx) => (
                            <div
                              key={idx}
                              className="rounded-md border border-border bg-card p-4 space-y-3 hover:border-primary/30 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                                    {rec.type === 'certification' ? <ShieldCheck className="h-4 w-4 text-muted-foreground" /> : <Zap className="h-4 w-4 text-muted-foreground" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-medium text-sm">{rec.name}</h5>
                                      <span className="text-[10px] text-muted-foreground uppercase">{rec.type}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase">
                                        <TrendingUp className="h-3 w-3" />
                                        {rec.demand_trend} demand
                                      </span>
                                      <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full" style={{ width: `${rec.relevance_score}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[10px] text-muted-foreground uppercase">Relevance</p>
                                  <p className="text-base font-semibold tabular-nums">{rec.relevance_score}%</p>
                                </div>
                              </div>

                              <p className="text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>

                              {rec.latest_certifications && rec.latest_certifications.length > 0 && (
                                <div className="space-y-1.5 pt-1 border-t border-border">
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Recommended Certifications</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {rec.latest_certifications.map(cert => (
                                      <div key={cert} className="px-2 py-1 rounded-md bg-muted border border-border text-[10px] font-medium text-foreground flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                                        {cert}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </>
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="text-xs font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Strategy deployed
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Maybe Later
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => { navigate("/resume-builder"); onClose(); }}
            >
              Upgrade Profile
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VisibilityCoachModal;
