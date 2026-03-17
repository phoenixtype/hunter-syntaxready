import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ScrollText, AlertCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

interface LogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const AdminLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data, error: qErr } = await supabase
          .from('platform_logs' as never)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (qErr) throw new Error((qErr as { message: string }).message);
        setLogs((data as LogEntry[]) ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <>
      <SEOHead title="Audit Logs" path="/admin/logs" />
      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">Most recent 200 platform actions.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
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
                    <span className="text-muted-foreground"> · {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default AdminLogs;
