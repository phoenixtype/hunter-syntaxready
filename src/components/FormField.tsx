import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { HelpTooltip } from "./HelpTooltip";

interface FormFieldProps {
    label: string;
    htmlFor: string;
    children: ReactNode;
    helpText?: string;
    error?: string;
    required?: boolean;
    className?: string;
}

export const FormField = ({
    label,
    htmlFor,
    children,
    helpText,
    error,
    required = false,
    className = "",
}: FormFieldProps) => {
    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center gap-2">
                <Label
                    htmlFor={htmlFor}
                    className="text-base font-medium"
                >
                    {label}
                    {required && <span className="text-destructive ml-1" aria-label="required">*</span>}
                </Label>
                {helpText && <HelpTooltip content={helpText} />}
            </div>
            {children}
            {error && (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};
