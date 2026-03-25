import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, AlertCircle, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import SEOHead from '@/components/SEOHead';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  created_at: string;
  plan: string | null;
  plan_status: string | null;
  subscription_id: string | null;
}

const ROLE_OPTIONS = ['candidate', 'recruiter'];
const PLAN_OPTIONS = ['free', 'pro'];

const roleBadge = (role: string | null) => {
  const r = role || 'candidate';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      r === 'recruiter' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
    }`}>
      {r}
    </span>
  );
};

const planBadge = (plan: string | null, status: string | null) => {
  const isPro = plan === 'pro' && status === 'active';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      isPro ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-muted text-muted-foreground'
    }`}>
      {isPro ? 'Pro' : 'Free'}
    </span>
  );
};

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const { adminRole } = useAdmin();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isRootAdmin = adminRole === 'root';

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, created_at')
        .order('created_at', { ascending: false })
        .limit(100) as { data: { id: string; full_name: string | null; email: string | null; role: string | null; created_at: string }[] | null; error: any };

      if (pErr) throw new Error(pErr.message);

      const { data: subs, error: sErr } = await supabase
        .from('subscriptions')
        .select('user_id, tier, status, id') as { data: { user_id: string; tier: string; status: string; id: string }[] | null; error: any };

      if (sErr) throw new Error(sErr.message);

      const subMap = new Map((subs ?? []).map(s => [s.user_id, s]));

      const rows: UserRow[] = (profiles ?? []).map(p => {
        const sub = subMap.get(p.id);
        return {
          ...p,
          plan: sub?.tier ?? null,
          plan_status: sub?.status ?? null,
          subscription_id: sub?.id ?? null,
        };
      });

      setUsers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateRole = async (userId: string, newRole: string) => {
    setUpdating(userId + '-role');
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update role: ' + error.message);
    } else {
      toast.success('Role updated');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
    setUpdating(null);
  };

  const updatePlan = async (user: UserRow, newPlan: string) => {
    setUpdating(user.id + '-plan');

    if (user.subscription_id) {
      // Update existing subscription
      const { error } = await supabase
        .from('subscriptions')
        .update({ tier: newPlan, status: 'active' })
        .eq('id', user.subscription_id);

      if (error) {
        toast.error('Failed to update plan: ' + error.message);
        setUpdating(null);
        return;
      }
    } else {
      // Insert new subscription row
      const { error } = await supabase
        .from('subscriptions')
        .insert({ user_id: user.id, tier: newPlan, status: 'active' });

      if (error) {
        toast.error('Failed to update plan: ' + error.message);
        setUpdating(null);
        return;
      }
    }

    toast.success('Plan updated');
    setUsers(prev => prev.map(u =>
      u.id === user.id ? { ...u, plan: newPlan, plan_status: 'active' } : u
    ));
    setUpdating(null);
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { target_user_id: deleteTarget.id },
    });

    if (error || !data?.success) {
      const msg = error?.message || 'Failed to delete user';
      toast.error(msg);
    } else {
      toast.success('User deleted');
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <>
      <SEOHead title="Users" path="/admin/users" />
      <div className="p-6 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All registered Hunter accounts (most recent 100). Change role or plan directly from here.
          </p>
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
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="w-5 h-5 text-muted-foreground" />}
            title="No users found"
            description="No users match your current search or filter criteria."
          />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className={`border-b border-border last:border-0 ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                    <td className="py-3 px-4 font-medium">{u.full_name || '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{u.email || '—'}</td>
                    <td className="py-3 px-4">{roleBadge(u.role)}</td>
                    <td className="py-3 px-4">{planBadge(u.plan, u.plan_status)}</td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {/* Role selector */}
                        <div className="relative">
                          <select
                            value={u.role || 'candidate'}
                            disabled={updating === u.id + '-role'}
                            onChange={e => updateRole(u.id, e.target.value)}
                            className="appearance-none text-xs bg-muted border border-border rounded-md pl-2 pr-6 py-1 cursor-pointer hover:bg-muted/80 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                        </div>

                        {/* Plan selector */}
                        <div className="relative">
                          <select
                            value={u.plan === 'pro' && u.plan_status === 'active' ? 'pro' : 'free'}
                            disabled={updating === u.id + '-plan'}
                            onChange={e => updatePlan(u, e.target.value)}
                            className="appearance-none text-xs bg-muted border border-border rounded-md pl-2 pr-6 py-1 cursor-pointer hover:bg-muted/80 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                        </div>

                        {/* Delete button — root admins only, hidden on own row */}
                        {isRootAdmin && u.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {updating?.startsWith(u.id) && (
                          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-modal p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-2">Delete User</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Permanently delete <span className="font-medium text-foreground">{deleteTarget.full_name || 'this user'}</span>
              {deleteTarget.email && <> ({deleteTarget.email})</>}? This removes all their data and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteUser}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Deleting…
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminUsers;
