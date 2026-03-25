import RecruiterSidebar from "@/components/recruiter/RecruiterSidebar";

interface RecruiterLayoutProps {
  children: React.ReactNode;
}

const RecruiterLayout = ({ children }: RecruiterLayoutProps) => (
  <div className="flex min-h-screen bg-background text-foreground" data-hide-footer>
    <RecruiterSidebar />
    <div className="flex-1 min-w-0 flex flex-col app-content">{children}</div>
  </div>
);

export default RecruiterLayout;
