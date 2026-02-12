import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorFallbackProps {
    error: Error;
    resetError: () => void;
    showHomeButton?: boolean;
}

export const ErrorFallback = ({ error, resetError, showHomeButton = true }: ErrorFallbackProps) => {
    const isDevelopment = import.meta.env.DEV;

    // Categorize error for better user messaging
    const getErrorCategory = (err: Error): {
        title: string;
        message: string;
        canRetry: boolean;
    } => {
        const errorMsg = err.message.toLowerCase();

        if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
            return {
                title: 'Connection Issue',
                message: 'Unable to connect to the server. Please check your internet connection and try again.',
                canRetry: true
            };
        }

        if (errorMsg.includes('session') || errorMsg.includes('auth') || errorMsg.includes('token')) {
            return {
                title: 'Session Expired',
                message: 'Your session has expired. Please sign out and sign in again.',
                canRetry: false
            };
        }

        if (errorMsg.includes('database') || errorMsg.includes('table')) {
            return {
                title: 'Database Error',
                message: 'There was a problem accessing the database. The development team has been notified.',
                canRetry: true
            };
        }

        return {
            title: 'Something Went Wrong',
            message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
            canRetry: true
        };
    };

    const errorInfo = getErrorCategory(error);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="max-w-md w-full space-y-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{errorInfo.title}</AlertTitle>
                    <AlertDescription className="mt-2">
                        {errorInfo.message}
                    </AlertDescription>
                </Alert>

                {isDevelopment && (
                    <Alert>
                        <AlertTitle className="text-sm font-mono">Debug Info</AlertTitle>
                        <AlertDescription className="mt-2">
                            <pre className="text-xs overflow-auto max-h-40 p-2 bg-muted rounded">
                                {error.stack || error.message}
                            </pre>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex gap-2">
                    {errorInfo.canRetry && (
                        <Button onClick={resetError} className="flex-1">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Try Again
                        </Button>
                    )}
                    {showHomeButton && (
                        <Button
                            variant="outline"
                            onClick={() => window.location.href = '/'}
                            className="flex-1"
                        >
                            <Home className="w-4 h-4 mr-2" />
                            Go Home
                        </Button>
                    )}
                </div>

                <div className="text-center text-sm text-muted-foreground">
                    <p>If this problem continues, please contact support.</p>
                </div>
            </div>
        </div>
    );
};
