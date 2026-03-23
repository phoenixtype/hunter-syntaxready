import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageHeader from "@/components/PageHeader";
import SEOHead from "@/components/SEOHead";
import {
    generateThankYouNote,
    generateNegotiationStrategy,
    generateNegotiationScript,
    OfferDetails,
    NegotiationStrategy,
} from "@/lib/post_interview_engine";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Copy, ChevronLeft, ClipboardCheck, HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useResume } from "@/hooks/useResume";
import { useSubscription } from "@/hooks/useSubscription";
import ProGate from "@/components/ProGate";
import PageTour, { PageTourHandle } from "@/components/PageTour";
import { Step } from "react-joyride";

const POST_INTERVIEW_TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Post-Interview Tools help you follow up professionally and negotiate your offer with confidence.",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"pi-tabs\"]",
    content: "Switch between generating a Thank You note after your interview or getting Negotiation coaching for an offer.",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"pi-thankyou\"]",
    content: "Fill in the company name, interviewer, and topics you discussed — the AI will draft a personalised note from your profile.",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"pi-generate\"]",
    content: "Click here to generate your draft. You can edit it before copying.",
    disableBeacon: true,
  },
];

const stripMarkdown = (text: string) =>
    text
        .replace(/\*\*(.+?)\*\*/gs, "$1")
        .replace(/\*(.+?)\*/gs, "$1")
        .replace(/#{1,6}\s+/gm, "")
        .replace(/`(.+?)`/gs, "$1")
        .replace(/\[(.+?)\]\(.+?\)/g, "$1")
        .trim();

const PostInterview = () => {
    const { profile } = useResume();
    const { isPro, isLoading: subLoading } = useSubscription();
    const tourRef = useRef<PageTourHandle>(null);
    const [activeTab, setActiveTab] = useState("thankyou");
    const [loading, setLoading] = useState(false);

    // Thank You Note
    const [company, setCompany] = useState("");
    const [interviewer, setInterviewer] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [topics, setTopics] = useState("");
    const [generatedNote, setGeneratedNote] = useState("");

    // Negotiation Coach
    const [negCompany, setNegCompany] = useState("");
    const [baseSalary, setBaseSalary] = useState("");
    const [equity, setEquity] = useState("");
    const [bonus, setBonus] = useState("");
    const [strategy, setStrategy] = useState<NegotiationStrategy | null>(null);
    const [negPhase, setNegPhase] = useState<"input" | "choose" | "result">("input");
    const [scriptContent, setScriptContent] = useState("");
    const [scriptLoading, setScriptLoading] = useState(false);

    const handleGenerateNote = async () => {
        if (!profile) { toast.error("Build your profile first."); return; }
        setLoading(true);
        try {
            const note = await generateThankYouNote(interviewer, company, jobTitle || "Candidate", topics.split(",").map(t => t.trim()), profile);
            setGeneratedNote(stripMarkdown(note));
            toast.success("Draft generated.");
        } catch {
            toast.error("Failed to generate note.");
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeOffer = async () => {
        if (!profile) { toast.error("Build your profile first."); return; }
        setLoading(true);
        try {
            const offer: OfferDetails = {
                company: negCompany,
                baseSalary: parseInt(baseSalary) || 0,
                equity: equity.trim() || "Not disclosed",
                bonus: bonus.trim() || "Not disclosed",
                benefits: [],
            };
            const strat = await generateNegotiationStrategy(offer, profile);
            setStrategy(strat);
            setNegPhase("choose");
            toast.success("Offer analyzed.");
        } catch {
            toast.error("Failed to analyze offer.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectScript = async (type: "phone" | "email" | "leverage") => {
        setNegPhase("result");
        setScriptContent("");

        if (type === "leverage" && strategy) {
            setScriptContent(strategy.leveragePoints.map((p) => `- ${p}`).join("\n"));
            return;
        }

        if (!strategy) return;
        setScriptLoading(true);
        try {
            const offer: OfferDetails = {
                company: negCompany,
                baseSalary: parseInt(baseSalary) || 0,
                equity: equity.trim() || "Not disclosed",
                bonus: bonus.trim() || "Not disclosed",
                benefits: [],
            };
            const script = await generateNegotiationScript(
                offer,
                profile!,
                type as "phone" | "email",
                strategy.recommendedCounter.replace("Recommended counter: ", "")
            );
            setScriptContent(script);
        } catch {
            toast.error("Failed to generate script.");
        } finally {
            setScriptLoading(false);
        }
    };

    const resetNegotiation = () => {
        setNegPhase("input");
        setStrategy(null);
        setScriptContent("");
    };

    return (
        <ProGate.Page featureLabel="Post-Interview Tools" isPro={isPro} isLoading={subLoading}>
        <div className="min-h-screen bg-background text-foreground flex flex-col" data-hide-footer>
            <SEOHead title="Post-Interview Tools" description="Generate thank-you notes and negotiate offers with AI." path="/post-interview" noIndex />
            <PageHeader
                breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Post-Interview" }]}
                icon={<ClipboardCheck className="w-4 h-4 text-primary" />}
                actions={
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => tourRef.current?.start()} title="Page tour">
                    <HelpCircle className="w-4 h-4" />
                  </Button>
                }
            />

            <main className="flex-1 flex flex-col justify-center p-6 max-w-lg w-full mx-auto">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mb-6">
                        <ClipboardCheck className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Post-Interview Tools</h2>
                    <p className="text-muted-foreground">
                        Send a polished thank-you note or get AI-powered negotiation coaching for your offer.
                    </p>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 shrink-0 mb-6" data-tour="pi-tabs">
                        <TabsTrigger value="thankyou">Thank You Note</TabsTrigger>
                        <TabsTrigger value="negotiation">Negotiation Coach</TabsTrigger>
                    </TabsList>

                    {/* ── Thank You Note ── */}
                    <TabsContent value="thankyou" className="space-y-4">
                        <div className="space-y-2" data-tour="pi-thankyou">
                            <label className="text-sm font-medium">Company</label>
                            <Input placeholder="e.g. Stripe" value={company} onChange={(e) => setCompany(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Interviewer</label>
                                <Input placeholder="e.g. Sarah Connor" value={interviewer} onChange={(e) => setInterviewer(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Job Title</label>
                                <Input placeholder="e.g. Software Engineer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} data-testid="thankyou-jobtitle" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Topics Discussed</label>
                            <Input placeholder="Scalability, Culture" value={topics} onChange={(e) => setTopics(e.target.value)} />
                        </div>

                        <div data-tour="pi-generate">
                        {generatedNote ? (
                            <div className="space-y-3">
                                <label className="text-sm font-medium">Generated Draft</label>
                                <Textarea
                                    className="h-60 font-mono text-sm resize-none"
                                    value={generatedNote}
                                    onChange={(e) => setGeneratedNote(e.target.value)}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setGeneratedNote("")}>Discard</Button>
                                    <Button size="sm" onClick={() => { navigator.clipboard.writeText(generatedNote); toast.success("Copied!"); }}>
                                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                onClick={handleGenerateNote}
                                disabled={loading || !interviewer || !company}
                                className="w-full"
                            >
                                {loading
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Drafting...</>
                                    : <><CheckCircle2 className="w-4 h-4 mr-2" /> Generate Thank You Note</>}
                            </Button>
                        )}
                        </div>
                    </TabsContent>

                    {/* ── Negotiation Coach ── */}
                    <TabsContent value="negotiation" className="space-y-4">
                        {negPhase === "input" && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Company</label>
                                    <Input placeholder="e.g. Stripe" value={negCompany} onChange={(e) => setNegCompany(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Offered Base Salary</label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 120000"
                                        value={baseSalary}
                                        onChange={(e) => setBaseSalary(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium" htmlFor="neg-equity">Equity <span className="text-muted-foreground font-normal">(optional)</span></label>
                                        <Input
                                            id="neg-equity"
                                            placeholder="e.g. 0.5%"
                                            value={equity}
                                            onChange={(e) => setEquity(e.target.value)}
                                            aria-label="Equity"
                                            data-testid="neg-equity"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium" htmlFor="neg-bonus">Bonus <span className="text-muted-foreground font-normal">(optional)</span></label>
                                        <Input
                                            id="neg-bonus"
                                            placeholder="e.g. 10%"
                                            value={bonus}
                                            onChange={(e) => setBonus(e.target.value)}
                                            data-testid="neg-bonus"
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={handleAnalyzeOffer}
                                    disabled={loading || !baseSalary || !negCompany}
                                    className="w-full"
                                >
                                    {loading
                                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing offer...</>
                                        : "Analyze Offer"}
                                </Button>
                            </div>
                        )}

                        {negPhase === "choose" && strategy && (
                            <div className="space-y-4">
                                <div className="rounded-lg bg-muted/50 border border-border p-4">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Recommended Counter</p>
                                    <p className="font-semibold text-base">
                                        {strategy.recommendedCounter.replace("Recommended counter: ", "")}
                                    </p>
                                </div>
                                <p className="text-sm text-muted-foreground">What would you like help with?</p>
                                <div className="space-y-2">
                                    <Button variant="outline" className="w-full justify-start" onClick={() => handleSelectScript("phone")}>
                                        Phone Script
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start" onClick={() => handleSelectScript("email")}>
                                        Email Script
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start" onClick={() => handleSelectScript("leverage")}>
                                        My Leverage Points
                                    </Button>
                                </div>
                                <Button variant="ghost" size="sm" onClick={resetNegotiation} className="text-muted-foreground px-0">
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Start over
                                </Button>
                            </div>
                        )}

                        {negPhase === "result" && (
                            <div className="flex flex-col gap-3">
                                {scriptLoading ? (
                                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">Generating script...</span>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[50vh]">
                                        <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                                            <ReactMarkdown>{scriptContent}</ReactMarkdown>
                                        </div>
                                    </ScrollArea>
                                )}
                                <div className="flex gap-2 shrink-0">
                                    <Button variant="outline" size="sm" onClick={() => setNegPhase("choose")}>
                                        <ChevronLeft className="w-4 h-4 mr-1" /> Back
                                    </Button>
                                    {scriptContent && !scriptLoading && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => { navigator.clipboard.writeText(scriptContent); toast.success("Copied!"); }}
                                        >
                                            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
        <PageTour ref={tourRef} tourKey="post_interview" steps={POST_INTERVIEW_TOUR_STEPS} />
        </ProGate.Page>
    );
};

export default PostInterview;
