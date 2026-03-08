import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TailoredContent } from "@/lib/writer_engine";
import { exportResumeToPdf, exportResumeToDocx } from "@/lib/pdf_export";
import { toast } from "sonner";
import {
    FileText, Check, Copy, ChevronDown, ChevronUp,
    Building2, Loader2, FileDown
} from "lucide-react";

interface TailorResultSheetProps {
    open: boolean;
    onClose: () => void;
    content: TailoredContent | null;
    job: { title: string; company: string } | null;
}

const TailorResultSheet = ({ open, onClose, content, job }: TailorResultSheetProps) => {
    const [showCoverLetter, setShowCoverLetter] = useState(false);
    const [copied, setCopied] = useState(false);
    const [downloadingDocx, setDownloadingDocx] = useState(false);
    const [onePagePdf, setOnePagePdf] = useState(false);

    if (!content || !job) return null;

    const safeName = `${job.title}_${job.company}`.replace(/[^a-z0-9_]/gi, "_");

    const handlePdf = async () => {
        await exportResumeToPdf(content.resume, `${safeName}_resume.pdf`, { onePage: onePagePdf });
        toast.success("PDF downloaded");
    };

    const handleDocx = async () => {
        setDownloadingDocx(true);
        try {
            await exportResumeToDocx(content.resume, `${safeName}_resume.docx`);
            toast.success("Word document downloaded");
        } finally {
            setDownloadingDocx(false);
        }
    };

    const handleCopyCoverLetter = async () => {
        await navigator.clipboard.writeText(content.coverLetter);
        setCopied(true);
        toast.success("Cover letter copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Sheet open={open} onOpenChange={onClose}>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
                <SheetHeader className="text-left pt-2 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <SheetTitle className="text-lg leading-tight">Resume optimized</SheetTitle>
                        <Badge variant="secondary" className="gap-1 font-normal">
                            <Building2 className="w-3 h-3" />
                            {job.title} · {job.company}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Your resume has been tailored for this role. Download it below.
                    </p>
                </SheetHeader>

                {/* Optimizations summary */}
                {content.changes_summary.length > 0 && (
                    <div className="mb-5 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            What was optimized
                        </p>
                        <div className="space-y-1.5">
                            {content.changes_summary.map((change, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                    <Check className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                    <span className="text-muted-foreground">{change}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 1-page toggle */}
                <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none w-fit">
                    <div
                        onClick={() => setOnePagePdf(v => !v)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${onePagePdf ? "bg-primary" : "bg-muted-foreground/30"}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background shadow-sm transition-transform ${onePagePdf ? "translate-x-4" : "translate-x-0"}`} />
                    </div>
                    <span className="text-sm text-muted-foreground">Fit to 1 page</span>
                </label>

                {/* Download buttons */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                    <Button onClick={handlePdf} className="gap-2 h-12">
                        <FileText className="w-4 h-4" />
                        Download PDF
                    </Button>
                    <Button variant="outline" onClick={handleDocx} disabled={downloadingDocx} className="gap-2 h-12">
                        {downloadingDocx
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <FileDown className="w-4 h-4" />
                        }
                        {downloadingDocx ? "Exporting..." : "Download DOCX"}
                    </Button>
                </div>

                {/* Cover letter collapsible */}
                <div className="border border-border rounded-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowCoverLetter(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors"
                    >
                        <span>Cover Letter</span>
                        <div className="flex items-center gap-2">
                            {showCoverLetter && (
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); handleCopyCoverLetter(); }}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
                                >
                                    {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            )}
                            {showCoverLetter
                                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            }
                        </div>
                    </button>
                    {showCoverLetter && (
                        <div className="px-4 pb-4 pt-1 border-t border-border">
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                                {content.coverLetter}
                            </pre>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default TailorResultSheet;
