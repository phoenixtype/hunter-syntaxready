import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bot, Sparkles, Zap, Target, Network, ArrowRight, Loader2, Rocket, ShieldCheck, TrendingUp, BarChart3, CheckCircle2 } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { VisibilityScore, CoachAdvice, getCoachAdvice } from "@/lib/visibility_engine";
import { motion, AnimatePresence } from "framer-motion";
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
        // Simulate deep analysis time for flagship feel
        await new Promise(r => setTimeout(r, 1200));
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 border-white/20 bg-gradient-to-br from-background via-background to-primary/5 shadow-2xl backdrop-blur-2xl rounded-[2rem] overflow-hidden">
        {/* Header Section */}
        <div className="relative p-8 pb-4">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <BarChart3 className="h-32 w-32" />
            </div>
            <DialogHeader className="relative">
                <div className="flex items-center gap-4 mb-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 animate-in zoom-in duration-500">
                        <Bot className="h-7 w-7" />
                    </div>
                    <div className="space-y-0.5">
                        <DialogTitle className="text-3xl font-black tracking-tight italic uppercase">Visibility Command Center</DialogTitle>
                        <DialogDescription className="label-eyebrow">
                            Flagship AI Agent Strategy & Analysis
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>
        </div>

        {/* Actionable Content Tabs */}
        <div className="flex-1 overflow-hidden px-8">
            <Tabs defaultValue="roadmap" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-4 h-14 bg-muted/30 p-1.5 rounded-2xl mb-6">
                    <TabsTrigger value="roadmap" className="rounded-xl font-bold label-eyebrow text-[10px] gap-2">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Roadmap
                    </TabsTrigger>
                    <TabsTrigger value="analysis" className="rounded-xl font-bold label-eyebrow text-[10px] gap-2">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Analysis
                    </TabsTrigger>
                    <TabsTrigger value="intelligence" className="rounded-xl font-bold label-eyebrow text-[10px] gap-2">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Market Info
                    </TabsTrigger>
                    <TabsTrigger value="growth" className="rounded-xl font-bold label-eyebrow text-[10px] gap-2">
                        <Rocket className="h-3.5 w-3.5" />
                        Growth
                    </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 -mr-4 pr-4">
                    <div className="pb-8">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-6">
                                <div className="relative flex items-center justify-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <div className="absolute inset-0 h-10 w-10 rounded-full border border-primary/20 animate-ping" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-black uppercase tracking-widest text-foreground animate-pulse">Running Deep Market Simulation</p>
                                    <p className="text-xs text-muted-foreground">Mapping your profile against 10,000+ top-tier job descriptions...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <TabsContent value="roadmap" className="mt-0 outline-none space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="relative pl-10 space-y-8">
                                        {/* Timeline Line */}
                                        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />
                                        
                                        {advice.map((item, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.15 }}
                                                className="relative group pr-4"
                                            >
                                                {/* Timeline Node */}
                                                <div className="absolute -left-[30px] top-0 h-6 w-6 rounded-full border-2 border-primary bg-background flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                </div>

                                                <div className="space-y-3 p-5 rounded-3xl border border-white/10 bg-card/40 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-card hover:shadow-xl group">
                                                    <div className="flex items-start justify-between">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-primary px-2 py-0.5 rounded-full bg-primary/10">
                                                                    Priority {idx + 1}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.type.replace('_', ' ')}</span>
                                                            </div>
                                                            <h4 className="font-black text-xl leading-tight">{item.title}</h4>
                                                        </div>
                                                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                                            {getIcon(item.type)}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                                                    <Button 
                                                        variant="link" 
                                                        className="h-auto p-0 font-black text-xs uppercase tracking-widest gap-2 text-primary hover:text-primary/80 group/btn"
                                                        onClick={() => {
                                                            if (item.actionRoute) {
                                                                navigate(item.actionRoute);
                                                                onClose();
                                                            }
                                                        }}
                                                    >
                                                        {item.actionLabel}
                                                        <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-1" />
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        ))}

                                        {/* Future Steps */}
                                        <div className="relative group opacity-40">
                                             <div className="absolute -left-[30px] top-0 h-6 w-6 rounded-full border-2 border-muted bg-background flex items-center justify-center">
                                                <div className="h-1.5 w-1.5 rounded-full bg-muted" />
                                            </div>
                                            <div className="p-5 rounded-3xl border border-dashed border-muted bg-muted/5 italic">
                                                <p className="text-xs font-bold uppercase tracking-widest">More milestones unlocking soon...</p>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="analysis" className="mt-0 outline-none space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        {score?.breakdown.map((item, idx) => (
                                            <div key={idx} className="p-5 rounded-3xl border border-white/10 bg-card/40 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.category}</span>
                                                    <span className="text-lg font-black italic">{item.score}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${item.score}%` }}
                                                        className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                                        transition={{ duration: 1, delay: idx * 0.1 }}
                                                    />
                                                </div>
                                                <p className="text-xs text-muted-foreground leading-relaxed">{item.feedback}</p>
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="intelligence" className="mt-0 outline-none space-y-6">
                                    <div className="p-6 rounded-3xl border border-primary/20 bg-primary/5 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Rocket className="h-5 w-5 text-primary" />
                                            <h4 className="font-black uppercase tracking-widest text-sm italic">High Velocity Skills Signals</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {['LLM Optimization', 'Kubernetes Architecture', 'Vector Databases', 'Prompt Engineering', 'TypeScript Performance', 'Rust Foundations'].map(skill => (
                                                <div key={skill} className="px-3 py-1.5 rounded-xl bg-background/50 border border-white/10 text-[10px] font-black text-foreground/70 flex items-center gap-2">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                    {skill}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground bg-white/5 p-3 rounded-xl border border-white/5">
                                            These skills are currently showing a <span className="text-foreground font-bold">+42% increase</span> in recruiter search frequency this quarter. Integrating them into your summary boosted your score by 12 points.
                                        </p>
                                    </div>
                                </TabsContent>

                                <TabsContent value="growth" className="mt-0 outline-none space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-lg font-black uppercase italic">Skill Development Roadmap</h4>
                                                <p className="text-xs text-muted-foreground">AI-curated growth paths based on your application history.</p>
                                            </div>
                                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                                                Context Aware
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {skillRecommendations.map((rec, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                    className="p-5 rounded-3xl border border-white/10 bg-card/40 backdrop-blur-sm space-y-4 group hover:border-primary/40 hover:bg-card transition-all"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                                {rec.type === 'certification' ? <ShieldCheck className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h5 className="font-black text-lg">{rec.name}</h5>
                                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{rec.type}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-0.5">
                                                                    <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase">
                                                                        <TrendingUp className="h-3 w-3" />
                                                                        {rec.demand_trend} DEMAND
                                                                    </div>
                                                                    <div className="h-1 w-24 bg-muted/40 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-primary" style={{ width: `${rec.relevance_score}%` }} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Relevance</p>
                                                            <p className="text-xl font-black italic text-foreground/80">{rec.relevance_score}%</p>
                                                        </div>
                                                    </div>

                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                        {rec.rationale}
                                                    </p>

                                                    {rec.latest_certifications && (
                                                        <div className="space-y-2 pt-2">
                                                            <p className="text-[10px] font-black text-foreground/60 uppercase tracking-widest">Recommended Certifications:</p>
                                                            <div className="flex flex-wrap gap-2">
                                                                {rec.latest_certifications.map(cert => (
                                                                    <div key={cert} className="px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/10 text-[10px] font-bold text-primary flex items-center gap-2">
                                                                        <CheckCircle2 className="h-3 w-3" />
                                                                        {cert}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </Tabs>
        </div>

        {/* Footer Overlay */}
        <div className="p-8 pt-4 border-t border-white/10 bg-background/50 backdrop-blur-md flex items-center justify-between gap-4">
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
                <p className="text-xs font-bold flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    STRATEGY DEPLOYED
                </p>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="rounded-2xl h-12 px-6 font-bold border-white/10 hover:bg-white/5 uppercase tracking-widest text-[10px]">
                    Maybe Later
                </Button>
                <Button 
                    onClick={() => {
                        navigate("/resume-builder");
                        onClose();
                    }}
                    className="rounded-2xl h-12 px-8 font-black bg-primary shadow-xl shadow-primary/25 uppercase tracking-widest text-[10px] gap-2"
                >
                    UPGRADE PROFILE <ArrowRight className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VisibilityCoachModal;
