import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Globe,
  Zap,
  LogIn
} from "lucide-react";
import { toast } from "sonner";
import { triggerJobCrawl, getJobCount } from "@/lib/crawler_engine";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface JobCrawlerProps {
  onCrawlComplete?: () => void;
}

const JobCrawler = ({ onCrawlComplete }: JobCrawlerProps) => {
  const { user, loading: authLoading } = useAuth();
  const [crawling, setCrawling] = useState(false);
  const [keywords, setKeywords] = useState("software engineer, full stack, frontend");
  const [sources, setSources] = useState("Y Combinator jobs, LinkedIn software engineer");
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    inserted?: number;
    error?: string;
  } | null>(null);
  const [jobCount, setJobCount] = useState<number | null>(null);
  
  const isAuthenticated = !!user;

  const handleCrawl = async () => {
    setCrawling(true);
    setLastResult(null);
    
    toast.info("Starting job crawl...", {
      description: "Searching across job boards with Firecrawl + AI"
    });

    try {
      const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);
      const sourceList = sources.split(',').map(s => s.trim()).filter(Boolean);

      const result = await triggerJobCrawl(sourceList, keywordList);
      setLastResult(result);

      if (result.success) {
        toast.success(`Crawl complete!`, {
          description: `Found ${result.inserted || 0} new jobs`
        });
        
        // Refresh job count
        const count = await getJobCount();
        setJobCount(count);
        
        // Notify parent to refresh
        onCrawlComplete?.();
      } else {
        toast.error("Crawl failed", {
          description: result.error || "Unknown error occurred"
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to crawl jobs";
      setLastResult({ success: false, error: errorMessage });
      toast.error("Crawl error", { description: errorMessage });
    } finally {
      setCrawling(false);
    }
  };

  // Fetch initial job count
  useState(() => {
    getJobCount().then(setJobCount);
  });

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Job Crawler</CardTitle>
          </div>
          {jobCount !== null && (
            <Badge variant="secondary" className="font-mono">
              {jobCount} jobs indexed
            </Badge>
          )}
        </div>
        <CardDescription>
          Discover jobs from across the web using Firecrawl + AI
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search Keywords */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Search Keywords
          </label>
          <Input
            placeholder="software engineer, full stack, react..."
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={crawling}
            className="text-sm"
          />
        </div>

        {/* Sources */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Job Sources
          </label>
          <Input
            placeholder="Y Combinator, LinkedIn, Greenhouse..."
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            disabled={crawling}
            className="text-sm"
          />
        </div>

        {/* Crawl Button or Login Prompt */}
        {!isAuthenticated && !authLoading ? (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground">
                <LogIn className="w-4 h-4" />
                <span className="text-sm">Sign in to crawl jobs</span>
              </div>
            </div>
            <Button asChild className="w-full" size="lg">
              <Link to="/login">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In to Continue
              </Link>
            </Button>
          </div>
        ) : (
          <Button 
            onClick={handleCrawl} 
            disabled={crawling || authLoading}
            className="w-full"
            size="lg"
          >
            {crawling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Crawling...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Start Crawl
              </>
            )}
          </Button>
        )}

        {/* Progress indicator during crawl */}
        {crawling && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Searching job boards with Firecrawl...</span>
            </div>
            <Progress value={33} className="h-1" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-muted" />
              <span>Normalizing with AI...</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-muted" />
              <span>Storing in database...</span>
            </div>
          </div>
        )}

        {/* Result display */}
        {lastResult && !crawling && (
          <div className={`p-4 rounded-lg border animate-fade-in ${
            lastResult.success 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {lastResult.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-500">Crawl Successful</p>
                    <p className="text-sm text-muted-foreground">
                      Added {lastResult.inserted || 0} new jobs to your feed
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-500">Crawl Failed</p>
                    <p className="text-sm text-muted-foreground">
                      {lastResult.error || "Unknown error"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Info text */}
        <p className="text-xs text-muted-foreground text-center">
          Jobs are deduplicated automatically. Duplicate listings are skipped.
        </p>
      </CardContent>
    </Card>
  );
};

export default JobCrawler;
