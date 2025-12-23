
export interface Education {
  school: string;
  degree: string;
  year: string;
}

export interface Skill {
  name: string;
  proficiency: number; // 0-1
  evidence: string[]; // Source text
}

export interface ExperienceAtom {
  id: string;
  company: string;
  role: string;
  duration: string;
  content: string; // The raw bullet point
  impact_vector?: number[]; // Embedding mock
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

// Mock parsing function - in a real agent, this would use OCR + LLM
export const parseResume = async (file: File): Promise<CandidateProfile> => {
  console.log("Parsing resume:", file.name);
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Return a mock profile that "looks" like it was extracted
  return {
    identity: {
      name: "Alex Hunter",
      email: "alex@example.com",
      links: ["github.com/alex", "linkedin.com/in/alex"]
    },
    skills: [
      { name: "React", proficiency: 0.9, evidence: ["Built e-commerce dashboard using React"] },
      { name: "TypeScript", proficiency: 0.85, evidence: ["Migrated legacy JS codebase to TS"] },
      { name: "Node.js", proficiency: 0.8, evidence: ["Backend API development with Express"] },
      { name: "System Design", proficiency: 0.75, evidence: ["Architected microservices for high scale"] }
    ],
    experience_atoms: [
      {
        id: "1",
        company: "TechCorp",
        role: "Senior Engineer",
        duration: "2021-Present",
        content: "Led the migration of the core payments platform to Stripe, reducing failure rates by 15%.",
        keywords: ["Payments", "Stripe", "Leadership"]
      },
      {
        id: "2",
        company: "StartUp Inc",
        role: "Frontend Developer",
        duration: "2019-2021",
        content: "Developed the initial MVP using React and Firebase, securing Series A funding.",
        keywords: ["React", "Firebase", "MVP"]
      }
    ],
    education: [
      { school: "University of Technology", degree: "B.S. Computer Science", year: "2019" }
    ]
  };
};
