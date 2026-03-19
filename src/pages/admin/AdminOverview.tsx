import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Building2, CheckCircle2, Clock, AlertCircle, CreditCard, TrendingUp } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

interface Stats {
  totalUsers: number;
  pendingApplications: number;
  approvedRecruiters: number;
  totalApplications: number;
  proSubscribers: number;
  freeUsers: number;
  mrr: number;
}

const PRICE_PER_MONTH = 19.99;

const AdminOverview = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [profilesRes, appsRes, subsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('recruiter_applications' as never).select('status'),
          supabase.from('subscriptions').select('tier, status') as Promise<{ data: { tier: string; status: string }[] | null; error: unknown }>,
        ]);

        if (profilesRes.error) throw new Error(profilesRes.error.message);
        if (appsRes.error) throw new Error((appsRes.error as { message: string }).message);

        const apps = (appsRes.data as { status: string }[] | null) ?? [];
        const subs = subsRes.data ?? [];
        const proActive = subs.filter(s => s.tier === 'pro' && s.status === 'active').length;
        const totalUsers = profilesRes.count ?? 0;

        setStats({
          totalUsers,
          pendingApplications: apps.filter(a => a.status === 'pending').length,
          approvedRecruiters: apps.filter(a => a.status === 'approved').length,
          totalApplications: apps.length,
          proSubscribers: proActive,
          freeUsers: totalUsers - proActive,
          mrr: Math.round(proActive * PRICE_PER_MONTH),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      }
    };
    fetchStats();
  }, []);

  if (error) {
    return (
      <div className="p-6 flex items-center gap-3 text-destructive">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const userCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? '—', icon: Users, color: 'text-primary' },
    { label: 'Pending Applications', value: stats?.pendingApplications ?? '—', icon: Clock, color: 'text-amber-500' },
    { label: 'Approved Recruiters', value: stats?.approvedRecruiters ?? '—', icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Total Applications', value: stats?.totalApplications ?? '—', icon: Building2, color: 'text-primary' },
  ];

  const subCards = [
    {
      label: 'Pro Subscribers',
      value: stats?.proSubscribers ?? '—',
      icon: CreditCard,
      color: 'text-amber-500',
    },
    {
      label: 'Free Users',
      value: stats?.freeUsers ?? '—',
      icon: Users,
      color: 'text-muted-foreground',
    },
    {
      label: 'Est. MRR',
      value: stats ? `$${stats.mrr.toLocaleString()}` : '—',
      icon: TrendingUp,
      color: 'text-green-500',
      sub: `${PRICE_PER_MONTH}/user`,
    },
  ];

  return (
    <>
      <SEOHead title="Admin Overview" path="/admin" />
      <div className="p-6 max-w-5xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform health at a glance.</p>
        </div>

        {/* Users & Applications */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Users & Recruitment</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {userCards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-5">
                <div className={`mb-3 ${color}`}><Icon className="w-5 h-5" /></div>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Subscriptions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subscriptions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {subCards.map(({ label, value, icon: Icon, color, sub }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-5">
                <div className={`mb-3 ${color}`}><Icon className="w-5 h-5" /></div>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
                {sub && <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminOverview;
