import { CandidateProfile, Education, ExperienceAtom, Skill } from "./resume_engine";

// Heuristic Parser Engine
// Goal: Extract structured data from raw text using Regex and logical pattern matching.
// This saves tokens and provides instant feedback.

export const parseResumeHeuristic = (text: string): CandidateProfile => {
  const profile: CandidateProfile = {
    identity: { name: "", email: "", links: [] },
    skills: [],
    experience_atoms: [],
    education: []
  };

  if (!text) return profile;

  // 1. Identity Extraction
  profile.identity.email = extractEmail(text);
  profile.identity.name = extractName(text, profile.identity.email);
  profile.identity.links = extractLinks(text);

  // 2. Section Segmentation
  const sections = segmentSections(text);

  // 3. Skills Extraction
  if (sections.skills) {
    profile.skills = extractSkills(sections.skills);
  } else {
    // Fallback: look in entire text if no explicit section
    profile.skills = extractSkills(text);
  }

  // 4. Education Extraction
  if (sections.education) {
    profile.education = extractEducation(sections.education);
  }

  // 5. Experience Extraction
  if (sections.experience) {
    profile.experience_atoms = extractExperience(sections.experience);
  }

  return profile;
};

// --- Helpers ---

const extractEmail = (text: string): string => {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const match = text.match(emailRegex);
  return match ? match[0] : "";
};

const extractLinks = (text: string): string[] => {
  const links: string[] = [];
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const matches = text.match(urlRegex);
  
  if (matches) {
    matches.forEach(link => {
      // Clean trailing punctuation
      const cleanLink = link.replace(/[.,;)]+$/, "");
      if (cleanLink.includes("linkedin.com") || cleanLink.includes("github.com") || cleanLink.includes("portfolio")) {
        links.push(cleanLink);
      }
    });
  }
  return [...new Set(links)]; // dedupe
};

const extractName = (text: string, email: string): string => {
  // Heuristic: Name is usually at the very top, first line or two.
  // Exclude email if it appears there.
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (line.includes("@") || line.includes("http")) continue; // Skip contact lines
    if (line.length > 3 && line.length < 30 && !/resume|curriculum|vitae/i.test(line)) {
      // Basic check: looks like a name (2-3 words usually)
      const words = line.split(" ");
      if (words.length >= 2 && words.length <= 4) {
        return line;
      }
    }
  }
  return "Unknown Candidate";
};

const segmentSections = (text: string) => {
  const sections: { [key: string]: string } = {};
  
  // Common headers
  const headers = {
    experience: /(?:work|professional|relavent)\s+(?:experience|history)|employment/i,
    education: /education|academic|qualifications/i,
    skills: /skills|technologies|technical|proficiencies|stack/i,
    projects: /projects/i
  };

  const lines = text.split('\n');
  let currentSection = "header";
  let buffer = [];

  for (const line of lines) {
    let isHeader = false;
    
    // Check if line is a header
    for (const [key, regex] of Object.entries(headers)) {
      if (regex.test(line) && line.length < 50) { // Headers are usually short
        // Save previous section
        if (currentSection) {
          sections[currentSection] = buffer.join('\n');
        }
        currentSection = key;
        buffer = [];
        isHeader = true;
        break;
      }
    }

    if (!isHeader) {
      buffer.push(line);
    }
  }
  // Save last section
  if (currentSection) {
    sections[currentSection] = buffer.join('\n');
  }

  return sections;
};

const extractSkills = (text: string): Skill[] => {
  const commonTech = [
    "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "C++", 
    "AWS", "Docker", "Kubernetes", "SQL", "NoSQL", "Git", "HTML", "CSS",
    "Next.js", "Vue", "Angular", "Go", "Rust", "Swift", "Kotlin", "Flutter",
    "Terraform", "Azure", "GCP", "GraphQL", "REST", "CI/CD"
  ];

  const foundSkills: Skill[] = [];
  const lowerText = text.toLowerCase();

  commonTech.forEach(tech => {
    // Regex boundary to avoid matching "Java" in "JavaScript" incorrectly if we iterate strictly
    // But mostly we just check presence
    if (lowerText.includes(tech.toLowerCase())) {
        // Simple heuristic: if mentioned, add it.
        // We don't know proficiency yet, default to 1 (beginner) or 3 (proficient)
        foundSkills.push({
            name: tech,
            proficiency: 3, 
            evidence: ["Extracted from resume text"]
        });
    }
  });

  return foundSkills;
};

const extractEducation = (text: string): Education[] => {
  const edu: Education[] = [];
  // Look for years (YYYY or YYYY-YYYY)
  const lines = text.split('\n');
  
  let currentSchool = "";
  let currentDegree = "";
  let currentYear = "";

  lines.forEach(line => {
    // Heuristic: Schools often contain "University", "College", "Institute"
    if (/university|college|institute|school/i.test(line)) {
        if (currentSchool) {
            // Push previous if exists
             edu.push({ school: currentSchool, degree: currentDegree || "Degree", year: currentYear || "Present" });
             currentDegree = "";
             currentYear = "";
        }
        currentSchool = line.trim();
    }
    // Heuristic: Degrees contain "Bachelor", "Master", "PhD", "B.S.", "M.S."
    else if (/bachelor|master|phd|b\.?s\.?|m\.?s\.?|degree|diploma/i.test(line)) {
        currentDegree = line.trim();
    }
    // Heuristic: Years
    else if (/\d{4}/.test(line)) {
        const match = line.match(/(\d{4})/g);
        if (match) currentYear = match.join(" - ");
    }
  });

  if (currentSchool) {
      edu.push({ school: currentSchool, degree: currentDegree || "Degree", year: currentYear || "Present" });
  }

  return edu;
};

const extractExperience = (text: string): ExperienceAtom[] => {
    // This is the hardest part to heuristic parsing.
    // We'll try to split by dates roughly.
    const atoms: ExperienceAtom[] = [];
    
    // Very dummy splitter: usually roles have dates on the same line or line below.
    // Regex for dates: (Jan 2020 - Present) or (2020-2021)
    const dateRegex = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|\d{4}\s*-\s*\d{4})/i;

    const lines = text.split('\n');
    let currentAtom: Partial<ExperienceAtom> | null = null;
    let buffer: string[] = [];

    lines.forEach(line => {
        if (dateRegex.test(line) && line.length < 100) {
            // Likely a header line for a job
            if (currentAtom) {
                currentAtom.content = buffer.join('\n');
                // Try to clean keywords
                currentAtom.keywords = [];
                atoms.push(currentAtom as ExperienceAtom);
            }
            
            // Start new atom
            currentAtom = {
                id: Math.random().toString(36).substring(7),
                company: "Unknown Company", // Hard to distinguish company from role without NLP
                role: line.replace(dateRegex, '').trim(), // Remove date to get potential role/company
                duration: line.match(dateRegex)?.[0] || "",
                content: "",
                keywords: []
            };
            buffer = [];
        } else {
            if (currentAtom) {
                buffer.push(line);
            }
        }
    });

    if (currentAtom) {
        currentAtom.content = buffer.join('\n');
        atoms.push(currentAtom as ExperienceAtom);
    }

    return atoms;
};
