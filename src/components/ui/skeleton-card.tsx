import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
}

const shimmerClass =
  "rounded-md bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer";

/**
 * Single stat card skeleton — matches the shape of admin stat cards.
 * Uses shimmer animation. Uses plain divs to avoid shadcn Skeleton's
 * animate-pulse conflicting with animate-shimmer.
 */
export const SkeletonCard = ({ className }: SkeletonCardProps) => (
  <div
    className={cn(
      "rounded-xl border bg-card shadow-card p-5 flex flex-col gap-3",
      className
    )}
  >
    {/* Eyebrow label */}
    <div className={cn(shimmerClass, "h-3 w-2/5")} />
    {/* Stat number */}
    <div className={cn(shimmerClass, "h-8 w-1/3")} />
    {/* Sub-label */}
    <div className={cn(shimmerClass, "h-3 w-3/5")} />
  </div>
);
