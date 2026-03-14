import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <div className="w-full max-w-md text-center space-y-6 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-7xl font-extrabold tracking-tight text-primary">404</h1>
          <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
          <p className="text-muted-foreground text-sm">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          {!loading && user ? (
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button className="w-full h-12 rounded-md gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/" className="w-full sm:w-auto">
              <Button className="w-full h-12 rounded-md gap-2">
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            className="w-full sm:w-auto h-12 rounded-md gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
