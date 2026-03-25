import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ScrollText, LogOut, Building2, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/recruiter-applications', label: 'Recruiter Applications', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/referrals', label: 'Referrals', icon: Gift },
  { to: '/admin/logs', label: 'Audit Logs', icon: ScrollText },
];

const AdminSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0 bg-card border-r border-border">
      {/* Header */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-xs">H</span>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight leading-none">Hunter</p>
          <p className="text-[10px] text-muted-foreground">Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full text-left"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
