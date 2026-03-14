import { Sparkles, BarChart3, TrendingUp, Info, Activity, Target } from "lucide-react";
import { VisibilityScore } from "@/lib/visibility_engine";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface VisibilityScoreWidgetProps {
  score: VisibilityScore;
  onConsultCoach: () => void;
}

const VisibilityScoreWidget = ({ score, onConsultCoach }: VisibilityScoreWidgetProps) => {
  const circumference = 100;
  const strokeDasharray = `${(score.totalScore / 100) * circumference} ${circumference}`;

  return (
    <div className="rounded-md border border-border bg-card p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
              Visibility Index
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] p-3 text-xs leading-relaxed">
                  Your visibility index measures how ATS algorithms and recruiters perceive your profile across 6 dimensions — including role fit likelihood: how likely you are to be found and selected for the specific roles you're targeting.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums text-foreground">
              {score.totalScore}%
            </span>
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <TrendingUp className="h-3 w-3" />
              Active
            </span>
          </div>
        </div>

        {/* Score ring */}
        <div className="relative h-16 w-16 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="stroke-muted"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              strokeWidth="3"
            />
            <path
              className="stroke-primary"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              strokeWidth="3"
              strokeDasharray={strokeDasharray}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="60%" data={score.radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 8, fontWeight: 600 }}
            />
            <Radar
              name="Visibility"
              dataKey="A"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
              animationDuration={800}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Role Fit row */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Target className="h-3 w-3" />
          Role fit likelihood
        </span>
        <span className={`font-semibold tabular-nums ${
          score.roleFitLikelihood >= 70 ? 'text-emerald-500' :
          score.roleFitLikelihood >= 40 ? 'text-amber-500' : 'text-destructive'
        }`}>
          {score.roleFitLikelihood}%
        </span>
      </div>

      {/* CTA */}
      <div className="pt-2 border-t border-border space-y-2">
        <Button
          onClick={onConsultCoach}
          className="w-full h-9 text-xs font-medium gap-2"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Open Command Center
        </Button>
        <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
          <BarChart3 className="h-3 w-3" />
          AI analysis active
        </p>
      </div>
    </div>
  );
};

export default VisibilityScoreWidget;
