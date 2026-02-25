import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Linkedin, Copy, Check } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";
import { JobOpportunity } from "@/lib/crawler_engine";
import { generateLinkedInOptimization } from "@/lib/writer_engine";
import { toast } from "sonner";

interface LinkedInOptimizerProps {
    isOpen: boolean;
    onClose: () => void;
    profile: CandidateProfile | null;
    job?: JobOpportunity | null;
}

const LinkedInOptimizer = ({ isOpen, onClose, profile, job }: LinkedInOptimizerProps) => {
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string>("");
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!profile) {
            toast.error("Build your profile first using the Resume Builder.");
            return;
        }

        const targetJob: JobOpportunity = job || {
            id: 'general',
            title: profile.experience_atoms?.[0]?.role || 'Professional',
            company: 'Target Companies',
            location: '',
            salary_range: '',
            description: `Looking for roles matching: ${profile.skills.slice(0, 5).map(s => s.name).join(', ')}`,
            source: 'Direct',
            freshness_score: 1,
            credibility_score: 1,
            url: '',
            posted_at: ''
        };

        setLoading(true);
        try {
            const result = await generateLinkedInOptimization(profile, targetJob);
            setSuggestions(result);
        } catch {
            toast.error("Failed to generate LinkedIn suggestions. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(suggestions);
        setCopied(true);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Linkedin className="w-5 h-5 text-foreground" />
                        LinkedIn Profile Optimizer
                    </DialogTitle>
                </DialogHeader>

                {!suggestions ? (
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Get AI-powered suggestions to optimize your LinkedIn profile for better recruiter visibility.
                            {job && ` Tailored for: ${job.title} at ${job.company}`}
                        </p>
                        <Button
                            onClick={handleGenerate}
                            disabled={loading || !profile}
                            className="w-full"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Analyzing profile...
                                </>
                            ) : (
                                <>
                                    <Linkedin className="w-4 h-4 mr-2" />
                                    Generate Optimization Suggestions
                                </>
                            )}
                        </Button>
                        {!profile && (
                            <p className="text-xs text-muted-foreground">Build your profile first using the Resume Builder in the Tools section.</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                {copied ? "Copied" : "Copy All"}
                            </Button>
                        </div>
                        <ScrollArea className="h-[50vh] pr-4">
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                                {suggestions}
                            </div>
                        </ScrollArea>
                        <Button variant="outline" onClick={() => setSuggestions("")} className="w-full">
                            Regenerate
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default LinkedInOptimizer;
