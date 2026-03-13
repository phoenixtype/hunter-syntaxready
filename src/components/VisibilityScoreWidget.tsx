import { motion } from "framer-motion";
import { Sparkles, BarChart3, TrendingUp, Info, Activity } from "lucide-react";
import { VisibilityScore } from "@/lib/visibility_engine";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface VisibilityScoreWidgetProps {
  score: VisibilityScore;
  onConsultCoach: () => void;
}

const VisibilityScoreWidget = ({ score, onConsultCoach }: VisibilityScoreWidgetProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background p-6 shadow-2xl backdrop-blur-xl group"
    >
      {/* Background Glows */}
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl group-hover:bg-primary/30 transition-all duration-700" />
      <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl" />
      
      <div className="relative flex items-center justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-black tracking-widest text-foreground/60 flex items-center gap-1.5 uppercase">
              Visibility Index
            </h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px] p-3 text-xs leading-relaxed bg-background/95 backdrop-blur-md border-white/20 shadow-xl">
                  Your visibility index is a deep AI measurement of how ATS algorithms and elite recruiters perceive your profile strength across 5 dimensions.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tighter bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent italic">
              {score.totalScore}%
            </span>
            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <TrendingUp className="h-3 w-3" />
              TOP 5%
            </span>
          </div>
        </div>

        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border border-primary/10 animate-ping opacity-25" />
          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="stroke-muted/10"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              strokeWidth="4"
            />
            <motion.path
              className="stroke-primary"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: score.totalScore / 100 }}
              transition={{ duration: 2, ease: "circOut" }}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              strokeWidth="4"
              strokeDasharray="100, 100"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
             <Activity className="h-6 w-6 text-primary/30" />
          </div>
        </div>
      </div>

      {/* Radar Chart Section */}
      <div className="h-[180px] w-full mt-2 -mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="60%" data={score.radarData}>
            <PolarGrid stroke="#88888820" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: 'currentColor', opacity: 0.4, fontSize: 8, fontWeight: 700 }} 
            />
            <Radar
              name="Visibility"
              dataKey="A"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              animationDuration={1500}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-6 border-t border-border/40">
        <Button 
          onClick={onConsultCoach}
          className="w-full h-11 text-xs font-black gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 group/btn rounded-2xl transition-all hover:scale-[1.02]"
        >
          <Sparkles className="h-4 w-4 animate-pulse group-hover/btn:rotate-12 transition-transform" />
          COMMAND CENTER
        </Button>
        <p className="mt-3 text-[10px] text-center text-muted-foreground font-medium flex items-center justify-center gap-1.5 opacity-60">
            <BarChart3 className="h-3 w-3" />
            AI ANALYSIS ACTIVE
        </p>
      </div>
    </motion.div>
  );
};

export default VisibilityScoreWidget;
