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
}

// Parse resume using AI
export const parseResume = async (file: File, userId?: string): Promise<CandidateProfile> => {
  console.log("Parsing resume:", file.name);
  
  // Extract text from PDF using FileReader
  const text = await extractTextFromFile(file);
  
  if (!text || text.trim().length < 50) {
    throw new Error("Could not extract text from resume. Please ensure it's a readable PDF.");
  }

  // Call the AI parsing edge function
  const { data, error } = await supabase.functions.invoke('parse-resume', {
    body: { resumeText: text, userId }
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

// Extract text from file (basic implementation for PDF text extraction)
async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // For PDFs, we'll send the raw content and let the server handle it
        // In a production app, you'd use pdf.js here
        // For now, we'll try to extract any text we can find
        
        const uint8Array = new Uint8Array(arrayBuffer);
        let text = '';
        
        // Try to decode as UTF-8 text (works for text-based PDFs)
        try {
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const rawText = decoder.decode(uint8Array);
          
          // Extract readable text from PDF structure
          // Look for text between parentheses (PDF text objects)
          const textMatches = rawText.match(/\(([^)]+)\)/g);
          if (textMatches) {
            text = textMatches
              .map(m => m.slice(1, -1))
              .filter(t => t.length > 2 && /[a-zA-Z]/.test(t))
              .join(' ');
          }
          
          // Also look for /Contents streams
          const contentsMatch = rawText.match(/\/Contents[^>]*>>stream([\s\S]*?)endstream/g);
          if (contentsMatch) {
            contentsMatch.forEach(match => {
              const streamText = match.replace(/[^a-zA-Z0-9\s@.,\-()]/g, ' ');
              text += ' ' + streamText;
            });
          }
          
          // If still no text, fall back to raw decode
          if (text.trim().length < 100) {
            text = rawText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ');
          }
        } catch {
          // Fallback: just try to get any ASCII text
          text = Array.from(uint8Array)
            .filter(b => b >= 32 && b <= 126)
            .map(b => String.fromCharCode(b))
            .join('');
        }
        
        // Clean up the extracted text
        text = text
          .replace(/\s+/g, ' ')
          .replace(/[^\w\s@.,\-+()\/&:'"|#$%*!?]/g, '')
          .trim();
        
        console.log(`Extracted ${text.length} characters from resume`);
        resolve(text);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
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
      identity: data.identity as CandidateProfile['identity'],
      skills: data.skills as Skill[],
      experience_atoms: data.experience_atoms as ExperienceAtom[],
      education: data.education as Education[]
    };
  } catch (err) {
    console.error('Error fetching profile:', err);
    return null;
  }
};

// Save candidate profile to database
export const saveCandidateProfile = async (userId: string, profile: CandidateProfile): Promise<void> => {
  const { error } = await supabase
    .from('candidate_profiles')
    .upsert({
      user_id: userId,
      identity: profile.identity,
      skills: profile.skills,
      experience_atoms: profile.experience_atoms,
      education: profile.education
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error saving profile:', error);
    throw error;
  }
};
