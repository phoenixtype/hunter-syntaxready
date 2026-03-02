import { Loader2 } from "lucide-react";

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-medium">Loading…</p>
    </div>
  </div>
);

export default PageLoader;
