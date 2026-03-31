/**
 * Standardized Tech Skills Display Component
 * Consistent tech stack/skills display across all job-related components
 */

import { cn } from "@/lib/utils";
import { formatTechStackDisplay, JOB_CARD_STYLES } from "@/lib/job-card-utils";

interface TechSkillsProps {
  skills: string[] | null | undefined;
  limit?: number;
  className?: string;
  showCount?: boolean;
}

export function TechSkills({
  skills,
  limit = 3,
  className,
  showCount = true
}: TechSkillsProps) {
  const { skills: displaySkills, overflowCount } = formatTechStackDisplay(skills, limit);

  if (displaySkills.length === 0) {
    return null;
  }

  return (
    <div className={cn(JOB_CARD_STYLES.skillsContainer, className)}>
      {displaySkills.map((skill, index) => (
        <span
          key={index}
          className={JOB_CARD_STYLES.skillItem}
        >
          {skill}
        </span>
      ))}
      {showCount && overflowCount > 0 && (
        <span className={JOB_CARD_STYLES.skillsOverflow}>
          +{overflowCount} more
        </span>
      )}
    </div>
  );
}