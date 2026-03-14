import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2, Copy, Check, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface SalaryInsightsProps {
  jobTitle: string;
  company: string;
  location?: string;
  salaryRange?: string;
  description?: string;
}

interface SalaryData {
  estimatedRange: string;
  marketPosition: string;
  negotiationScript: string;
  keyPoints: string[];
}

export default function SalaryInsights({ jobTitle, company, location, salaryRange, description }: SalaryInsightsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SalaryData | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error } = await supabase.functions.invoke("salary-insights", {
        body: { jobTitle, company, location, salaryRange, description },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (error) throw error;
      setData(result);
    } catch (err) {
      console.error("Salary insights error:", err);
      toast.error("Failed to generate salary insights");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!data) return;
    const text = `Salary Insights: ${jobTitle} at ${company}\n\nEstimated Range: ${data.estimatedRange}\nMarket Position: ${data.marketPosition}\n\nKey Points:\n${data.keyPoints.map(p => `• ${p}`).join("\n")}\n\nNegotiation Script:\n${data.negotiationScript}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary">
          <DollarSign className="w-3 h-3" />
          Salary Intel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Salary Insights
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{jobTitle} at {company}</p>
        </DialogHeader>

        {!data && !loading && (
          <div className="flex flex-col items-center py-8 gap-4 text-center">
            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">AI-Powered Salary Analysis</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Get estimated compensation ranges, market positioning, and a personalized negotiation script.
              </p>
            </div>
            {salaryRange && (
              <Badge variant="secondary" className="text-xs">
                Listed: {salaryRange}
              </Badge>
            )}
            <Button onClick={handleGenerate} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Insights
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing market data…</p>
          </div>
        )}

        {data && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-2">
              {/* Range & Position */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <DollarSign className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-sm font-bold">{data.estimatedRange}</p>
                  <p className="text-[10px] text-muted-foreground">Estimated Range</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-sm font-bold">{data.marketPosition}</p>
                  <p className="text-[10px] text-muted-foreground">Market Position</p>
                </div>
              </div>

              {/* Key Points */}
              {data.keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Insights</h4>
                  <ul className="space-y-1.5">
                    {data.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-p:leading-snug">
                            <ReactMarkdown>{point}</ReactMarkdown>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Negotiation Script */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Negotiation Script</h4>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{data.negotiationScript}</ReactMarkdown>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 text-xs flex-1">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied" : "Copy All"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleGenerate} className="gap-1.5 text-xs flex-1">
                  <Sparkles className="w-3 h-3" />
                  Regenerate
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
