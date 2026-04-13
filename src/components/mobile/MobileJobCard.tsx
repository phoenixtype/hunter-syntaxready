import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobOpportunity } from "@/lib/crawler_engine";
import { MapPin, Clock, DollarSign, ExternalLink, Heart, Share } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";
import { toast } from "sonner";
import MatchScoreTooltip from "@/components/MatchScoreTooltip";
import { shouldShowSalary } from "@/lib/job-card-utils";

interface MobileJobCardProps {
  job: JobOpportunity;
  matchScore?: number;
  onApply?: (job: JobOpportunity) => void;
  onSave?: (job: JobOpportunity) => void;
  onSwipeLeft?: (job: JobOpportunity) => void; // Skip/dislike
  onSwipeRight?: (job: JobOpportunity) => void; // Like/save
}

export const MobileJobCard = ({
  job,
  matchScore,
  onApply,
  onSave,
  onSwipeLeft,
  onSwipeRight
}: MobileJobCardProps) => {
  const [isSaved, setIsSaved] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      setSwipeDirection('left');
      setTimeout(() => {
        onSwipeLeft?.(job);
        setSwipeDirection(null);
      }, 150);
    },
    onSwipedRight: () => {
      setSwipeDirection('right');
      setTimeout(() => {
        onSwipeRight?.(job);
        setSwipeDirection(null);
      }, 150);
    },
    onSwiping: (eventData) => {
      const threshold = 50;
      if (eventData.deltaX > threshold) {
        setSwipeDirection('right');
      } else if (eventData.deltaX < -threshold) {
        setSwipeDirection('left');
      } else {
        setSwipeDirection(null);
      }
    },
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  const handleSave = () => {
    setIsSaved(!isSaved);
    onSave?.(job);
    toast.success(isSaved ? "Job removed from saved" : "Job saved!");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${job.title} at ${job.company}`,
        text: `Check out this job opportunity: ${job.title} at ${job.company}`,
        url: job.url || window.location.href
      });
    } else {
      navigator.clipboard.writeText(job.url || window.location.href);
      toast.success("Job link copied to clipboard!");
    }
  };

  return (
    <Card
      {...handlers}
      className={cn(
        "relative overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing",
        swipeDirection === 'left' && "transform -translate-x-4 bg-red-50 border-red-200",
        swipeDirection === 'right' && "transform translate-x-4 bg-green-50 border-green-200"
      )}
    >
      {/* Swipe Indicators */}
      {swipeDirection === 'left' && (
        <div className="absolute inset-0 flex items-center justify-start pl-4 bg-red-100/80 z-10">
          <div className="text-red-600 font-semibold">Skip</div>
        </div>
      )}
      {swipeDirection === 'right' && (
        <div className="absolute inset-0 flex items-center justify-end pr-4 bg-green-100/80 z-10">
          <div className="text-green-600 font-semibold">Save</div>
        </div>
      )}

      <CardContent className="p-4">
        {/* Header with match score */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight truncate text-foreground">
              {job.title || 'Job Title Not Available'}
            </h3>
            <p className="text-muted-foreground text-base font-medium">
              {job.company || 'Company Not Available'}
            </p>
          </div>
          {matchScore && (
            <MatchScoreTooltip match={{ overall_score: matchScore, reasoning: [], skill_match: 0, culture_fit: 0, location_match: 0 }}>
              <Badge variant="secondary" className="ml-2 text-xs cursor-help bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                {Math.round(matchScore)}% match
              </Badge>

            </MatchScoreTooltip>
          )}
        </div>

        {/* Job details */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          {job.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {job.location}
            </span>
          )}
          {job.posted_at && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Clock className="h-3.5 w-3.5" />
              {job.posted_at}
            </span>
          )}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {shouldShowSalary(job.salary_range) && (
            <Badge variant="outline" className="text-xs gap-1 border-border bg-background">
              <DollarSign className="w-3 h-3 text-muted-foreground" />
              {job.salary_range}
            </Badge>
          )}
        </div>

        {/* Skills preview */}
        {job.tech_stack && job.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
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

        {/* Description preview */}
        {job.description && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {job.description}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            onClick={() => onApply?.(job)}
          >
            Apply on Company Site
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSave}
            className={cn(isSaved && "text-red-500 border-red-200")}
          >
            <Heart className={cn("w-4 h-4", isSaved && "fill-current")} />
          </Button>

          <Button variant="outline" size="icon" onClick={handleShare}>
            <Share className="w-4 h-4" />
          </Button>

          {job.url && (
            <Button variant="outline" size="icon" asChild>
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>

        {/* Swipe instructions */}
        <p className="text-xs text-center text-muted-foreground/60 mt-3">
          Swipe left to skip • Swipe right to save
        </p>
      </CardContent>
    </Card>
  );
};