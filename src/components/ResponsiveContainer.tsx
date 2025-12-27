import { ReactNode } from "react";

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  "2xl": "max-w-7xl",
  full: "max-w-full",
};

const ResponsiveContainer = ({
  children,
  className = "",
  maxWidth = "lg",
}: ResponsiveContainerProps) => {
  return (
    <div
      className={`
        w-full mx-auto
        px-4 sm:px-6 lg:px-8
        ${maxWidthClasses[maxWidth]}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default ResponsiveContainer;
