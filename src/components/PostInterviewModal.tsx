
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { generateThankYouNote, generateNegotiationStrategy, OfferDetails, NegotiationStrategy } from "@/lib/post_interview_engine";
import { toast } from "sonner";
import { MessageSquare, DollarSign, Send, CheckCircle2 } from "lucide-react";
import { CandidateProfile } from "@/lib/resume_engine";

interface PostInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyName?: string;
    profile: CandidateProfile | null;
}

const PostInterviewModal = ({ isOpen, onClose, companyName = "", profile }: PostInterviewModalProps) => {
    const [activeTab, setActiveTab] = useState("thankyou");
    const [loading, setLoading] = useState(false);

    // Thank You Note State
    const [company, setCompany] = useState(companyName);
    const [interviewer, setInterviewer] = useState("");
    const [topics, setTopics] = useState("");
    const [generatedNote, setGeneratedNote] = useState("");

    // Negotiation State
    const [baseSalary, setBaseSalary] = useState("");
    const [strategy, setStrategy] = useState<NegotiationStrategy | null>(null);

    const handleGenerateNote = async () => {
        if (!profile) {
            toast.error("Build your profile first using the Resume Builder.");
            return;
        }
        setLoading(true);
        try {
            const note = await generateThankYouNote(interviewer, company, "Candidate", topics.split(','), profile);
            setGeneratedNote(note);
            toast.success("Draft generated.");
        } catch (e) {
            toast.error("Failed to generate note.");
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateStrategy = async () => {
        if (!profile) {
            toast.error("Build your profile first using the Resume Builder.");
            return;
        }
        setLoading(true);
        try {
            const offer: OfferDetails = {
                company,
                baseSalary: parseInt(baseSalary) || 0,
                equity: "0.5%",
                bonus: "10%",
                benefits: []
            };
            const strat = await generateNegotiationStrategy(offer, profile);
            setStrategy(strat);
            toast.success("Strategy generated.");
        } catch (e) {
            toast.error("Failed to generate strategy.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-light">
                        Post-Interview Command Center
                        {company && <span className="block text-sm text-muted-foreground mt-1">Target: {company}</span>}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="thankyou">Thank You Note</TabsTrigger>
                        <TabsTrigger value="negotiation">Negotiation Coach</TabsTrigger>
                    </TabsList>

                    <TabsContent value="thankyou" className="space-y-4 py-4">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Company Name</label>
                                <Input placeholder="e.g. Stripe, Shopify" value={company} onChange={e => setCompany(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Interviewer Name</label>
                                    <Input placeholder="e.g. Sarah Connor" value={interviewer} onChange={e => setInterviewer(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Key Topics Discussed</label>
                                    <Input placeholder="e.g. Scalability, Team Culture" value={topics} onChange={e => setTopics(e.target.value)} />
                                </div>
                            </div>

                            {generatedNote ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Generated Draft</label>
                                    <Textarea className="h-48 font-mono text-sm" value={generatedNote} onChange={e => setGeneratedNote(e.target.value)} />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setGeneratedNote("")}>Discard</Button>
                                        <Button onClick={() => {
                                            navigator.clipboard.writeText(generatedNote);
                                            toast.success("Copied to clipboard");
                                        }}>
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Copy
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button onClick={handleGenerateNote} disabled={loading || !interviewer || !company}>
                                    {loading ? "Drafting..." : "Generate Thank You Note"}
                                </Button>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="negotiation" className="space-y-4 py-4">
                        {!strategy ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Offer Base Salary ($)</label>
                                    <Input type="number" placeholder="150000" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} />
                                </div>
                                <Button onClick={handleGenerateStrategy} disabled={loading || !baseSalary} className="w-full">
                                    {loading ? "Analyzing Market..." : "Analyze Offer & Strategize"}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <DollarSign className="w-5 h-5 text-foreground" /> Recommended Counter
                                        </CardTitle>
                                        <CardDescription>{strategy.recommendedCounter}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-muted-foreground">Leverage Points</label>
                                            <ul className="list-disc pl-5 text-sm space-y-1">
                                                {strategy.leveragePoints.map((p: string, i: number) => (
                                                    <li key={i}>{p}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-muted-foreground">Negotiation Script</label>
                                            <div className="p-3 bg-muted rounded-xl text-sm italic border border-border">
                                                "{strategy.script}"
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Button variant="outline" onClick={() => setStrategy(null)} className="w-full">Reset Analysis</Button>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

export default PostInterviewModal;
