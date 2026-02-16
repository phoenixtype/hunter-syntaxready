import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Link2, Copy, Check, FileText } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { optimizeResumeForJobUrl, TailoredContent } from "@/lib/writer_engine";
import { toast } from "sonner";

interface JobUrlOptimizerProps {
    isOpen: boolean;
    onClose: () => void;
    profile: CandidateProfile | null;
}

const JobUrlOptimizer = ({ isOpen, onClose, profile }: JobUrlOptimizerProps) => {
    const [jobUrl, setJobUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TailoredContent | null>(null);
    const [copied, setCopied] = useState(false);

    const handleOptimize = async () => {
        if (!profile) {
            toast.error("Upload your resume first.");
            return;
        }
        if (!jobUrl.trim()) {
            toast.error("Please enter a job URL.");
            return;
        }

        // Basic URL validation
        try {
            new URL(jobUrl);
        } catch {
            toast.error("Please enter a valid URL.");
            return;
        }

        setLoading(true);
        try {
            const content = await optimizeResumeForJobUrl(profile, jobUrl.trim());
            setResult(content);
            toast.success("Resume optimized for this role!");
        } catch {
            toast.error("Optimization failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        await navigator.clipboard.writeText(result.coverLetter);
        setCopied(true);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        setResult(null);
        setJobUrl("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="w-5 h-5" />
                        Optimize Resume for Job
                    </DialogTitle>
                </DialogHeader>

                {!result ? (
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Paste a job listing URL and we'll generate an ATS-optimized resume and cover letter tailored to that specific role.
                        </p>
                        <Input
                            value={jobUrl}
                            onChange={(e) => setJobUrl(e.target.value)}
                            placeholder="https://linkedin.com/jobs/view/..."
                            className="h-12"
                            disabled={loading}
                        />
                        <Button
                            onClick={handleOptimize}
                            disabled={loading || !profile || !jobUrl.trim()}
                            className="w-full"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Analyzing & Optimizing...
                                </>
                            ) : (
                                <>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Generate Optimized Resume & Cover Letter
                                </>
                            )}
                        </Button>
                        {!profile && (
                            <p className="text-xs text-amber-500">Upload your resume first from the dashboard sidebar.</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {result.changes_summary.length > 0 && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">Optimizations Applied:</h4>
                                <ul className="space-y-1">
                                    {result.changes_summary.map((change, i) => (
                                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                            <Check className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                                            {change}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                {copied ? "Copied" : "Copy"}
                            </Button>
                        </div>
                        <ScrollArea className="h-[45vh] pr-4">
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                                {result.coverLetter}
                            </div>
                        </ScrollArea>
                        <Button variant="outline" onClick={handleReset} className="w-full">
                            Optimize Another Job
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default JobUrlOptimizer;
