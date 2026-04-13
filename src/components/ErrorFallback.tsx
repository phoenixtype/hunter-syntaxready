import { AlertCircle, RefreshCw, Home, WifiOff, LogIn, Database, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { logger } from "@/utils/logger";

interface ErrorFallbackProps {
    error: Error;
    resetError: () => void;
    showHomeButton?: boolean;
}

interface ErrorCategory {
    title: string;
    message: string;
    guidance: string;
    canRetry: boolean;
    icon: LucideIcon;
}

const getErrorCategory = (err: Error): ErrorCategory => {
    const msg = err.message.toLowerCase();
    const name = err.name.toLowerCase();

    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('networkerror')) {
        return {
            title: "No Internet Connection",
            message: "Hunter couldn't reach our servers.",
            guidance: "Check your Wi-Fi or mobile data, then try again.",
            canRetry: true,
            icon: WifiOff,
        };
    }

    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
        return {
            title: "Request Timed Out",
            message: "The server took too long to respond.",
            guidance: "This is usually temporary. Wait a moment and try again.",
            canRetry: true,
            icon: Clock,
        };
    }

    if (msg.includes('session') || msg.includes('token') || msg.includes('jwt') || msg.includes('unauthorized') || msg.includes('401') || name.includes('auth')) {
        return {
            title: "Session Expired",
            message: "Your login session has expired.",
            guidance: "Sign out and sign back in to continue where you left off.",
            canRetry: false,
            icon: LogIn,
        };
    }

    if (msg.includes('not authenticated') || msg.includes('unauthenticated') || msg.includes('not logged in')) {
        return {
            title: "You're Not Signed In",
            message: "This page requires an active account.",
            guidance: "Please sign in to access Hunter.",
            canRetry: false,
            icon: LogIn,
        };
    }

    if (msg.includes('database') || msg.includes('table') || msg.includes('relation') || msg.includes('postgres') || msg.includes('supabase')) {
        return {
            title: "Data Unavailable",
            message: "Hunter couldn't load your data right now.",
            guidance: "This is a temporary issue on our end. Try refreshing — your data is safe.",
            canRetry: true,
            icon: Database,
        };
    }

    if (msg.includes('checkout') || msg.includes('stripe') || msg.includes('payment') || msg.includes('billing') || msg.includes('subscription')) {
        return {
            title: "Billing Service Unavailable",
            message: "We couldn't connect to the payment processor.",
            guidance: "Your account and data are unaffected. Try again in a moment, or contact support if the issue persists.",
            canRetry: true,
            icon: CreditCard,
        };
    }

    if (msg.includes('chunk') || msg.includes('dynamically imported module') || msg.includes('loading css chunk')) {
        return {
            title: "Update Available",
            message: "Hunter was updated while you were using it.",
            guidance: "Refresh the page to load the latest version.",
            canRetry: true,
            icon: RefreshCw,
        };
    }

    // ReferenceError, TypeError, SyntaxError — code-level bugs; never expose technical names
    if (name.includes('referenceerror') || name.includes('typeerror') || name.includes('syntaxerror')) {
        return {
            title: "Unexpected App Error",
            message: "Something in Hunter ran into a problem.",
            guidance: "Refreshing the page usually fixes this. If it keeps happening, please contact support.",
            canRetry: true,
            icon: AlertCircle,
        };
    }

    return {
        title: "Something Went Wrong",
        message: "An unexpected error occurred in Hunter.",
        guidance: "Try refreshing the page. If this keeps happening, contact support and we'll investigate.",
        canRetry: true,
        icon: AlertCircle,
    };
};

export const ErrorFallback = ({ error, resetError, showHomeButton = true }: ErrorFallbackProps) => {
    const isDevelopment = import.meta.env.DEV;
    const category = getErrorCategory(error);
    const Icon = category.icon;

    useEffect(() => {
        // Send the unhandled error explicitly to Sentry via our unified logger
        logger.error(error, {
            context: 'ErrorFallback',
            category: category.title
        });
    }, [error, category.title]);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="max-w-md w-full space-y-4">
                <Alert variant="destructive">
                    <Icon className="h-4 w-4" />
                    <AlertTitle>{category.title}</AlertTitle>
                    <AlertDescription className="mt-2 space-y-1">
                        <p>{category.message}</p>
                        <p className="text-sm opacity-90">{category.guidance}</p>
                    </AlertDescription>
                </Alert>

                {isDevelopment && (
                    <Alert>
                        <AlertTitle className="text-sm font-mono">
                            Debug — {error.name}
                        </AlertTitle>
                        <AlertDescription className="mt-2">
                            <pre className="text-xs overflow-auto max-h-40 p-2 bg-muted rounded whitespace-pre-wrap break-words">
                                {error.stack || error.message}
                            </pre>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex gap-2">
                    {category.canRetry && (
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

                <p className="text-center text-xs text-muted-foreground">
                    Need help?{" "}
                    <a
                        href="mailto:support@usehunter.app"
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                        Contact support
                    </a>
                </p>
            </div>
        </div>
    );
};
