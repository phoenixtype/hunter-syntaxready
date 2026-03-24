import { Navigate } from 'react-router-dom';
import { useAdmin, hasMinRole, type AdminRole } from '@/hooks/useAdmin';
import PageLoader from '@/components/PageLoader';

interface RequireAdminProps {
  children: React.ReactNode;
  /** Minimum role required. Defaults to 'viewer' (any admin). */
  minRole?: AdminRole;
}

const RequireAdmin = ({ children, minRole = 'viewer' }: RequireAdminProps) => {
  const { isAdmin, adminRole, loading } = useAdmin();

  if (loading) return <PageLoader />;
  if (!isAdmin || !hasMinRole(adminRole, minRole)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default RequireAdmin;
