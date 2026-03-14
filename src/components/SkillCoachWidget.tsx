import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResume } from "@/hooks/useResume";
import { useDashboardData } from "@/hooks/useDashboardData";
import { getSkillDevelopmentAdvice, SkillRecommendation } from "@/lib/skill_coach_engine";
import { Brain, GraduationCap, TrendingUp, ChevronRight, Loader2 } from "lucide-react";

const SkillCoachWidget = () => {
  const { profile } = useResume();
  const { applications, jobRecommendations } = useDashboardData();
  const [recommendations, setRecommendations] = useState<SkillRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (!profile) return;
      setLoading(true);
      try {
        const advice = await getSkillDevelopmentAdvice(
          profile,
          applications || [],
          jobRecommendations || []
        );
        setRecommendations(advice);
      } catch (error) {
        console.error("Failed to fetch skill advice:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdvice();
  }, [profile, applications, jobRecommendations]);

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 h-48 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            <p className="text-sm text-muted-foreground">Analysing skill gaps...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-semibold">Skill Development Coach</CardTitle>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Flagship</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Based on your recent applications and target roles, we've identified the highest impact growth areas.
        </p>

        <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
          {recommendations.slice(0, 3).map((rec, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="mt-0.5 shrink-0">
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                  {rec.type === 'certification'
                    ? <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    : <Brain className="w-3 h-3 text-muted-foreground" />
                  }
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5 gap-2">
                  <h4 className="text-sm font-medium truncate">{rec.name}</h4>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                    {rec.demand_trend === 'rising' ? 'Rising' : 'High Priority'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {rec.rationale}
                </p>
                {rec.latest_certifications && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {rec.latest_certifications.slice(0, 1).map((cert, cidx) => (
                      <Badge key={cidx} variant="outline" className="text-[10px]">
                        {cert}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full" variant="outline" size="sm">
          View Detailed Growth Plan
          <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default SkillCoachWidget;
