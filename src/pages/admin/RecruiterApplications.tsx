import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Building2, Mail, Calendar, ExternalLink } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

interface Application {
  id: string;
  full_name: string;
  email: string;
  company_name: string;
  company_website: string | null;
  job_title: string;
  company_size: string | null;
  use_case: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  rejection_reason: string | null;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

const RecruiterApplications = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [acting, setActing] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchApps = async () => {
    setLoading(true);
    const query = supabase
      .from('recruiter_applications' as never)
      .select('*')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load applications');
    } else {
      setApps((data as Application[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, []);

  const callApprove = async (applicationId: string, action: 'approve' | 'reject', reason?: string) => {
    setActing(applicationId);
    try {
      const { data, error } = await supabase.functions.invoke('approve-recruiter', {
        body: { applicationId, action, rejectionReason: reason || undefined },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Action failed');
      toast.success(action === 'approve' ? 'Application approved — email sent.' : 'Application rejected.');
      await fetchApps();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const handleApprove = (id: string) => callApprove(id, 'approve');
  const handleReject = async () => {
    if (!rejectModal) return;
    await callApprove(rejectModal.id, 'reject', rejectionReason);
    setRejectModal(null);
    setRejectionReason('');
  };

  const filtered = filter === 'all' ? apps : apps.filter(a => a.status === filter);

  return (
    <>
      <SEOHead title="Recruiter Applications" path="/admin/recruiter-applications" />
      <div className="p-6 max-w-6xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Recruiter Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">Review and approve access requests from hiring teams.</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 border border-border rounded-lg p-1 bg-muted w-fit">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                filter === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
              {f !== 'all' && (
                <span className="ml-1.5 text-xs">
                  ({apps.filter(a => a.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No {filter !== 'all' ? filter : ''} applications.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(app => (
              <div key={app.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm">{app.full_name}</h3>
                      <Badge variant={STATUS_BADGE[app.status].variant} className="text-[11px]">
                        {STATUS_BADGE[app.status].label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {app.company_name} {app.company_size ? `(${app.company_size})` : ''}</span>
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {app.email}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(app.created_at).toLocaleDateString()}</span>
                      {app.company_website && (
                        <a href={app.company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                          <ExternalLink className="w-3 h-3" /> Website
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1"><span className="font-medium text-foreground">Title:</span> {app.job_title}</p>
                    {app.use_case && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-2xl"><span className="font-medium text-foreground">Use case:</span> {app.use_case}</p>
                    )}
                    {app.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1"><span className="font-medium">Rejection reason:</span> {app.rejection_reason}</p>
                    )}
                  </div>

                  {app.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/20 h-8 text-xs"
                        disabled={acting === app.id}
                        onClick={() => setRejectModal({ id: app.id, name: app.full_name })}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={acting === app.id}
                        onClick={() => handleApprove(app.id)}
                      >
                        {acting === app.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        )}
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-base font-bold mb-1">Reject application</h2>
            <p className="text-sm text-muted-foreground mb-4">Rejecting <strong>{rejectModal.name}</strong>. Optionally add a reason — it will be included in the email.</p>
            <Textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. We are not accepting new recruiters from this region at this time."
              className="resize-none h-24 mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRejectModal(null); setRejectionReason(''); }}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={acting === rejectModal.id}
                onClick={handleReject}
              >
                {acting === rejectModal.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Confirm rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RecruiterApplications;
