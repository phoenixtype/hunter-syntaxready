import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EmptyStateProps {
    icon: ReactNode;
    title: string;
    description: string;
    action?: ReactNode;
    className?: string;
}

export const EmptyState = ({
    icon,
    title,
    description,
    action,
    className = "",
}: EmptyStateProps) => {
    return (
        <Card className={`glass-card border-dashed ${className}`}>
            <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    {icon}
                </div>
                <CardTitle className="text-xl mb-2">{title}</CardTitle>
                <CardDescription className="text-base mb-6 max-w-md">
                    {description}
                </CardDescription>
                {action && <div className="flex gap-3">{action}</div>}
            </CardContent>
        </Card>
    );
};
