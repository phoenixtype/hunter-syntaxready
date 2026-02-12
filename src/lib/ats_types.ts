/**
 * ATS Resume Parser - Standardized JSON Schema
 * 
 * This schema is designed for automatic form auto-fill during onboarding.
 * All fields are normalized (trimmed, consistent casing, deduplicated).
 * Missing data uses null or empty arrays, never invented values.
 */

export interface ATSResumeData {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  workExperience: ATSWorkExperience[];
  education: ATSEducation[];
}

export interface ATSWorkExperience {
  jobTitle: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  responsibilities: string[];
}

export interface ATSEducation {
  degree: string | null;
  institution: string | null;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Validates that an object conforms to the ATSResumeData schema
 */
export function isValidATSResumeData(data: unknown): data is ATSResumeData {
  if (!data || typeof data !== 'object') return false;
  
  const d = data as Record<string, unknown>;
  
  // Check required structure (allow null for string fields)
  const hasValidStrings = ['fullName', 'email', 'phone', 'location', 'summary'].every(
    key => d[key] === null || typeof d[key] === 'string'
  );
  
  const hasValidSkills = Array.isArray(d.skills) && 
    d.skills.every(s => typeof s === 'string');
  
  const hasValidExperience = Array.isArray(d.workExperience);
  const hasValidEducation = Array.isArray(d.education);
  
  return hasValidStrings && hasValidSkills && hasValidExperience && hasValidEducation;
}
