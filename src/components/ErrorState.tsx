import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
    title?: string;
    description: string;
    onRetry?: () => void;
    actions?: ReactNode[];
    className?: string;
}

export const ErrorState = ({
    title = "Something went wrong",
    description,
    onRetry,
    actions,
    className = "",
}: ErrorStateProps) => {
    return (
        <Card className={`glass-card border-destructive/20 bg-destructive/5 ${className}`}>
            <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle className="text-xl mb-2 text-destructive">{title}</CardTitle>
                <CardDescription className="text-base mb-6 max-w-md">
                    {description}
                </CardDescription>
                <div className="flex flex-col sm:flex-row gap-3">
                    {onRetry && (
                        <Button onClick={onRetry} variant="default">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Try Again
                        </Button>
                    )}
                    {actions}
                </div>
            </CardContent>
        </Card>
    );
};
