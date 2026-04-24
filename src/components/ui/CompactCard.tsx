import React from 'react';
import { cn } from '@/lib/utils';

interface CompactCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'premium' | 'glass' | 'flat';
  size?: 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export const CompactCard = React.memo(({
  children,
  className,
  variant = 'default',
  size = 'md',
  hover = false
}: CompactCardProps) => {
  const variants = {
    default: 'bg-card border border-border/50 rounded-lg shadow-sm',
    premium: 'card-premium',
    glass: 'card-glass',
    flat: 'bg-card/50 border border-border/30 rounded-lg'
  };

  const sizes = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  return (
    <div
      className={cn(
        variants[variant],
        sizes[size],
        hover && 'card-hover',
        'transition-all duration-200',
        className
      )}
    >
      {children}
    </div>
  );
});

CompactCard.displayName = 'CompactCard';

interface CompactCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CompactCardHeader = React.memo(({
  children,
  className
}: CompactCardHeaderProps) => (
  <div className={cn('flex items-center justify-between mb-3', className)}>
    {children}
  </div>
));

CompactCardHeader.displayName = 'CompactCardHeader';

interface CompactCardTitleProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CompactCardTitle = React.memo(({
  children,
  className,
  size = 'md'
}: CompactCardTitleProps) => {
  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <h3 className={cn(
      'font-semibold tracking-tight text-card-foreground',
      sizes[size],
      className
    )}>
      {children}
    </h3>
  );
});

CompactCardTitle.displayName = 'CompactCardTitle';

interface CompactCardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const CompactCardDescription = React.memo(({
  children,
  className
}: CompactCardDescriptionProps) => (
  <p className={cn('text-xs text-muted-foreground', className)}>
    {children}
  </p>
));

CompactCardDescription.displayName = 'CompactCardDescription';

interface CompactCardContentProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'tight' | 'normal' | 'relaxed';
}

export const CompactCardContent = React.memo(({
  children,
  className,
  spacing = 'normal'
}: CompactCardContentProps) => {
  const spacingClasses = {
    tight: 'space-y-2',
    normal: 'space-y-3',
    relaxed: 'space-y-4'
  };

  return (
    <div className={cn(spacingClasses[spacing], className)}>
      {children}
    </div>
  );
});

CompactCardContent.displayName = 'CompactCardContent';

interface CompactCardActionsProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}

export const CompactCardActions = React.memo(({
  children,
  className,
  align = 'right'
}: CompactCardActionsProps) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between'
  };

  return (
    <div className={cn(
      'flex items-center gap-2 mt-4 pt-3 border-t border-border/30',
      alignClasses[align],
      className
    )}>
      {children}
    </div>
  );
});

CompactCardActions.displayName = 'CompactCardActions';