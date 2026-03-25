import { supabase } from "@/integrations/supabase/client";
import { queueParseResume } from "./function-queue";

export interface Education {
  school: string;
  degree: string;
  field?: string;  // Field of study / Major
  year: string;
}

export interface Skill {
  name: string;
  proficiency: number;
  evidence: string[];
}

export interface ExperienceAtom {
  id: string;
  company: string;
  role: string;
  duration: string;
  content: string;
  impact_vector?: number[];
  keywords: string[];
}

export interface CandidateProfile {
  identity: {
    name: string;
    email: string;
    phone?: string;
    location?: string;
    links: string[];
    _years_exp?: string;
  };
  skills: Skill[];
  experience_atoms: ExperienceAtom[];
  education: Education[];
  resume_file_url?: string;
  summary?: string;
  custom_sections?: {
    title: string;
    content: string[];
  }[];
}

// Custom error class for better error handling
export class ResumeParseError extends Error {
  code: string;
  userMessage: string;
  technicalDetails?: string;

  constructor(code: string, userMessage: string, technicalDetails?: string) {
    super(userMessage);
    this.name = 'ResumeParseError';
    this.code = code;
    this.userMessage = userMessage;
    this.technicalDetails = technicalDetails;
  }
}

// Parse resume using AI
export const parseResume = async (file: File, userId?: string): Promise<CandidateProfile> => {
  // 0. Validate file before processing
  if (file.size > 10 * 1024 * 1024) {
    throw new ResumeParseError(
      'FILE_TOO_LARGE',
      'File size exceeds 10MB limit',
      `File size: ${file.size} bytes`
    );
  }

  if (!file.type.includes('pdf') && !file.type.includes('wordprocessingml')) {
    throw new ResumeParseError(
      'INVALID_FILE_TYPE',
      'Only PDF and DOCX files are supported',
      `File type: ${file.type}`
    );
  }

  // 1. Validate session before expensive operations
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new ResumeParseError(
      'SESSION_INVALID',
      'Your session has expired. Please sign out and sign in again.',
      sessionError?.message
    );
  }

  // 2. Extract text from PDF using FileReader (Client-side fallback)
  let text: string;
  try {
    text = await extractTextFromFile(file);
  } catch (extractError) {
    throw new ResumeParseError(
      'EXTRACTION_FAILED',
      'Could not read the resume file. The PDF may be encrypted or corrupted.',
      extractError instanceof Error ? extractError.message : String(extractError)
    );
  }
  
  // Senior Dev Fix: Better detection of scanned PDFs
  if (!text || text.trim().length < 50) {
    const isLargeFile = file.size > 1024 * 1024; // > 1MB
    
    // If file is large but text is empty, it's definitely a scan / image-only PDF
    if (isLargeFile) {
        throw new ResumeParseError(
            'SCANNED_PDF_DETECTED',
            'This appears to be a scanned or image-based PDF. Hunter needs a text-based PDF to analyze your skills.',
            `File size: ${file.size}, Extracted chars: ${text?.length || 0}`
        );
    }

    throw new ResumeParseError(
      'INSUFFICIENT_TEXT',
      'Could not extract enough text from resume. Please ensure it\'s a standard text-based PDF.',
      `Extracted ${text?.length || 0} characters`
    );
  }

  // 3. Upload original file to Supabase Storage
  try {
    await uploadResumeFile(file);
  } catch {
    // Continue with parsing even if storage upload fails
  }

  // 4. Call the AI parsing edge function with retry logic
  let lastError: unknown = null;
  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use queued function call to prevent overwhelming edge functions
      const data = await queueParseResume({
        resumeText: text,
        userId,
      } as any);

      const error: any = null; // Queue system handles errors internally

      if (error) {
        lastError = error;

        // Don't retry on auth errors
        if (error.message?.includes('401') || 
            error.message?.includes('Invalid User Token') ||
            error.message?.includes('Invalid JWT')) {
          throw new ResumeParseError(
            'AUTH_FAILED',
            'Authentication failed. Please sign out and sign in again.',
            error.message
          );
        }

        // Don't retry on rate limit errors
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          throw new ResumeParseError(
            'RATE_LIMITED',
            'Too many requests. Please wait a minute and try again.',
            error.message
          );
        }

        // Retry on other errors
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
        
        throw error;
      }

      if (!data?.success || !data?.profile) {
        const errorMsg = data?.error || 'Failed to extract profile from resume';
        throw new ResumeParseError(
          'PARSE_FAILED',
          'AI failed to analyze resume structure. Please ensure your resume has clear sections for experience, skills, and education.',
          errorMsg
        );
      }

      return data.profile as CandidateProfile;

    } catch (err) {
      lastError = err;
      
      // If it's already a ResumeParseError, don't retry
      if (err instanceof ResumeParseError) {
        throw err;
      }
      
      // Retry on network errors
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
    }
  }

  // All retries failed
  throw new ResumeParseError(
    'SERVICE_ERROR',
    'Resume analysis service is temporarily unavailable. Please try again in a few moments.',
    lastError instanceof Error ? lastError.message : String(lastError)
  );
};

// Upload resume file to Supabase Storage
async function uploadResumeFile(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  // Use 'resumes' bucket
  const { error } = await supabase.storage
    .from('resumes')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw error;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('resumes')
    .getPublicUrl(fileName);

  return publicUrl;
}

// Extract text from file using PDF.js for robust parsing with layout preservation
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    try {
      // Dynamic import PDF.js
      const pdfJS = await import('pdfjs-dist');

      // Set worker - use CDN version matching our package (5.4.530)
      pdfJS.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs`;

      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (e) => {
          try {
            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);

            const loadingTask = pdfJS.getDocument({
              data: typedarray,
              verbosity: 0,
            });

            const pdf = await loadingTask.promise;

            let fullText = '';

            // Iterate over all pages
            for (let i = 1; i <= pdf.numPages; i++) {
              let pageText = '';
              let lastY = -1;

              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();

              // Sort items by Y (top to bottom) then X (left to right) to handle multi-column layouts
              // PDF coordinates: (0,0) is bottom-left. Higher Y = higher on page.
              const items = textContent.items
                .filter((item) => 'str' in item)
                .map(item => item as unknown as { str: string, transform: number[], width: number, height: number });

              items.sort((a, b) => {
                const yDiff = b.transform[5] - a.transform[5];
                if (Math.abs(yDiff) > 4) return yDiff;
                return a.transform[4] - b.transform[4];
              });

              for (const item of items) {
                const currentY = item.transform[5];
                const text = item.str;

                if (lastY === -1) {
                    pageText += text;
                } else {
                    const dy = Math.abs(currentY - lastY);

                    if (dy > 10) {
                        pageText += '\n' + text;
                    } else if (dy > 4) {
                        pageText += ' ' + text;
                    } else {
                        pageText += (text.startsWith(' ') || pageText.endsWith(' ') ? '' : ' ') + text;
                    }
                }
                lastY = currentY;
              }

              fullText += pageText + '\n\n---\n\n'; // Explicit page break
            }

            resolve(fullText.trim());

          } catch (error) {
            // Provide specific error messages for common PDF issues
            if (error instanceof Error) {
              if (error.message.includes('password')) {
                reject(new ResumeParseError(
                  'EXTRACTION_FAILED',
                  'This PDF is password-protected. Please use an unprotected version.',
                  error.message
                ));
              } else if (error.message.includes('Invalid PDF')) {
                reject(new ResumeParseError(
                  'EXTRACTION_FAILED',
                  'This file appears to be corrupted or not a valid PDF.',
                  error.message
                ));
              } else {
                reject(new ResumeParseError(
                  'EXTRACTION_FAILED',
                  'Could not read the PDF. It may be encrypted, corrupted, or contain only images.',
                  error.message
                ));
              }
            } else {
              reject(new ResumeParseError(
                'EXTRACTION_FAILED',
                'Failed to parse PDF content.',
                String(error)
              ));
            }
          }
        };

        reader.onerror = () => {
          reject(new ResumeParseError(
            'EXTRACTION_FAILED',
            'Failed to read the file from disk.',
            'FileReader error'
          ));
        };

        reader.readAsArrayBuffer(file);
      });
    } catch (importError) {
      throw new ResumeParseError(
        'EXTRACTION_FAILED',
        'PDF processing library failed to load. Please try again.',
        importError instanceof Error ? importError.message : String(importError)
      );
    }
  } else {
    // Fallback for .txt or other formats (though we mainly restrict to PDF)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new ResumeParseError(
        'EXTRACTION_FAILED',
        'Failed to read file',
        'FileReader error'
      ));
      reader.readAsText(file);
    });
  }
}

// Get saved candidate profile from database
export const getCandidateProfile = async (userId: string): Promise<CandidateProfile | null> => {
  try {
    const { data, error } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    // Parse identity — spread raw JSONB first so all hidden _fields (set during
    // onboarding: _gender, _work_auth, _age, _search_status, _exp_level, _job_values, _summary)
    // are preserved when the profile is loaded then saved again from Profile.tsx.
    const identity = (data.identity || {}) as Record<string, unknown>;
    const profileIdentity: CandidateProfile['identity'] = {
      ...(identity as Record<string, string>),        // keep all _underscore fields
      name: (identity?.name as string) || 'Unknown Candidate',
      email: (identity?.email as string) || '',
      phone: (identity?.phone as string) || '',
      location: (identity?.location as string) || '',
      links: Array.isArray(identity?.links) ? (identity.links as string[]) : []
    };

    return {
      identity: profileIdentity,
      skills: (data.skills as unknown as Skill[]) || [],
      experience_atoms: (data.experience_atoms as unknown as ExperienceAtom[]) || [],
      education: (data.education as unknown as Education[]) || [],
      resume_file_url: data.resume_file_url || undefined,
      // summary is embedded in the identity JSONB (no separate DB column)
      summary: (identity?._summary as string) || undefined
    };
  } catch {
    return null;
  }
};

// Save candidate profile to database
export const saveCandidateProfile = async (userId: string, profile: CandidateProfile): Promise<void> => {
  // Embed summary inside the identity JSONB (no separate DB column for summary)
  const identityPayload = profile.summary
    ? { ...profile.identity, _summary: profile.summary }
    : profile.identity;

  const payload = {
    user_id: userId,
    identity: identityPayload as import('@/integrations/supabase/types').Json,
    skills: profile.skills as unknown as import('@/integrations/supabase/types').Json,
    experience_atoms: profile.experience_atoms as unknown as import('@/integrations/supabase/types').Json,
    education: profile.education as unknown as import('@/integrations/supabase/types').Json,
  };

  const { error } = await supabase
    .from('candidate_profiles')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    throw error;
  }
};

// Helper to polish text using heuristic rules for formatting
export const polishText = async (text: string, type: 'experience' | 'skill'): Promise<string> => {
    // For now, we'll use a heuristic polish to ensure "world class" speed without edge function dependency issues.
    let polished = text.trim();

    // 1. Fix capitalization
    polished = polished.charAt(0).toUpperCase() + polished.slice(1);

    // 2. Fix bullet points
    if (type === 'experience') {
        // ATS Optimization: Replace complex unicode bullets (•, *, >, -, etc) with a clean standard hyphen
        // as some older ATS systems choke on unicode bullets.
        polished = polished.replace(/^[\s]*[•\-*▪►➢>]\s*/gm, '\n- ');
        // Fix double spaces
        polished = polished.replace(/\s{2,}/g, ' ');
        // Ensure atomic actions are capitalized
        polished = polished.replace(/\n•\s+([a-z])/g, (_match, char) => `\n• ${char.toUpperCase()}`);
    }

    return polished;
};
