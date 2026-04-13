import { Navigate, useLocation } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/hooks/useAuth';
import PageLoader from '@/components/PageLoader';

export const RequireRecruiter = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isRecruiter, loading: roleLoading } = useRole(user?.id);
  useLocation();

  if (authLoading || roleLoading) return <PageLoader />;
  if (!isRecruiter) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default RequireRecruiter;
