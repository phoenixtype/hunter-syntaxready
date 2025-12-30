import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { ReactNode } from "react";

interface HelpTooltipProps {
    content: string | ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    className?: string;
}

export const HelpTooltip = ({ content, side = "top", className = "" }: HelpTooltipProps) => {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-muted transition-colors ${className}`}
                        aria-label="Help information"
                    >
                        <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side={side} className="max-w-xs text-sm">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
