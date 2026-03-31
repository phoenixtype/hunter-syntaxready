/**
 * Standardized Job Card Component
 * Minimal, consistent design across the application
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, DollarSign, Bookmark, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnrichedJob } from "@/hooks/useJobs";
import MatchScoreTooltip from "@/components/MatchScoreTooltip";

interface JobCardProps {
  job: EnrichedJob;
  onClick?: () => void;
  onSave?: () => void;
  onApply?: () => void;
  isSaved?: boolean;
  isApplied?: boolean;
  showActions?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function JobCard({
  job,
  onClick,
  onSave,
  onApply,
  isSaved = false,
  isApplied = false,
  showActions = true,
  size = 'md',
  className
}: JobCardProps) {
  const sizeClasses = {
    sm: "p-3 gap-2",
    md: "p-4 gap-3",
    lg: "p-6 gap-4"
  };

  const titleSizes = {
    sm: "text-sm font-medium",
    md: "text-base font-semibold",
    lg: "text-lg font-bold"
  };

  const postedDate = job.posted_at
    ? (() => {
        try {
          return new Date(job.posted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <Card
      className={cn(
        "group relative flex flex-col bg-card border border-border/50 hover:border-primary/30 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardContent className={cn("flex flex-col", sizeClasses[size])}>
        {/* Header with actions */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <h3 className={cn("leading-tight text-foreground truncate", titleSizes[size])}>
              {job.title || 'Job Title Not Available'}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {job.company || 'Company Not Available'}
            </p>
          </div>

          {/* Quick actions */}
          {showActions && (
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSave}
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                title={isSaved ? "Remove bookmark" : "Save job"}
              >
                <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
              </Button>
            </div>
          )}
        </div>

        {/* Location and details */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          {job.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {job.location}
            </span>
          )}
          {postedDate && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Clock className="h-3.5 w-3.5" />
              {postedDate}
            </span>
          )}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {job.match && (
            <MatchScoreTooltip match={job.match}>
              <Badge variant="secondary" className="text-xs cursor-help bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                {Math.round(job.match.overall_score)}% match
              </Badge>
            </MatchScoreTooltip>
          )}

          {job.salary_range && job.salary_range !== "Not specified" && (
            <Badge variant="outline" className="text-xs gap-1 border-border bg-background">
              <DollarSign className="w-3 h-3 text-muted-foreground" />
              {job.salary_range}
            </Badge>
          )}

          {job.freshness_score > 0.9 && (
            <Badge variant="default" className="text-[10px] px-1.5 uppercase tracking-wider">
              New
            </Badge>
          )}
        </div>

        {/* Skills preview */}
        {job.tech_stack && job.tech_stack.length > 0 && size !== 'sm' && (
          <div className="flex flex-wrap gap-1 mt-2">
            {job.tech_stack.slice(0, 3).map((skill, index) => (
              <span
                key={index}
                className="px-2 py-0.5 text-[10px] bg-muted rounded-md text-muted-foreground border border-border/50"
              >
                {skill}
              </span>
            ))}
            {job.tech_stack.length > 3 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{job.tech_stack.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        {showActions && (onApply || isApplied) && size !== 'sm' && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
            {isApplied ? (
              <Button disabled size="sm" variant="outline" className="flex-1 text-xs h-8">
                Applied
              </Button>
            ) : (
              <Button onClick={onApply} size="sm" className="flex-1 text-xs h-8">
                Apply
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="View details">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}