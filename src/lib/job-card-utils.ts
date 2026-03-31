/**
 * Shared utilities for consistent job card design system
 *
 * This file contains reusable functions and patterns to ensure
 * all job-related components follow the same design standards.
 */

/**
 * Check if salary should be displayed (hides "0-0k" and similar invalid ranges)
 * Used across all job card components for consistency
 */
export const shouldShowSalary = (salaryRange: string | null | undefined): boolean => {
  if (!salaryRange || salaryRange === "Not specified") return false;
  try {
    const normalizedSalary = salaryRange.toLowerCase().trim();
    if (normalizedSalary === "0-0" ||
        normalizedSalary === "0-0k" ||
        normalizedSalary === "0 - 0" ||
        normalizedSalary === "0 - 0k" ||
        normalizedSalary.match(/^0\s*[-–—]\s*0[k]?\s*$/)) {
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Error checking salary pattern:', error, salaryRange);
    return true;
  }
};

/**
 * Format tech stack display with consistent limiting and overflow text
 * @param techStack Array of tech skills
 * @param limit Maximum number of skills to show (default: 3)
 * @returns Object with limited skills array and overflow count
 */
export const formatTechStackDisplay = (
  techStack: string[] | null | undefined,
  limit: number = 3
): { skills: string[]; overflowCount: number } => {
  if (!techStack || techStack.length === 0) {
    return { skills: [], overflowCount: 0 };
  }

  const skills = techStack.slice(0, limit);
  const overflowCount = Math.max(0, techStack.length - limit);

  return { skills, overflowCount };
};

/**
 * Get initials for company logo display
 * @param companyName Company name string
 * @returns Single character initial (uppercase)
 */
export const getCompanyInitial = (companyName: string | null | undefined): string => {
  if (!companyName || companyName.trim().length === 0) return "?";
  return companyName.trim()[0].toUpperCase();
};

/**
 * Format job title with fallback for display
 * @param title Job title string
 * @returns Formatted title or fallback text
 */
export const formatJobTitle = (title: string | null | undefined): string => {
  return title?.trim() || 'Job Title Not Available';
};

/**
 * Format company name with fallback for display
 * @param company Company name string
 * @returns Formatted company name or fallback text
 */
export const formatCompanyName = (company: string | null | undefined): string => {
  return company?.trim() || 'Company Not Available';
};

/**
 * Standard job card styling classes
 * Consistent across all job card components
 */
export const JOB_CARD_STYLES = {
  // Main card container
  card: "group relative flex flex-col bg-card border border-border/50 hover:border-primary/30 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer",

  // Content padding (varies by size)
  contentPadding: {
    sm: "p-3 gap-2",
    md: "p-4 gap-3",
    lg: "p-6 gap-4"
  },

  // Title sizes (varies by size)
  titleSize: {
    sm: "text-sm font-medium",
    md: "text-base font-semibold",
    lg: "text-lg font-bold"
  },

  // Company logo/avatar
  companyLogo: "rounded-lg bg-background border border-border flex items-center justify-center shrink-0 shadow-sm",
  companyLogoSize: {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  },
  companyLogoText: "font-bold text-foreground",
  companyLogoTextSize: {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg"
  },

  // Title and company text
  title: "leading-tight text-foreground truncate",
  company: "text-sm text-muted-foreground mt-0.5 truncate",

  // Details row (location, date, etc.)
  detailsRow: "flex items-center gap-3 text-xs text-muted-foreground",
  detailItem: "flex items-center gap-1",
  detailIcon: "h-3.5 w-3.5 shrink-0",

  // Badge row
  badgeRow: "flex items-center gap-2 flex-wrap",
  salaryBadge: "text-xs gap-1 border-border bg-background",
  salaryIcon: "w-3 h-3 text-muted-foreground",
  newBadge: "text-[10px] px-1.5 uppercase tracking-wider",

  // Match score badge (consistent with MatchScoreTooltip)
  matchBadge: "text-xs cursor-help bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",

  // Skills/tech stack
  skillsContainer: "flex flex-wrap gap-1",
  skillItem: "px-2 py-0.5 text-[10px] bg-muted rounded-md text-muted-foreground border border-border/50",
  skillsOverflow: "text-[10px] text-muted-foreground self-center"
} as const;

/**
 * Standard date formatting for job cards
 * @param dateString Date string to format
 * @returns Formatted date string or null if invalid
 */
export const formatJobDate = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  } catch {
    return null;
  }
};

/**
 * Standard match score formatting
 * @param matchScore Match score number
 * @returns Rounded match score
 */
export const formatMatchScore = (matchScore: number | null | undefined): number | null => {
  return matchScore ? Math.round(matchScore) : null;
};