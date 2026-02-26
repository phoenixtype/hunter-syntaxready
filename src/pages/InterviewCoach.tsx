import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, BrainCircuit, MessageSquare, Swords, HandCoins } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useResume } from "@/hooks/useResume";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useSubscription } from "@/hooks/useSubscription";
import PricingModal from "@/components/PricingModal";

type Message = { role: "user" | "assistant"; content: string };
type Mode = "behavioral" | "technical" | "negotiation";

const MODES: { id: Mode; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "behavioral", label: "Behavioral", icon: MessageSquare, desc: "STAR method practice" },
  { id: "technical", label: "Technical", icon: Swords, desc: "Domain-specific deep dive" },
  { id: "negotiation", label: "Negotiation", icon: HandCoins, desc: "Salary & offer practice" },
];

const InterviewCoach = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile } = useResume();

  const jobTitle = searchParams.get("title") || "Software Engineer";
  const jobCompany = searchParams.get("company") || "Target Company";
  const jobDescription = searchParams.get("desc") || "";

  const [mode, setMode] = useState<Mode>("behavioral");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { canAccess } = useSubscription();
  const [showPricingModal, setShowPricingModal] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startInterview = async (selectedMode: Mode) => {
    if (!canAccess('negotiation_coach')) {
      setShowPricingModal(true);
      return;
    }

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
          job: { title: jobTitle, company: jobCompany, description: jobDescription },
          mode: selectedMode,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (error) throw error;
      if (data?.message) {
        setMessages([{ role: "assistant", content: data.message }]);
      }
    } catch (err) {
      toast.error("Failed to start interview session");
      console.error(err);
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
          job: { title: jobTitle, company: jobCompany, description: jobDescription },
          mode,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (error) throw error;
      if (data?.message) {
        setMessages([...newMessages, { role: "assistant", content: data.message }]);
      }
    } catch (err) {
      toast.error("Failed to get response");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" data-hide-footer>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Interview Coach" },
        ]}
        icon={<BrainCircuit className="w-4 h-4 text-primary" />}
        actions={
          started ? (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {MODES.find(m => m.id === mode)?.label} · {jobTitle}
            </Badge>
          ) : undefined
        }
      />

      {/* Content */}
      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <BrainCircuit className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Interview Practice</h2>
          <p className="text-muted-foreground mb-8">
            Practice for <span className="font-semibold text-foreground">{jobTitle}</span> at{" "}
            <span className="font-semibold text-foreground">{jobCompany}</span>. Choose a mode:
          </p>
          <div className="grid gap-3 w-full">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => startInterview(m.id)}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <m.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
            <div className="max-w-2xl mx-auto space-y-4 pb-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                  <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 bg-background">
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
                className="flex-1"
                autoFocus
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </>
      )}
      <PricingModal 
        isOpen={showPricingModal} 
        onClose={() => setShowPricingModal(false)} 
      />
    </div>
  );
};

export default InterviewCoach;
