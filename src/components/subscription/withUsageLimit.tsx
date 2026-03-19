import React, { ComponentType } from 'react';
import { UsageGuard } from './UsageGuard';
import { FeatureName } from '@/types/subscription';

interface WithUsageLimitOptions {
  featureName: FeatureName;
  requiredCount?: number;
  showInlineWarnings?: boolean;
  blockOnLimit?: boolean;
}

interface WithUsageLimitInjectedProps {
  onUsageAttempt?: () => void;
  usageBlocked?: boolean;
}

/**
 * Higher-order component that adds usage limit enforcement to any component
 */
export function withUsageLimit<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithUsageLimitOptions
) {
  const {
    featureName,
    requiredCount = 1,
    showInlineWarnings = true,
    blockOnLimit = true
  } = options;

  const WithUsageLimitComponent = (props: P & WithUsageLimitInjectedProps) => {
    const { onUsageAttempt, ...restProps } = props;

    if (blockOnLimit) {
      return (
        <UsageGuard
          featureName={featureName}
          requiredCount={requiredCount}
          showInlineWarnings={showInlineWarnings}
          onUsageBlocked={onUsageAttempt}
        >
          <WrappedComponent {...(restProps as P)} />
        </UsageGuard>
      );
    }

    // If not blocking, just render the component normally
    // You could add usage tracking here if needed
    return <WrappedComponent {...(restProps as P)} />;
  };

  WithUsageLimitComponent.displayName = `withUsageLimit(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithUsageLimitComponent;
}

// Convenience wrapper for common usage patterns
export const createUsageLimitedComponent = <P extends object>(
  Component: ComponentType<P>,
  featureName: FeatureName,
  options?: Partial<WithUsageLimitOptions>
) => {
  return withUsageLimit(Component, {
    featureName,
    ...options
  });
};

// Usage examples and helper functions:

// Example: Create a usage-limited button
export const createLimitedButton = (featureName: FeatureName, requiredCount = 1) =>
  withUsageLimit<React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }) => <button {...props}>{children}</button>,
    { featureName, requiredCount }
  );

// Example: Create a usage-limited form
export const createLimitedForm = (featureName: FeatureName) =>
  withUsageLimit<React.FormHTMLAttributes<HTMLFormElement>>(
    ({ children, ...props }) => <form {...props}>{children}</form>,
    { featureName }
  );

// Example: Usage-limited action wrapper
interface ActionWrapperProps {
  children: React.ReactNode;
  onAction: () => void;
  className?: string;
}

export const createLimitedAction = (featureName: FeatureName, requiredCount = 1) =>
  withUsageLimit<ActionWrapperProps>(
    ({ children, onAction, className, ...props }) => (
      <div
        className={`cursor-pointer ${className || ''}`}
        onClick={onAction}
        {...props}
      >
        {children}
      </div>
    ),
    { featureName, requiredCount }
  );

export default withUsageLimit;