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
    links: string[];
  };
  skills: Skill[];
  experience_atoms: ExperienceAtom[];
  education: Education[];
  resume_file_url?: string;
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
  
  if (!text || text.trim().length < 50) {
    throw new ResumeParseError(
      'INSUFFICIENT_TEXT',
      'Could not extract enough text from resume. Please ensure it\'s a readable PDF with text content (not just images).',
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
  let lastError: any = null;
  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[RESUME] Calling parse-resume edge function (attempt ${attempt}/${maxRetries})`);
      
      const { data, error } = await supabase.functions.invoke('parse-resume', {
        body: { 
          resumeText: text, 
          userId,
          resumeUrl
        }
      });

      if (error) {
        lastError = error;
        console.error(`[RESUME] Edge function error (attempt ${attempt}):`, error);
        
        // Don't retry on auth errors
        if (error.message?.includes('401') || error.message?.includes('Invalid User Token')) {
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
    lastError?.message || String(lastError)
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

// Extract text from file using PDF.js for robust parsing
async function extractTextFromFile(file: File): Promise<string> {
  // Dynamic import to avoid SSR issues if this were Next.js, but good practice here too
  const pdfJS = await import('pdfjs-dist');
  
  // Set worker to the CDN to avoid build configuration headaches with Vite
  // We use the version matching the installed package roughly, or generic latest for stability in this demo
  // Set worker to the CDN to avoid build configuration headaches with Vite
  // Hardcoding to a known stable version matching npm to ensure compatibility
  // pdfjs-dist v5.4.530
  pdfJS.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

  if (file.type === 'application/pdf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target?.result as ArrayBuffer);
          
          const loadingTask = pdfJS.getDocument({
            data: typedarray,
            cMapUrl: `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJS.version}/cmaps/`,
            cMapPacked: true,
          });

          const pdf = await loadingTask.promise;
          let fullText = '';
          
          // Iterate over all pages
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Join items with space, preserving roughly the flow
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
              
            fullText += pageText + '\n\n';
          }
          
          console.log(`Extracted ${fullText.length} characters via PDF.js`);
          resolve(fullText.trim());

        } catch (error) {
          console.error('PDF.js parsing failed:', error);
          reject(new Error('Failed to parse PDF content. Is the file encrypted?'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  } else {
    // Fallback for .txt or other formats (though we mainly restrict to PDF)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
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

    if (error || !data) {
      console.log('No saved profile found');
      return null;
    }

    return {
      identity: (data.identity as unknown as CandidateProfile['identity']) || { name: 'Unknown Candidate', email: '', links: [] },
      skills: (data.skills as unknown as Skill[]) || [],
      experience_atoms: (data.experience_atoms as unknown as ExperienceAtom[]) || [],
      education: (data.education as unknown as Education[]) || [],
      resume_file_url: data.resume_file_url || undefined
    };
  } catch (err) {
    console.error('Error fetching profile:', err);
    return null;
  }
};

// Save candidate profile to database
export const saveCandidateProfile = async (userId: string, profile: CandidateProfile): Promise<void> => {
  const { error } = await (supabase
    .from('candidate_profiles') as any)
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
