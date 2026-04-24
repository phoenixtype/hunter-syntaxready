import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingFallbackProps {
  /** Loading message to display */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full screen loading overlay */
  fullScreen?: boolean;
  /** Custom className */
  className?: string;
}

const LoadingFallback = React.memo(({
  message = "Loading...",
  size = 'md',
  fullScreen = false,
  className
}: LoadingFallbackProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center gap-3",
      fullScreen && "h-screen w-full bg-background",
      className
    )}>
      <Loader2 className={cn(
        "animate-spin text-primary",
        sizeClasses[size]
      )} />
      <p className={cn(
        "text-muted-foreground font-medium",
        textSizes[size]
      )} aria-live="polite">
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
});

LoadingFallback.displayName = "LoadingFallback";

export default LoadingFallback;