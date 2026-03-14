import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WidgetErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
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
