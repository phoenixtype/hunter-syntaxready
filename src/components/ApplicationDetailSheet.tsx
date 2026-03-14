import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, StickyNote } from "lucide-react";
import { ApplicationRecord } from "@/lib/application_engine";
import { formatDistanceToNow } from "date-fns";

interface Props {
  app: ApplicationRecord | null;
  open: boolean;
  onClose: () => void;
}

const safeDate = (d: string | null | undefined) => {
  if (!d) return "Unknown";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "Unknown" : formatDistanceToNow(date, { addSuffix: true });
};

export default function ApplicationDetailSheet({ app, open, onClose }: Props) {
  if (!app) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">{app.job_title}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          {/* Company & Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{app.company}</span>
              <Badge variant="outline" className="capitalize">{app.status}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              Applied {safeDate(app.applied_at)}
            </div>
          </div>

          {/* Notes */}
          {app.notes && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <StickyNote className="w-3.5 h-3.5" />
                Notes
              </div>
              <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap">{app.notes}</p>
            </div>
          )}

          {/* Job URL */}
          {app.job_url && (
            <a href={app.job_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <ExternalLink className="w-3.5 h-3.5" />
                View Original Posting
              </Button>
            </a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
