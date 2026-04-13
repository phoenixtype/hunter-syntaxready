import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ScrollText, AlertCircle, Bug, ExternalLink } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface LogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SentryBug {
  id: string;
  sentry_id: string;
  issue_title: string;
  culprit: string;
  level: string;
  status: string;
  url: string;
  created_at: string;
}

const AdminLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bugs, setBugs] = useState<SentryBug[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch Audit Logs
        const { data: logData, error: logErr } = await supabase
          .from('platform_logs' as never)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (logErr) throw logErr;
        setLogs((logData as LogEntry[]) ?? []);

        // Fetch Sentry Bugs
        const { data: bugData, error: bugErr } = await supabase
          .from('sentry_bugs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (bugErr) {
          console.warn('Sentry bugs table might not be ready yet:', bugErr);
        } else {
          setBugs((bugData as SentryBug[]) ?? []);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <SEOHead title="System Logs & Bugs" path="/admin/logs" />
      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">System Logs & Bugs</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor platform activity and exceptions.</p>
        </div>

        <Tabs defaultValue="logs" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
            <TabsTrigger value="bugs" className="flex items-center gap-2">
              Sentry Bugs 
              {bugs.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 min-w-[20px] justify-center">
                  {bugs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading logs…
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 text-destructive py-8">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <ScrollText className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No logs yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="bg-card border border-border rounded-lg px-4 py-3 text-sm flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{log.action}</span>
                      {log.entity_type && <span className="text-muted-foreground"> · {log.entity_type}</span>}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <span className="text-muted-foreground text-xs block mt-1">
                          {Object.entries(log.metadata).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bugs">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading bugs…
              </div>
            ) : bugs.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg">
                <Bug className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No Sentry bugs reported yet.</p>
                <p className="text-xs mt-1">Bugs will appear here once the Sentry webhook is configured.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bugs.map(bug => (
                  <div key={bug.id} className="bg-card border border-border rounded-lg p-4 text-sm hover:border-primary/50 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={bug.level === 'error' || bug.level === 'fatal' ? 'destructive' : 'outline'}>
                            {bug.level}
                          </Badge>
                          <span className="font-semibold text-base truncate">{bug.issue_title}</span>
                        </div>
                        <p className="text-muted-foreground font-mono text-xs mb-2 truncate">{bug.culprit}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>ID: {bug.sentry_id}</span>
                          <span>First seen: {new Date(bug.created_at).toLocaleString()}</span>
                          <span className="capitalize">Status: {bug.status}</span>
                        </div>
                      </div>
                      {bug.url && (
                        <a 
                          href={bug.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 shrink-0 p-2 rounded-full hover:bg-primary/10 transition-colors"
                          title="View on Sentry"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminLogs;
