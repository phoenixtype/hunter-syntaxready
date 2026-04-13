import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, BrainCircuit, MessageSquare, Swords, HandCoins, RotateCcw, Search, ChevronDown, ChevronUp, ExternalLink, HelpCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SEOHead from "@/components/SEOHead";
import { useAuth } from "@/hooks/useAuth";
import { useResume } from "@/hooks/useResume";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useSubscription } from "@/hooks/useSubscription";
import { parseStoredSession, serializeSession } from "@/lib/interview-session";
import { classifyInvokeError } from "@/lib/invoke-error";
import ProGate from "@/components/ProGate";
import PageTour, { PageTourHandle } from "@/components/PageTour";
import { Step } from "react-joyride";

const INTERVIEW_TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Welcome to Interview Coach — your AI-powered practice partner. Let's walk through how it works.",
    placement: "center",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"ic-role\"]",
    content: "Enter the job title you're preparing for. This lets the AI tailor every question to your target role.",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"ic-research\"]",
    content: "Research likely interview questions sourced from Reddit, Glassdoor, and community forums for your role and company.",
    disableBeacon: true,
  },
  {
    target: "[data-tour=\"ic-modes\"]",
    content: "Choose a practice mode: Behavioral (STAR method), Technical deep-dives, or Negotiation coaching.",
    disableBeacon: true,
  },
];

interface ResearchResult {
  questions: string[];
  patterns: string[];
  insights: string;
  sources: string[];
}

type Message = { role: "user" | "assistant"; content: string };
type Mode = "behavioral" | "technical" | "negotiation";

const MODES: { id: Mode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "behavioral", label: "Behavioral", icon: MessageSquare, desc: "STAR method practice" },
  { id: "technical", label: "Technical", icon: Swords, desc: "Domain-specific deep dive" },
  { id: "negotiation", label: "Negotiation", icon: HandCoins, desc: "Salary & offer practice" },
];

const InterviewCoach = () => {
  useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile } = useResume();

  const [jobTitle, setJobTitle] = useState(searchParams.get("title") || "");
  const [jobCompany, setJobCompany] = useState(searchParams.get("company") || "");
  const jobDescription = searchParams.get("desc") || "";

  // Stable session key — scoped to user + job so sessions don't bleed between roles.
  // Sanitize title/company to strip characters that could corrupt the key or collide.
  const sessionKey = user
    ? `hunter_ic_${user.id}_${jobTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${jobCompany.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    : null;

  const [mode, setMode] = useState<Mode>("behavioral");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tourRef = useRef<PageTourHandle>(null);
  const [showProGate, setShowProGate] = useState(false);

  // Community question research
  const [researching, setResearching] = useState(false);
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [researchExpanded, setResearchExpanded] = useState(true);

  // Restore persisted session on mount (expired sessions are silently discarded)
  useEffect(() => {
    if (!sessionKey) return;
    const session = parseStoredSession(localStorage.getItem(sessionKey));
    if (session) {
      setMessages(session.messages as typeof messages);
      setMode((session.mode as typeof mode) || "behavioral");
      setStarted(true);
    } else if (localStorage.getItem(sessionKey)) {
      // Remove stale/corrupt entry
      localStorage.removeItem(sessionKey);
    }
  }, [sessionKey]);

  // Persist session with timestamp whenever messages change
  useEffect(() => {
    if (!sessionKey || messages.length === 0) return;
    try {
      localStorage.setItem(sessionKey, serializeSession(messages, mode));
    } catch {
      // ignore storage quota errors
    }
  }, [messages, mode, sessionKey]);

  const resetSession = useCallback(() => {
    if (sessionKey) localStorage.removeItem(sessionKey);
    setMessages([]);
    setStarted(false);
    setInput("");
  }, [sessionKey]);

  const researchQuestions = useCallback(async () => {
    if (!jobTitle.trim() && !jobCompany.trim()) {
      toast.error("Enter a role and/or company to research");
      return;
    }
    setResearching(true);
    setResearch(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("interview-coach", {
        body: {
          messages: [],
          job: { title: jobTitle, company: jobCompany },
          mode: "research_questions",
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (error) throw error;
      setResearch(data as ResearchResult);
      setResearchExpanded(true);
    } catch {
      toast.error("Research failed — check your connection and try again");
    } finally {
      setResearching(false);
    }
  }, [jobTitle, jobCompany]);
  
  const { canAccess, isPro, isLoading: subLoading } = useSubscription();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startInterview = async (selectedMode: Mode) => {

    setMode(selectedMode);
    setMessages([]);
    setStarted(true);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("interview-coach", {
        body: {
          messages: [],
          profile: profile,
          job: {
            title: jobTitle,
            company: jobCompany,
            description: jobDescription,
            communityQuestions: research?.questions ?? [],
          },
          mode: selectedMode,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (error) throw error;
      if (data?.message) {
        setMessages([{ role: "assistant", content: data.message }]);
      }
    } catch (err) {
      console.error(err);
      const kind = await classifyInvokeError(err);
      if (kind === "pro_gate") {
        setShowProGate(true);
      } else if (kind === "rate_limit") {
        toast.error("Too many requests", {
          description: "Slow down and try again in a moment.",
        });
      } else if (kind === "timeout") {
        toast.error("Request timed out", {
          description: "The AI took too long. Try again.",
          action: { label: "Retry", onClick: () => startInterview(selectedMode) },
        });
      } else {
        toast.error("Couldn't start session", {
          description: "Check your connection and try again.",
          action: { label: "Retry", onClick: () => startInterview(selectedMode) },
        });
      }
      setStarted(false);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("interview-coach", {
        body: {
          messages: newMessages,
          profile: profile,
          job: {
            title: jobTitle,
            company: jobCompany,
            description: jobDescription,
            communityQuestions: research?.questions ?? [],
          },
          mode,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (error) throw error;
      if (data?.message) {
        setMessages([...newMessages, { role: "assistant", content: data.message }]);
      }
    } catch (err) {
      console.error(err);
      const kind = await classifyInvokeError(err);
      if (kind === "pro_gate") {
        setShowProGate(true);
      } else if (kind === "rate_limit") {
        toast.error("Too many requests", {
          description: "Slow down and try again in a moment.",
        });
      } else if (kind === "timeout") {
        toast.error("Response timed out", {
          description: "The AI took too long. Try a shorter message.",
        });
      } else {
        toast.error("Failed to get response", {
          description: "Check your connection and try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProGate.Page featureLabel="Interview Coach" isPro={isPro} isLoading={subLoading}>
    <ProGate.Dialog open={showProGate} onOpenChange={setShowProGate} featureLabel="Interview Coach" />
    <div className="min-h-screen bg-background text-foreground flex flex-col" data-hide-footer>
      <SEOHead title="Interview Coach" description="Practice interviews with AI-powered coaching and real-time feedback." path="/interview-coach" noIndex />
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Interview Coach" },
        ]}
        icon={<BrainCircuit className="w-4 h-4 text-primary" />}
        actions={
          <div className="flex items-center gap-2">
            {started && (
              <>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {MODES.find(m => m.id === mode)?.label} · {jobTitle}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetSession}
                  className="h-7 px-2 text-xs text-muted-foreground gap-1"
                  title="Start a new session"
                >
                  <RotateCcw className="w-3 h-3" />
                  New Session
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => tourRef.current?.start()} title="Page tour">
              <HelpCircle className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* Content */}
      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-lg mx-auto text-center">
          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mb-6">
            <BrainCircuit className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Interview Practice</h2>
          <p className="text-muted-foreground mb-6">
            Tell us what role you're preparing for, then pick a mode to begin.
          </p>

          {/* Role & Company inputs */}
          <div className="w-full space-y-3 mb-8 text-left">
            <div className="space-y-1.5" data-tour="ic-role">
              <Label className="text-sm font-medium">Your Role</Label>
              <Input
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Product Manager, Data Analyst…"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Target Company <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={jobCompany}
                onChange={e => setJobCompany(e.target.value)}
                placeholder="e.g. Stripe, Google…"
                className="h-10"
              />
            </div>
          </div>

          {/* Research Likely Questions */}
          <div className="w-full" data-tour="ic-research">
            <Button
              variant="outline"
              className="w-full gap-2 h-10 rounded-md border-dashed"
              onClick={researchQuestions}
              disabled={researching || (!jobTitle.trim() && !jobCompany.trim())}
            >
              {researching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {researching ? "Searching Reddit, Glassdoor…" : "Research Likely Questions"}
            </Button>
            {(!jobTitle.trim() && !jobCompany.trim()) && (
              <p className="text-xs text-muted-foreground text-center mt-1.5">Enter a role or company to enable research.</p>
            )}

            {/* Research Results Panel */}
            {research && (
              <div className="mt-3 rounded-md border border-border bg-card text-left overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/40 transition-colors"
                  onClick={() => setResearchExpanded(v => !v)}
                >
                  <span className="flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-primary" />
                    Community Questions
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{research.questions.length} found</Badge>
                  </span>
                  {researchExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>

                {researchExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {research.insights && (
                      <p className="text-xs text-muted-foreground leading-relaxed italic">{research.insights}</p>
                    )}

                    {research.questions.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reported questions</p>
                        {research.questions.map((q, i) => (
                          <div key={i} className="flex gap-2.5 text-sm">
                            <span className="text-primary font-semibold tabular-nums shrink-0 mt-0.5">{i + 1}.</span>
                            <span className="text-foreground leading-snug">{q}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No specific questions found — the AI coach will adapt based on the role.</p>
                    )}

                    {research.patterns.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Process patterns</p>
                        {research.patterns.map((p, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary">•</span>{p}</p>
                        ))}
                      </div>
                    )}

                    {research.sources.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sources</p>
                        <div className="flex flex-wrap gap-1.5">
                          {research.sources.map((src, i) => {
                            let label = "Source";
                            try { label = new URL(src).hostname.replace("www.", ""); } catch { /* ignore */ }
                            return (
                              <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                                {label} <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {research.questions.length > 0 && (
                      <p className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/15 rounded px-3 py-2">
                        These questions will be woven into your practice session automatically when you start.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-3 w-full" data-tour="ic-modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => startInterview(m.id)}
                disabled={!jobTitle.trim()}
                className="flex items-center gap-4 p-4 rounded-md border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <m.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{m.label}</p>
                    {m.id === 'negotiation' && !canAccess('negotiation_coach') && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ">Pro</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
          {!jobTitle.trim() && (
            <p className="text-xs text-muted-foreground mt-3">Enter your role above to unlock practice modes.</p>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
            <div className="max-w-2xl mx-auto space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-md px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-card border border-border rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-md rounded-bl-md px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border p-4 bg-background pb-safe" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="max-w-2xl mx-auto flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer..."
                disabled={loading}
                className="flex-1 h-11"
                autoFocus
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()} className="h-11 w-11 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
    <PageTour ref={tourRef} tourKey="interview_coach" steps={INTERVIEW_TOUR_STEPS} />
    </ProGate.Page>
  );
};

export default InterviewCoach;
