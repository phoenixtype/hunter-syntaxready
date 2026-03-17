import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import PageLoader from '@/components/PageLoader';

const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useAdmin();

  if (loading) return <PageLoader />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default RequireAdmin;
