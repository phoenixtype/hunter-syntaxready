import AdminSidebar from '@/components/admin/AdminSidebar';

const AdminLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen bg-background text-foreground" data-hide-footer>
    <AdminSidebar />
    <div className="flex-1 min-w-0 flex flex-col app-content">{children}</div>
  </div>
);

export default AdminLayout;
