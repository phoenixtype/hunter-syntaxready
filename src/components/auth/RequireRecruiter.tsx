import { Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import PageLoader from '@/components/PageLoader';

const RequireRecruiter = ({ children }: { children: React.ReactNode }) => {
  const { isRecruiter, loading } = useRole();

  if (loading) return <PageLoader />;
  if (!isRecruiter) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default RequireRecruiter;
