
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
import { UserPreferences } from "@/lib/user_preferences";
import { AlertCircle, CheckCircle, Search, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ATSAuditProps {
    profile: CandidateProfile;
    preferences: UserPreferences | null;
}

const ATSAudit = ({ profile, preferences }: ATSAuditProps) => {
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<ATSResult | null>(null);

    const runAudit = async () => {
        setAnalyzing(true);
        try {
            // Generate a targeted JD based on user preferences
            const roles = preferences?.target_roles?.join(", ") || "Professional";
            const targetJD = `Job Title: ${roles}. Requirements: High proficiency in core domain skills, strong communication, and proven track record of impact.`;

            const data = await analyzeResumeForJob(profile, targetJD);
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
                <Button variant="outline" className="w-full gap-2">
                    <Search className="w-4 h-4" />
                    Run ATS Audit
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-foreground" />
                        ATS Optimization Agent
                    </DialogTitle>
                    <DialogDescription>
                        Analyzing resume against standard market requirements.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-6 py-4">
                    {!result ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
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
                                        <span className="text-2xl font-bold text-foreground">
                                            {result.score}/100
                                        </span>
                                    </div>
                                    <Progress value={result.score} className="h-3" />
                                </div>

                                {/* Recommendations */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium uppercase text-muted-foreground tracking-wider">Analysis</h3>

                                    {result.recommendations.map((rec, i) => (
                                        <div key={i} className="flex gap-3 items-start p-3 rounded-md bg-secondary">
                                            {rec.includes("parsing errors") ? (
                                                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                                            ) : (
                                                <CheckCircle className="w-5 h-5 text-foreground shrink-0 mt-0.5" />
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
                                                <Badge key={k} variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
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
