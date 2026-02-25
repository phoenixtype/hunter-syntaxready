import { CandidateProfile, Education, ExperienceAtom, Skill } from "./resume_engine";
import { ATSResumeData } from "./ats_types";

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

  if (!text || text.trim().length === 0) {
    return profile;
  }

  // 1. Identity Extraction
  profile.identity.email = extractEmail(text);
  profile.identity.name = extractName(text, profile.identity.email);
  profile.identity.phone = extractPhone(text);
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

/**
 * ATS Format Converter
 * Transforms internal CandidateProfile to standardized ATSResumeData schema
 * for automatic form auto-fill during onboarding.
 */
export const toATSFormat = (profile: CandidateProfile): ATSResumeData => {
  const atsData: ATSResumeData = {
    fullName: normalizeString(profile.identity.name),
    email: normalizeString(profile.identity.email),
    phone: normalizeString(profile.identity.phone),
    location: null, // Not currently extracted by heuristic parser
    summary: profile.summary || null,
    skills: deduplicateSkills(profile.skills.map(s => s.name)),
    workExperience: profile.experience_atoms.map(exp => ({
      jobTitle: normalizeString(exp.role),
      company: normalizeString(exp.company),
      startDate: extractStartDate(exp.duration),
      endDate: extractEndDate(exp.duration),
      responsibilities: parseResponsibilities(exp.content)
    })),
    education: profile.education.map(edu => ({
      degree: normalizeString(edu.degree),
      institution: normalizeString(edu.school),
      startDate: null,
      endDate: normalizeString(edu.year)
    }))
  };

  return atsData;
};

// --- ATS Helpers ---

const normalizeString = (value: string | undefined | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const deduplicateSkills = (skills: string[]): string[] => {
  const seen = new Set<string>();
  return skills.filter(skill => {
    const normalized = skill.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const extractStartDate = (duration: string | undefined): string | null => {
  if (!duration) return null;
  // Match patterns like "Jan 2020 - Present" or "2020 - 2023"
  const match = duration.match(/^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\d{4})/i);
  return match ? match[1].trim() : null;
};

const extractEndDate = (duration: string | undefined): string | null => {
  if (!duration) return null;
  // Match patterns like "Jan 2020 - Present" or "2020 - 2023"
  const match = duration.match(/[-–—]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\d{4}|Present|Current)/i);
  return match ? match[1].trim() : null;
};

const parseResponsibilities = (content: string | undefined): string[] => {
  if (!content) return [];
  return content
    .split(/[\n•\-*]/)
    .map(line => line.trim())
    .filter(line => line.length > 10); // Filter out very short fragments
};

// --- Helpers ---

const extractEmail = (text: string): string => {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const match = text.match(emailRegex);
  return match ? match[0] : "";
};

const extractPhone = (text: string): string => {
  // Various phone number formats
  const phonePatterns = [
    /(?:Phone|Tel|Cell|Mobile|Ph)[:\s]*([+\d][\d\s\-().]{8,})/i,  // Labeled phone
    /\+1[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,  // US format with +1
    /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,  // US format (xxx) xxx-xxxx
    /\+\d{1,3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/,  // International
  ];

  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      const phone = match[1] || match[0];
      const cleaned = phone.replace(/[^\d+\-().\s]/g, '').trim();
      if (cleaned.length >= 10) {
        return cleaned;
      }
    }
  }
  return "";
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
  // Normalize text: remove extra whitespace
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  // Strategy 1: Look for explicit "Name:" label
  const nameLabel = /(?:^|[\n\s])(?:Name|Full Name)\s*[:\-]\s*([A-Za-z]{2,}\s+[A-Za-z]{2,}[A-Za-z\s]*)/i;
  const labelMatch = normalizedText.match(nameLabel);
  if (labelMatch) {
    return labelMatch[1].trim().slice(0, 50);
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Strategy 2: First line that looks like a name (most common resume format)
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];

    // Skip if it contains these patterns
    if (line.includes("@") ||
        line.includes("http") ||
        line.includes("+1") ||
        line.includes("(") ||
        /resume|curriculum|vitae|objective|summary|profile|phone|email|address|linkedin/i.test(line)) {
      continue;
    }

    // Check if line looks like a name
    // Names are usually 2-4 words, each starting with capital
    const words = line.split(/\s+/).filter(w => w.length > 0);

    if (words.length >= 1 && words.length <= 5) {
      // Check if most words start with uppercase (name-like)
      const capitalWords = words.filter(w => /^[A-Z]/.test(w));

      if (capitalWords.length >= 1 && line.length >= 4 && line.length <= 50) {
        // Avoid lines that are all caps section headers
        const isAllCaps = /^[A-Z\s]+$/.test(line) && words.length > 2;
        if (!isAllCaps) {
          return line;
        }
      }
    }
  }

  // Strategy 3: Look for ALL CAPS name at start (common format)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (/^[A-Z]{2,}\s+[A-Z]{2,}/.test(line) && line.length < 40) {
      // Convert from "JOHN DOE" to "John Doe"
      return line.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  // Strategy 4: Extract from email if email contains name pattern
  if (email) {
    const emailPart = email.split('@')[0];
    // Check for firstname.lastname or firstname_lastname pattern
    const nameParts = emailPart.split(/[._-]/);
    if (nameParts.length >= 2 && nameParts[0].length > 1 && nameParts[1].length > 1) {
      return nameParts
        .slice(0, 2)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
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
    if (lowerText.includes(tech.toLowerCase())) {
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
  const lines = text.split('\n');

  let currentSchool = "";
  let currentDegree = "";
  let currentYear = "";

  lines.forEach(line => {
    // Heuristic: Schools often contain "University", "College", "Institute"
    if (/university|college|institute|school/i.test(line)) {
        if (currentSchool) {
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
    const atoms: ExperienceAtom[] = [];
    const dateRegex = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|\d{4}\s*-\s*\d{4})/i;

    const lines = text.split('\n');
    let currentAtom: Partial<ExperienceAtom> | null = null;
    let buffer: string[] = [];

    lines.forEach(line => {
        if (dateRegex.test(line) && line.length < 100) {
            // Likely a header line for a job
            if (currentAtom) {
                currentAtom.content = buffer.join('\n');
                currentAtom.keywords = [];
                atoms.push(currentAtom as ExperienceAtom);
            }

            // Start new atom
            currentAtom = {
                id: Math.random().toString(36).substring(7),
                company: "Unknown Company",
                role: line.replace(dateRegex, '').trim(),
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
