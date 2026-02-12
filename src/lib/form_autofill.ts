/**
 * Form Auto-Fill Utility
 * 
 * Provides utilities for automatically populating form fields
 * from ATS resume data during onboarding.
 */

import { ATSResumeData } from "./ats_types";

/**
 * Field mapping type for connecting ATS data to form fields
 */
export type ATSFieldMapping = {
  [formFieldName: string]: keyof ATSResumeData | string;
};

/**
 * Auto-fill a form using ATS resume data
 * Works with both native DOM forms and provides data for React Hook Form
 * 
 * @param atsData - The parsed ATS resume data
 * @param fieldMapping - Map of form field names to ATS data keys
 * @returns Object with values ready to use with setValue() in React Hook Form
 */
export const prepareFormValues = (
  atsData: ATSResumeData,
  fieldMapping: ATSFieldMapping
): Record<string, string | string[] | null> => {
  const values: Record<string, string | string[] | null> = {};
  
  for (const [formField, atsKey] of Object.entries(fieldMapping)) {
    const value = atsData[atsKey as keyof ATSResumeData];
    
    if (value !== undefined) {
      values[formField] = value as string | string[] | null;
    }
  }
  
  return values;
};

/**
 * Auto-fill DOM form inputs by ID
 * Useful for standard HTML forms
 * 
 * @param atsData - The parsed ATS resume data
 * @param fieldMapping - Map of DOM element IDs to ATS data keys
 */
export const autoFillDOMForm = (
  atsData: ATSResumeData,
  fieldMapping: ATSFieldMapping
): void => {
  for (const [elementId, atsKey] of Object.entries(fieldMapping)) {
    const element = document.getElementById(elementId);
    const value = atsData[atsKey as keyof ATSResumeData];
    
    if (element && value !== null && value !== undefined) {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (Array.isArray(value)) {
          element.value = value.join(', ');
        } else {
          element.value = String(value);
        }
        
        // Trigger change event for React/Vue/etc.
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
};

/**
 * Default field mapping for common job application forms
 */
export const DEFAULT_FIELD_MAPPING: ATSFieldMapping = {
  'fullName': 'fullName',
  'name': 'fullName',
  'firstName': 'fullName', // Will need to be split
  'email': 'email',
  'emailAddress': 'email',
  'phone': 'phone',
  'phoneNumber': 'phone',
  'location': 'location',
  'city': 'location',
  'summary': 'summary',
  'about': 'summary',
  'bio': 'summary',
};

/**
 * Split full name into first and last name
 */
export const splitName = (fullName: string | null): { firstName: string; lastName: string } => {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
};

/**
 * Get the most recent job title from work experience
 */
export const getMostRecentJobTitle = (atsData: ATSResumeData): string | null => {
  if (atsData.workExperience.length === 0) return null;
  return atsData.workExperience[0].jobTitle;
};

/**
 * Get the most recent company from work experience
 */
export const getMostRecentCompany = (atsData: ATSResumeData): string | null => {
  if (atsData.workExperience.length === 0) return null;
  return atsData.workExperience[0].company;
};

/**
 * Get the highest/most recent degree from education
 */
export const getHighestDegree = (atsData: ATSResumeData): string | null => {
  if (atsData.education.length === 0) return null;
  return atsData.education[0].degree;
};
