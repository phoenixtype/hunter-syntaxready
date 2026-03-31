/**
 * Standardized Company Logo Component
 * Consistent company logo/avatar display across all job-related components
 */

import { cn } from "@/lib/utils";
import { getCompanyInitial, JOB_CARD_STYLES } from "@/lib/job-card-utils";

interface CompanyLogoProps {
  companyName: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CompanyLogo({
  companyName,
  size = 'md',
  className
}: CompanyLogoProps) {
  const initial = getCompanyInitial(companyName);

  return (
    <div
      className={cn(
        JOB_CARD_STYLES.companyLogo,
        JOB_CARD_STYLES.companyLogoSize[size],
        className
      )}
    >
      <span
        className={cn(
          JOB_CARD_STYLES.companyLogoText,
          JOB_CARD_STYLES.companyLogoTextSize[size]
        )}
      >
        {initial}
      </span>
    </div>
  );
}