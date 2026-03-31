import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WidgetErrorBoundary caught an error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    // Also log to help debug
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 min-h-[200px] text-center space-y-4 rounded-md border border-dashed border-destructive/30 bg-destructive/5">
          <div className="p-2 rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-medium text-sm">Widget Unavailable</h3>
            <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
              This section is temporarily down. Your data is safe.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-2 text-left">
                <summary className="text-xs cursor-pointer text-muted-foreground">Debug Info</summary>
                <div className="mt-1 p-2 bg-muted rounded text-xs font-mono text-left overflow-auto max-h-20">
                  <p><strong>Error:</strong> {this.state.error.message}</p>
                  <p><strong>Type:</strong> {this.state.error.name}</p>
                </div>
              </details>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={this.handleRetry}
            className="h-7 text-xs"
          >
            <RefreshCcw className="w-3 h-3 mr-2" />
            Reload Widget
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
