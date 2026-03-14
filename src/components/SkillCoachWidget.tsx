import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResume } from "@/hooks/useResume";
import { useDashboardData } from "@/hooks/useDashboardData";
import { getSkillDevelopmentAdvice, SkillRecommendation } from "@/lib/skill_coach_engine";
import { Brain, GraduationCap, TrendingUp, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const SkillCoachWidget = () => {
  const { profile } = useResume();
  const { applications, jobRecommendations } = useDashboardData();
  const [recommendations, setRecommendations] = useState<SkillRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    getSkillDevelopmentAdvice(profile, applications || [], jobRecommendations || [])
      .then(setRecommendations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile, applications, jobRecommendations]);

  if (loading) {
    return (
      <div className="rounded-md border border-border bg-card p-5 flex items-center justify-center h-24">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  const visible = expanded ? recommendations : recommendations.slice(0, 2);

  return (
    <div className="rounded-md border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Skill Development Coach
          </h3>
        </div>
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide shrink-0">Flagship</Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Highest-impact skills based on your recent applications and target roles.
      </p>

      {/* Recommendations list */}
      <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
        {visible.map((rec, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-card hover:bg-muted/30 transition-colors">
            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
              {rec.type === "certification"
                ? <TrendingUp className="w-3 h-3 text-muted-foreground" />
                : <Brain className="w-3 h-3 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-medium truncate">{rec.name}</span>
                <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                  {rec.demand_trend === "rising" ? "Rising" : "High Demand"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                {rec.rationale}
              </p>
              {rec.latest_certifications?.[0] && (
                <span className="inline-block mt-1.5 text-[10px] border border-border rounded px-1.5 py-0.5 text-muted-foreground">
                  {rec.latest_certifications[0]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      {recommendations.length > 2 && (
        <div className="pt-1 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" />Show less</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" />View {recommendations.length - 2} more growth areas</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SkillCoachWidget;
