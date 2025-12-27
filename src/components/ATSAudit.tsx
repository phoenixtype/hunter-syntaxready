
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CandidateProfile } from "@/lib/resume_engine";
import { analyzeResumeForJob, ATSResult } from "@/lib/ats_engine";
import { AlertCircle, CheckCircle, Search, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ATSAuditProps {
    profile: CandidateProfile;
}

const ATSAudit = ({ profile }: ATSAuditProps) => {
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<ATSResult | null>(null);

    const runAudit = async () => {
        setAnalyzing(true);
        try {
            // Analyze against a "Generic Full Stack" description for demo purposes
            // In a real flow, this would be per-job
            const genericJD = "Senior Full Stack Engineer. Requirements: React, TypeScript, Node.js, AWS, System Design, CI/CD, Agile.";

            const data = await analyzeResumeForJob(profile, genericJD);
            setResult(data);
            toast.success("Resume processed by ATS Engine.");
        } catch (e) {
            toast.error("Audit failed.");
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 border-primary/20 hover:bg-primary/5">
                    <Search className="w-4 h-4" />
                    Run ATS Audit
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col glass-card">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-primary" />
                        ATS Optimization Agent
                    </DialogTitle>
                    <DialogDescription>
                        Analyzing resume against standard market requirements.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
                    {!result ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
                                <Search className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground text-center max-w-xs">
                                Click below to have the agent scour your resume for keyword gaps and formatting errors.
                            </p>
                            <Button onClick={runAudit} disabled={analyzing} className="w-40">
                                {analyzing ? "Analyzing..." : "Start Audit"}
                            </Button>
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 pr-4">
                            <div className="space-y-8 animate-fade-in">
                                {/* Score Section */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <span className="font-semibold">Visibility Score</span>
                                        <span className={`text-2xl font-bold ${result.score > 80 ? 'text-green-500' : 'text-yellow-500'
                                            }`}>
                                            {result.score}/100
                                        </span>
                                    </div>
                                    <Progress value={result.score} className="h-3" />
                                </div>

                                {/* Recommendations */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium uppercase text-muted-foreground tracking-wider">Analysis</h3>

                                    {result.recommendations.map((rec, i) => (
                                        <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-secondary/30">
                                            {rec.includes("parsing errors") ? (
                                                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                            ) : (
                                                <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                            )}
                                            <p className="text-sm">{rec}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Keyword Gaps */}
                                {result.missing_keywords.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-medium uppercase text-muted-foreground tracking-wider">Missing Keywords</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {result.missing_keywords.map(k => (
                                                <Badge key={k} variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
                                                    {k}
                                                </Badge>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            These keywords appear frequently in your target roles but were not found in your profile.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ATSAudit;
