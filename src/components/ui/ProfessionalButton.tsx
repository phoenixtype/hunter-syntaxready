import React from 'react';
import { cn } from '@/lib/utils';
import { Button, ButtonProps } from '@/components/ui/button';

interface ProfessionalButtonProps extends ButtonProps {
  compact?: boolean;
  premium?: boolean;
  loading?: boolean;
}

export const ProfessionalButton = React.memo(React.forwardRef<
  HTMLButtonElement,
  ProfessionalButtonProps
>(({
  children,
  className,
  compact = false,
  premium = false,
  loading = false,
  disabled,
  variant = 'default',
  size = 'default',
  ...props
}, ref) => {
  const compactSizes = {
    default: 'px-3 py-1.5 text-sm',
    sm: 'px-2.5 py-1 text-xs',
    lg: 'px-4 py-2 text-sm',
    icon: 'p-1.5'
  };

  const premiumVariants = {
    default: 'button-premium text-primary-foreground',
    secondary: 'bg-gradient-to-r from-secondary to-secondary/80 hover:from-secondary/80 hover:to-secondary/60 text-secondary-foreground border border-border/20',
    outline: 'border-2 border-primary/20 hover:border-primary/40 bg-gradient-to-r from-transparent to-primary/5 hover:from-primary/5 hover:to-primary/10 text-primary',
    ghost: 'hover:bg-gradient-to-r hover:from-muted/60 hover:to-muted/40 text-foreground',
    destructive: 'bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/80 hover:to-destructive/60 text-destructive-foreground'
  };

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      className={cn(
        'font-medium tracking-tight transition-all duration-200 focus-premium',
        compact && compactSizes[size],
        premium && premiumVariants[variant],
        loading && 'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <span className={cn(loading && 'opacity-0')}>{children}</span>
    </Button>
  );
}));

ProfessionalButton.displayName = 'ProfessionalButton';