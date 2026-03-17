import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Building2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import SEOHead from '@/components/SEOHead';

interface Stats {
  totalUsers: number;
  pendingApplications: number;
  approvedRecruiters: number;
  totalApplications: number;
}

const AdminOverview = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [profilesRes, appsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('recruiter_applications' as never).select('status'),
        ]);

        if (profilesRes.error) throw new Error(profilesRes.error.message);
        if (appsRes.error) throw new Error((appsRes.error as { message: string }).message);

        const apps = (appsRes.data as { status: string }[] | null) ?? [];
        setStats({
          totalUsers: profilesRes.count ?? 0,
          pendingApplications: apps.filter(a => a.status === 'pending').length,
          approvedRecruiters: apps.filter(a => a.status === 'approved').length,
          totalApplications: apps.length,
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

  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? '—', icon: Users, color: 'text-primary' },
    { label: 'Pending Applications', value: stats?.pendingApplications ?? '—', icon: Clock, color: 'text-amber-500' },
    { label: 'Approved Recruiters', value: stats?.approvedRecruiters ?? '—', icon: CheckCircle2, color: 'text-green-500' },
    { label: 'Total Applications', value: stats?.totalApplications ?? '—', icon: Building2, color: 'text-primary' },
  ];

  return (
    <>
      <SEOHead title="Admin Overview" path="/admin" />
      <div className="p-6 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Admin Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Platform health at a glance.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-5">
              <div className={`mb-3 ${color}`}><Icon className="w-5 h-5" /></div>
              <div className="text-2xl font-bold tracking-tight">{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default AdminOverview;
