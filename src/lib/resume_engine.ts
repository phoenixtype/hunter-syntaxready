import { supabase } from "@/integrations/supabase/client";

export interface Education {
  school: string;
  degree: string;
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
    links: string[];
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
  console.log("[RESUME] Starting parse:", file.name, "Size:", file.size, "Type:", file.type);
  
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
    console.error('[RESUME] Session validation failed:', sessionError);
    throw new ResumeParseError(
      'SESSION_INVALID',
      'Your session has expired. Please sign out and sign in again.',
      sessionError?.message
    );
  }

  console.log('[RESUME] Session valid, expires at:', new Date(session.expires_at! * 1000).toISOString());

  // 2. Extract text from PDF using FileReader (Client-side fallback)
  let text: string;
  try {
    text = await extractTextFromFile(file);
  } catch (extractError) {
    console.error('[RESUME] Text extraction failed:', extractError);
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

  console.log(`[RESUME] Extracted ${text.length} characters from PDF`);

  // 3. Upload original file to Supabase Storage
  let resumeUrl: string | null = null;
  try {
    resumeUrl = await uploadResumeFile(file);
    console.log('[RESUME] File uploaded to storage:', resumeUrl);
  } catch (uploadErr) {
    console.warn('[RESUME] Storage upload failed (non-critical):', uploadErr);
    // Continue with parsing even if storage fails
  }

  // 4. Call the AI parsing edge function with retry logic
  let lastError: unknown = null;
  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RESUME] Calling parse-resume edge function (attempt ${attempt}/${maxRetries})`);
      console.log('[RESUME] Session active:', !!session);
      console.log('[RESUME] Token available:', !!session?.access_token);
      
      const { data, error } = await supabase.functions.invoke('parse-resume', {
        body: { 
          resumeText: text, 
          userId,
          resumeUrl
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        lastError = error;
        console.error(`[RESUME] Edge function error (attempt ${attempt}):`, error);
        console.error('[RESUME] Error details:', JSON.stringify(error, null, 2));
        
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
          console.log(`[RESUME] Retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
        
        throw error;
      }

      if (!data?.success || !data?.profile) {
        const errorMsg = data?.error || 'Failed to extract profile from resume';
        console.error('[RESUME] Parse failed:', errorMsg);
        throw new ResumeParseError(
          'PARSE_FAILED',
          'AI failed to analyze resume structure. Please ensure your resume has clear sections for experience, skills, and education.',
          errorMsg
        );
      }

      console.log('[RESUME] Successfully parsed resume');
      return data.profile as CandidateProfile;

    } catch (err) {
      lastError = err;
      
      // If it's already a ResumeParseError, don't retry
      if (err instanceof ResumeParseError) {
        throw err;
      }
      
      // Retry on network errors
      if (attempt < maxRetries) {
        console.log(`[RESUME] Retrying after error in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
    }
  }

  // All retries failed
  console.error('[RESUME] All retry attempts failed:', lastError);
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
  const { data, error } = await supabase.storage
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
  console.log('[PDF] Starting extraction for:', file.name, 'Type:', file.type, 'Size:', file.size);
  
  if (file.type === 'application/pdf') {
    try {
      // Dynamic import PDF.js
      const pdfJS = await import('pdfjs-dist');
      console.log('[PDF] PDF.js version:', pdfJS.version);
      
      // Set worker - use CDN version matching our package (5.4.530)
      pdfJS.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs`;
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
            console.log('[PDF] File loaded, size:', typedarray.length, 'bytes');
            
            const loadingTask = pdfJS.getDocument({
              data: typedarray,
              verbosity: 0,
            });

            const pdf = await loadingTask.promise;
            console.log('[PDF] PDF loaded, pages:', pdf.numPages);
            
            let fullText = '';
            
            // Iterate over all pages
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              
              let lastY = -1;
              let pageText = '';

              // Sort items by Y (top to bottom) then X (left to right) to handle multi-column layouts better
              // PDF coordinates: (0,0) is bottom-left. Higher Y = higher on page.
              // We use a tolerance of ~20% of typical font height (approx 2-3 units) for "same line" detection
              
              const items = textContent.items.map(item => item as { str: string, transform: number[], width: number, height: number });
              
              items.sort((a, b) => {
                const yDiff = b.transform[5] - a.transform[5]; // Compare Y
                if (Math.abs(yDiff) > 4) return yDiff; // Different line? Use Y order
                return a.transform[4] - b.transform[4]; // Same line? Use X order
              });

              for (const item of items) {
                const currentY = item.transform[5];
                const text = item.str;

                // If it's the first item, just append
                if (lastY === -1) {
                    pageText += text;
                } else {
                    const dy = Math.abs(currentY - lastY);
                    
                    // If vertical distance is significant (> font height approx), assume new line
                    if (dy > 10) { 
                        pageText += '\n' + text;
                    } else if (dy > 4) {
                        // Small vertical shift but maybe not a full line break? 
                        // Often this is a superscript or subscript or just weird spacing.
                        // We'll treat it as a space.
                        pageText += ' ' + text; 
                    } else {
                        // Same line (dy <= 4)
                        pageText += (text.startsWith(' ') || pageText.endsWith(' ') ? '' : ' ') + text;
                    }
                }
                lastY = currentY;
              }
                
              fullText += pageText + '\n\n---\n\n'; // Explicit page break
              console.log(`[PDF] Extracted page ${i}/${pdf.numPages}, chars so far: ${fullText.length}`);
            }
            
            console.log(`[PDF] ✅ Extracted ${fullText.length} characters total`);
            resolve(fullText.trim());

          } catch (error) {
            console.error('[PDF] ❌ Parsing failed:', error);
            
            // Provide more specific error messages
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
          console.error('[PDF] ❌ FileReader error');
          reject(new ResumeParseError(
            'EXTRACTION_FAILED',
            'Failed to read the file from disk.',
            'FileReader error'
          ));
        };
        
        reader.readAsArrayBuffer(file);
      });
    } catch (importError) {
      console.error('[PDF] ❌ Failed to import PDF.js:', importError);
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
      console.error('[PROFILE] Error fetching profile:', error.message);
      return null;
    }

    if (!data) {
      console.log('[PROFILE] No saved profile found for user');
      return null;
    }

    // Parse identity with better defaults
    const identity = data.identity as any;
    const profileIdentity = {
      name: identity?.name || 'Unknown Candidate',
      email: identity?.email || '',
      phone: identity?.phone || '',
      links: identity?.links || []
    };

    console.log('[PROFILE] Loaded profile from database:', {
      name: profileIdentity.name,
      email: profileIdentity.email,
      skillsCount: (data.skills as any[])?.length || 0,
      experienceCount: (data.experience_atoms as any[])?.length || 0
    });

    return {
      identity: profileIdentity,
      skills: (data.skills as unknown as Skill[]) || [],
      experience_atoms: (data.experience_atoms as unknown as ExperienceAtom[]) || [],
      education: (data.education as unknown as Education[]) || [],
      resume_file_url: data.resume_file_url || undefined
    };
  } catch (err) {
    console.error('[PROFILE] Exception fetching profile:', err);
    return null;
  }
};

// Save candidate profile to database
export const saveCandidateProfile = async (userId: string, profile: CandidateProfile): Promise<void> => {
  const { error } = await supabase
    .from('candidate_profiles')
    .upsert({
      user_id: userId,
      identity: profile.identity as unknown,
      skills: profile.skills as unknown,
      experience_atoms: profile.experience_atoms as unknown,
      education: profile.education as unknown
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error saving profile:', error);
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
        // Ensure bullet points start on new lines
        polished = polished.replace(/([•\-*])\s*/g, '\n• ');
        // Fix double spaces
        polished = polished.replace(/\s{2,}/g, ' ');
        // Ensure atomic actions are capitalized
        polished = polished.replace(/\n•\s+([a-z])/g, (match, char) => `\n• ${char.toUpperCase()}`);
    }

    return polished;
};
