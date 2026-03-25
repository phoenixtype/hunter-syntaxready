import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft } from "lucide-react";

export interface BreadcrumbEntry {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  /** Breadcrumb trail ending with the current page (last item has no link) */
  breadcrumbs: BreadcrumbEntry[];
  /** Optional icon displayed before the page title */
  icon?: React.ReactNode;
  /** Optional right-side actions */
  actions?: React.ReactNode;
  /** Whether to use sticky positioning (default true) */
  sticky?: boolean;
}

const PageHeader = ({ breadcrumbs, icon, actions, sticky = true }: PageHeaderProps) => {
  const navigate = useNavigate();

  // The parent crumb for the back button (second-to-last, or dashboard)
  const parentHref = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2].href : "/dashboard";

  return (
    <header
      className={`${sticky ? "sticky top-0 z-50" : ""} w-full border-b border-border bg-background/80 backdrop-blur-lg`}
    >
      <div className="container max-w-5xl mx-auto px-4 min-h-[3.5rem] py-2 flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (parentHref ? navigate(parentHref) : navigate(-1))}
          className="shrink-0 -ml-2 h-8 w-8"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Icon */}
        {icon && (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}

        {/* Breadcrumbs */}
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <BreadcrumbItem key={i}>
                  {i > 0 && <BreadcrumbSeparator><span className="text-muted-foreground/40 text-xs">›</span></BreadcrumbSeparator>}
                  {isLast ? (
                    <BreadcrumbPage className="truncate font-semibold text-xs sm:text-sm">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="cursor-pointer text-xs sm:text-sm hidden sm:inline"
                      onClick={() => crumb.href && navigate(crumb.href)}
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Actions */}
        {actions && <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">{actions}</div>}
      </div>
    </header>
  );
};

export default PageHeader;
