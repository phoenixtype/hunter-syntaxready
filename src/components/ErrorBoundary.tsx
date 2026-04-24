import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  asyncError: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  private unhandledRejectionHandler: (event: PromiseRejectionEvent) => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      asyncError: null
    };

    // Handle unhandled promise rejections
    this.unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      this.setState({
        hasError: true,
        asyncError: error,
        error: error
      });

      if (this.props.onError) {
        this.props.onError(error, { componentStack: 'Async Error' } as ErrorInfo);
      }

      event.preventDefault(); // Prevent console logging
    };
  }

  public componentDidMount() {
    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);
  }

  public componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console with context
    console.group('🚨 Error Boundary Caught Error');
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();

    // Store error info for debugging
    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send to error tracking service
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      asyncError: null
    });
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use our enhanced ErrorFallback component
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.handleReset}
          showHomeButton={true}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
