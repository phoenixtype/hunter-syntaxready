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

// Parse resume using AI
export const parseResume = async (file: File, userId?: string): Promise<CandidateProfile> => {
  console.log("Parsing resume:", file.name);
  
  // 1. Extract text from PDF using FileReader (Client-side fallback)
  const text = await extractTextFromFile(file);
  
  if (!text || text.trim().length < 50) {
    throw new Error("Could not extract text from resume. Please ensure it's a readable PDF.");
  }

  // 2. Upload original file to Supabase Storage
  // We'll proceed even if upload fails, but warn about it
  let resumeUrl: string | null = null;
  try {
    resumeUrl = await uploadResumeFile(file);
  } catch (uploadErr) {
    console.warn('Failed to upload resume file to storage:', uploadErr);
    // Continue with parsing even if storage fails
  }

  // 3. Call the AI parsing edge function
  const { data, error } = await supabase.functions.invoke('parse-resume', {
    body: { 
      resumeText: text, 
      userId,
      resumeUrl // Pass the storage URL to the function
    }
  });

  if (error) {
    console.error('Resume parsing error:', error);
    throw new Error(error.message || 'Failed to parse resume');
  }

  if (!data?.success || !data?.profile) {
    throw new Error(data?.error || 'Failed to extract profile from resume');
  }

  return data.profile as CandidateProfile;
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
  pdfJS.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfJS.version}/pdf.worker.min.mjs`;

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
