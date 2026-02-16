
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateInterviewPrep, InterviewPrepMaterial } from "@/lib/interview_engine";
import { JobOpportunity } from "@/lib/crawler_engine";
import { BrainCircuit, BookOpen, AlertTriangle, Users, Target, Building2, Newspaper } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface InterviewPrepModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: JobOpportunity;
}

const InterviewPrepModal = ({ isOpen, onClose, job }: InterviewPrepModalProps) => {
    const [material, setMaterial] = useState<InterviewPrepMaterial | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastJobId, setLastJobId] = useState<string | null>(null);

    // Reset material when switching jobs
    useEffect(() => {
        if (job && job.id !== lastJobId) {
            setMaterial(null);
            setLastJobId(job.id);
        }
    }, [job, lastJobId]);

    useEffect(() => {
        if (isOpen && job && !material && !loading) {
            let isMounted = true;
            setLoading(true);
            generateInterviewPrep(job)
                .then(data => {
                    if (isMounted) setMaterial(data);
                })
                .catch(() => {
                    if (isMounted) toast.error("Failed to generate prep material");
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
            return () => {
                isMounted = false;
            };
        }
    }, [isOpen, job, material, loading]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col glass-card bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 border-b border-white/5 bg-muted/20">
                    <DialogTitle className="flex items-center gap-3 text-2xl font-light tracking-tight">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <BrainCircuit className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            Intelligence Briefing
                            <span className="block text-sm font-normal text-muted-foreground mt-1">Target: {job.company}</span>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                        <div className="relative w-20 h-20">
                            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-lg font-medium animate-pulse">Gathering Intelligence...</p>
                            <p className="text-sm text-muted-foreground">Analyzing hiring patterns & company news</p>
                        </div>
                    </div>
                ) : material ? (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <Tabs defaultValue="briefing" className="flex-1 flex flex-col">
                            <div className="px-6 border-b border-white/5 bg-muted/20">
                                <TabsList className="bg-transparent border-b-0 h-12 w-full justify-start gap-6 p-0">
                                    <TabsTrigger value="briefing" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-0 font-medium">
                                        Strategic Briefing
                                    </TabsTrigger>
                                    <TabsTrigger value="culture" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-0 font-medium">
                                        Culture & Risks
                                    </TabsTrigger>
                                    <TabsTrigger value="questions" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-0 font-medium">
                                        Question Bank
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-6">
                                    <TabsContent value="briefing" className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        {/* Company Snapshot */}
                                        <section className="grid md:grid-cols-3 gap-6">
                                            <div className="md:col-span-2 space-y-4">
                                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                                    <Building2 className="w-5 h-5 text-sky-500" />
                                                    Company Profile
                                                </h3>
                                                <div className="p-5 rounded-xl bg-card border border-border/50 shadow-sm space-y-4">
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Industry</div>
                                                            <div className="font-medium">{material.company_profile.industry}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Stage</div>
                                                            <div className="font-medium">{material.company_profile.stage}</div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Mission</div>
                                                        <p className="text-sm leading-relaxed">{material.company_profile.mission}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                                    <Newspaper className="w-5 h-5 text-indigo-500" />
                                                    Recent Intel
                                                </h3>
                                                <div className="space-y-3">
                                                    {material.company_profile.recent_news.map((news, i) => (
                                                        <div key={i} className="p-3 text-sm rounded-lg bg-secondary/30 border border-white/5">
                                                            {news}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>

                                        {/* Evaluation Criteria */}
                                        <section className="space-y-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                <Target className="w-5 h-5 text-emerald-500" />
                                                Likely Appraisal Criteria
                                            </h3>
                                            <div className="grid md:grid-cols-3 gap-4">
                                                {material.evaluation_criteria.map((crit, i) => (
                                                    <div key={i} className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="font-medium">{crit.dimension}</div>
                                                            <Badge variant={crit.weight === 'High' ? 'default' : 'secondary'} className="text-[10px]">
                                                                {crit.weight} Priority
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                                            {crit.description}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        {/* Interviewer Profiles */}
                                        <section className="space-y-4">
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                <Users className="w-5 h-5 text-amber-500" />
                                                Interviewer Personas
                                            </h3>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                {material.interviewer_insights.map((person, i) => (
                                                    <div key={i} className="flex gap-4 p-4 rounded-xl bg-gradient-to-br from-card to-background border border-border/50 shadow-sm">
                                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrank-0">
                                                            {person.role[0]}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="font-medium">{person.role}</div>
                                                            <div className="text-xs text-amber-500 font-medium uppercase tracking-wide">{person.name_archetype}</div>
                                                            <p className="text-sm text-muted-foreground mt-2">"{person.tip}"</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    </TabsContent>

                                    <TabsContent value="culture" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-lg font-semibold text-blue-500">
                                                    <BookOpen className="w-5 h-5" /> Official Values
                                                </div>
                                                <div className="grid gap-2">
                                                    {material.company_values.map((val, i) => (
                                                        <div key={i} className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-sm font-medium">
                                                            {val}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-lg font-semibold text-red-500">
                                                    <AlertTriangle className="w-5 h-5" /> Risk Analysis
                                                </div>
                                                <div className="grid gap-2">
                                                    {material.red_flags_to_watch.map((flag, i) => (
                                                        <div key={i} className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-sm text-red-700 dark:text-red-300">
                                                            {flag}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="questions" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-semibold">Technical Review</h3>
                                                <div className="space-y-3">
                                                    {material.technical_questions.map((q, i) => (
                                                        <div key={i} className="p-4 rounded-xl bg-secondary/20 border border-white/5 text-sm leading-relaxed">
                                                            {q}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-semibold">Behavioral & Leadership</h3>
                                                <div className="space-y-3">
                                                    {material.behavioral_questions.map((q, i) => (
                                                        <div key={i} className="p-4 rounded-xl bg-secondary/20 border border-white/5 text-sm leading-relaxed">
                                                            {q}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </div>
                            </ScrollArea>
                        </Tabs>
                    </div>
                ) : null}

                <div className="p-6 pt-4 border-t border-white/5 bg-muted/20 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Dismiss</Button>
                    <Button onClick={() => toast.success("Briefing saved to notes.")} className="bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all">
                        Save to Dossier
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default InterviewPrepModal;
