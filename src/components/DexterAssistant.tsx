/**
 * Dexter — Hunter's floating AI assistant.
 * Available on all authenticated pages. Provides contextual help,
 * career coaching, resume tips, and negotiation guidance.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Bot, X, Send, Loader2, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useResume } from "@/hooks/useResume";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

// Context-aware quick prompts per route
const QUICK_PROMPTS: Record<string, string[]> = {
  "/dashboard":          ["What jobs should I focus on?", "How can I improve my match score?", "Tips for my job search strategy"],
  "/resume-builder":     ["How do I write strong bullets?", "What makes a resume ATS-friendly?", "Should I use a one-page resume?"],
  "/application-wizard": ["How do I tailor my cover letter?", "What should I include in my application?", "How to stand out for this role?"],
  "/interview-coach":    ["How do I nail the STAR method?", "Tips for salary negotiation", "How to handle a tough interviewer"],
  "/tailored-resumes":   ["How does resume tailoring work?", "What keywords matter most?", "How to improve my ATS score?"],
  "/auto-applier-settings": ["How does auto-apply work?", "What jobs should I target?", "How to optimise my preferences?"],
  "/settings":           ["How do I upgrade to Pro?", "What's included in Pro?"],
};

const DEFAULT_PROMPTS = [
  "How can I land more interviews?",
  "Tips for salary negotiation",
  "How do I improve my resume?",
];

const SYSTEM_PROMPT = `You are Dexter, Hunter's friendly and expert AI career assistant. You help job seekers with:
- Resume writing and ATS optimisation
- Interview preparation (behavioural, technical, negotiation)
- Job search strategy and prioritisation
- Salary negotiation tactics
- Career advice and skill gap analysis

You are warm, concise, and practical. You give specific, actionable advice — not generic tips.
You use markdown for structure when helpful (bullet points, **bold** for emphasis).
Keep responses under 200 words unless the user explicitly asks for more depth.
If the user seems to be looking for a specific Hunter feature, mention it: e.g. "You can use the Interview Coach for a full mock interview."`;

const DexterAssistant = () => {
  const { user } = useAuth();
  const { profile } = useResume();
  const { pathname } = useLocation();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Stop pulse after first open
  useEffect(() => {
    if (open) setPulse(false);
  }, [open]);

  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const quickPrompts = QUICK_PROMPTS[pathname] ?? DEFAULT_PROMPTS;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);

    // Build context-enriched system prompt
    let contextPrompt = SYSTEM_PROMPT;
    if (profile?.identity?.name) {
      contextPrompt += `\n\nCandidate context: ${profile.identity.name}, most recent role: ${profile.experience_atoms?.[0]?.role ?? "unknown"} at ${profile.experience_atoms?.[0]?.company ?? "unknown"}, top skills: ${profile.skills?.slice(0, 5).map(s => s.name).join(", ")}.`;
    }
    contextPrompt += `\nUser is currently on the "${pathname}" page.`;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("interview-coach", {
        body: {
          messages: [
            { role: "system", content: contextPrompt },
            ...history.slice(-10), // keep last 10 turns for context window
          ],
          mode: "chat",
          // No job/profile structured data — pure free-form chat
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (error) throw error;

      const reply = data?.message ?? "Sorry, I couldn't process that. Try again?";
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("[Dexter]", err);
      toast.error("Dexter couldn't respond", { description: "Check your connection and try again." });
      // Remove the user message so they can retry
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, pathname, profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!user) return null;

  return (
    <>
      {/* ── Floating button ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open Dexter AI assistant"
        className={cn(
          "fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95",
          pulse && "animate-pulse"
        )}
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed bottom-20 right-5 z-50 w-[340px] max-w-[calc(100vw-2.5rem)] bg-card border border-border rounded-2xl shadow-xl flex flex-col transition-all duration-200 origin-bottom-right",
          open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ maxHeight: "min(520px, calc(100vh - 6rem))" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Dexter</p>
            <p className="text-[11px] text-muted-foreground">Hunter's AI career coach</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground text-center pt-1">
                Hi{profile?.identity?.name ? `, ${profile.identity.name.split(" ")[0]}` : ""}! I'm Dexter, your AI career coach. Ask me anything.
              </p>
              <div className="space-y-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted/80 text-foreground transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted border border-border rounded-bl-sm"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs dark:prose-invert max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0 [&>ul]:mb-1.5 [&>ul]:pl-3 [&>li]:mb-0.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-xl rounded-bl-sm px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-border shrink-0">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Dexter anything…"
            disabled={loading}
            className="flex-1 h-8 text-xs"
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={loading || !input.trim()}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </>
  );
};

export default DexterAssistant;
