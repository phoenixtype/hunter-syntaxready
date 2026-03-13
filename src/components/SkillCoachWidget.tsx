import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResume } from "@/hooks/useResume";
import { useDashboardData } from "@/hooks/useDashboardData";
import { getSkillDevelopmentAdvice, SkillRecommendation } from "@/lib/skill_coach_engine";
import { Brain, GraduationCap, TrendingUp, ChevronRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
      <Card className="border-border bg-card/50 backdrop-blur-sm shadow-elevated animate-pulse">
        <CardContent className="p-6 h-48 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <Brain className="w-8 h-8 text-muted-foreground animate-bounce" />
                <p className="text-sm text-muted-foreground font-medium">Analyzing skill gaps...</p>
            </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm shadow-elevated hover:border-primary/30 transition-all group relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles className="w-12 h-12 text-primary rotate-12" />
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-lg">Skill Development Coach</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px] uppercase tracking-wider font-bold">Flagship Feature</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Based on your recent applications and target roles, we've identified the highest impact growth areas to boost your visibility.
        </p>

        <div className="space-y-3">
          {recommendations.slice(0, 3).map((rec, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50 hover:border-primary/20 hover:bg-secondary/50 transition-all cursor-default"
            >
              <div className="mt-1">
                {rec.type === 'certification' ? (
                  <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                    <TrendingUp className="w-3 h-3 text-success" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-info/10 flex items-center justify-center">
                    <Brain className="w-3 h-3 text-info" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h4 className="text-sm font-semibold truncate">{rec.name}</h4>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                    rec.demand_trend === 'rising' ? 'text-success border-success/30 bg-success/5' : 'text-primary border-primary/30 bg-primary/5'
                  }`}>
                    {rec.demand_trend === 'rising' ? 'Rising Demand' : 'High Priority'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
                  {rec.rationale}
                </p>
                {rec.latest_certifications && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {rec.latest_certifications.slice(0, 1).map((cert, cidx) => (
                            <Badge key={cidx} variant="outline" className="text-[10px] bg-background/50 border-border/60">
                                🎖️ {cert}
                            </Badge>
                        ))}
                    </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <Button className="w-full mt-2 group shadow-glow hover:shadow-glow-lg transition-all" variant="outline">
          View Detailed Growth Plan
          <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default SkillCoachWidget;
