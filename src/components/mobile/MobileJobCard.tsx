import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobOpportunity } from "@/lib/crawler_engine";
import { MapPin, Clock, DollarSign, ExternalLink, Heart, Share } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSwipeable } from "react-swipeable";
import { toast } from "sonner";

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
            <h3 className="font-semibold text-lg leading-tight truncate">
              {job.title}
            </h3>
            <p className="text-gray-600 text-base font-medium">
              {job.company}
            </p>
          </div>
          {matchScore && (
            <Badge
              variant={matchScore >= 80 ? "default" : matchScore >= 60 ? "secondary" : "outline"}
              className="ml-2 text-xs"
            >
              {matchScore}% match
            </Badge>
          )}
        </div>

        {/* Job details */}
        <div className="space-y-2 mb-4">
          {job.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{job.location}</span>
            </div>
          )}
          {job.salary_range && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <DollarSign className="w-4 h-4 flex-shrink-0" />
              <span>{job.salary_range}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{job.posted_at || 'Recently posted'}</span>
          </div>
        </div>

        {/* Tech stack */}
        {job.tech_stack && job.tech_stack.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {job.tech_stack.slice(0, 4).map((tech) => (
                <Badge key={tech} variant="outline" className="text-xs">
                  {tech}
                </Badge>
              ))}
              {job.tech_stack.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{job.tech_stack.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Description preview */}
        {job.description && (
          <p className="text-sm text-gray-600 line-clamp-3 mb-4">
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
        <p className="text-xs text-center text-gray-400 mt-3">
          Swipe left to skip • Swipe right to save
        </p>
      </CardContent>
    </Card>
  );
};