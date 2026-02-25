import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Link2, Copy, Check, FileText, ClipboardPaste, FileDown } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { optimizeResumeForJobUrl, TailoredContent } from "@/lib/writer_engine";
import { exportResumeToPdf } from "@/lib/pdf_export";
import { toast } from "sonner";

interface JobUrlOptimizerProps {
    isOpen: boolean;
    onClose: () => void;
    profile: CandidateProfile | null;
}

const JobUrlOptimizer = ({ isOpen, onClose, profile }: JobUrlOptimizerProps) => {
    const [inputMode, setInputMode] = useState<"url" | "jd">("url");
    const [jobUrl, setJobUrl] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TailoredContent | null>(null);
    const [copiedSection, setCopiedSection] = useState<string | null>(null);

    const handleOptimize = async () => {
        if (!profile) {
            toast.error("Build your resume first from the Resume Builder.");
            return;
        }

        if (inputMode === "url") {
            if (!jobUrl.trim()) { toast.error("Please enter a job URL."); return; }
            try { new URL(jobUrl); } catch { toast.error("Please enter a valid URL."); return; }
        } else {
            if (!jobDescription.trim() || jobDescription.trim().length < 50) {
                toast.error("Please paste a job description (at least 50 characters).");
                return;
            }
        }

        setLoading(true);
        try {
            const content = await optimizeResumeForJobUrl(
                profile,
                inputMode === "url" ? jobUrl.trim() : "",
                inputMode === "jd" ? jobDescription.trim() : undefined
            );
            setResult(content);
            toast.success("Content optimized for this role!");
        } catch {
            toast.error("Optimization failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (text: string, section: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedSection(section);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedSection(null), 2000);
    };

    const handleReset = () => {
        setResult(null);
        setJobUrl("");
        setJobDescription("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Optimize for Job
                    </DialogTitle>
                </DialogHeader>

                {!result ? (
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Provide a job listing URL or paste the job description directly. We'll generate a tailored resume and cover letter.
                        </p>

                        {/* Input mode toggle */}
                        <div className="flex gap-2">
                            <Button
                                variant={inputMode === "url" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setInputMode("url")}
                                className="gap-1.5"
                            >
                                <Link2 className="w-3.5 h-3.5" />
                                Job URL
                            </Button>
                            <Button
                                variant={inputMode === "jd" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setInputMode("jd")}
                                className="gap-1.5"
                            >
                                <ClipboardPaste className="w-3.5 h-3.5" />
                                Paste JD
                            </Button>
                        </div>

                        {inputMode === "url" ? (
                            <Input
                                value={jobUrl}
                                onChange={(e) => setJobUrl(e.target.value)}
                                placeholder="https://linkedin.com/jobs/view/..."
                                className="h-12"
                                disabled={loading}
                            />
                        ) : (
                            <Textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the full job description here..."
                                className="min-h-[200px] resize-y"
                                disabled={loading}
                            />
                        )}

                        <Button
                            onClick={handleOptimize}
                            disabled={loading || !profile || (inputMode === "url" ? !jobUrl.trim() : jobDescription.trim().length < 50)}
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
                            <p className="text-xs text-muted-foreground">
                                Build your resume first using the Resume Builder tool.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {result.changes_summary.length > 0 && (
                            <div className="bg-secondary border border-border rounded-lg p-3">
                                <h4 className="text-xs font-semibold text-foreground mb-2">Optimizations Applied:</h4>
                                <ul className="space-y-1">
                                    {result.changes_summary.map((change, i) => (
                                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                            <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                                            {change}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <Tabs defaultValue="cover-letter" className="w-full">
                            <div className="flex items-center justify-between">
                                <TabsList>
                                    <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
                                    <TabsTrigger value="resume-tips">Resume Tips</TabsTrigger>
                                </TabsList>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                        if (result && profile) {
                                            exportResumeToPdf(result.resume, result.coverLetter);
                                            toast.success("Download started — use Print → Save as PDF");
                                        }
                                    }}
                                    className="gap-1.5"
                                >
                                    <FileDown className="w-3.5 h-3.5" />
                                    Download PDF
                                </Button>
                            </div>
                            <TabsContent value="cover-letter" className="mt-3">
                                <div className="flex justify-end mb-2">
                                    <Button variant="outline" size="sm" onClick={() => handleCopy(result.coverLetter, "cover")}>
                                        {copiedSection === "cover" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                        {copiedSection === "cover" ? "Copied" : "Copy"}
                                    </Button>
                                </div>
                                <ScrollArea className="h-[40vh] pr-4">
                                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                                        {result.coverLetter}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                            <TabsContent value="resume-tips" className="mt-3">
                                <div className="flex justify-end mb-2">
                                    <Button variant="outline" size="sm" onClick={() => handleCopy(result.changes_summary.join("\n"), "tips")}>
                                        {copiedSection === "tips" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                        {copiedSection === "tips" ? "Copied" : "Copy"}
                                    </Button>
                                </div>
                                <ScrollArea className="h-[40vh] pr-4">
                                    <ul className="space-y-3">
                                        {result.changes_summary.map((tip, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                                <span>{tip}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>

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
