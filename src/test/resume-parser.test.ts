import { describe, it, expect } from "vitest";
import { parseResumeHeuristic, toATSFormat } from "@/lib/resume_parser";
import { CandidateProfile } from "@/lib/resume_engine";

describe("parseResumeHeuristic", () => {
  it("returns empty profile for empty text", () => {
    const result = parseResumeHeuristic("");
    expect(result.identity.name).toBe("");
    expect(result.identity.email).toBe("");
    expect(result.skills).toEqual([]);
    expect(result.experience_atoms).toEqual([]);
    expect(result.education).toEqual([]);
  });

  it("extracts email correctly", () => {
    const text = "John Doe\njohn.doe@example.com\n(555) 123-4567";
    const result = parseResumeHeuristic(text);
    expect(result.identity.email).toBe("john.doe@example.com");
  });

  it("extracts phone number", () => {
    const text = "Jane Smith\njane@test.com\nPhone: (555) 987-6543";
    const result = parseResumeHeuristic(text);
    expect(result.identity.phone).toContain("555");
  });

  it("extracts LinkedIn links", () => {
    const text = "Alex Johnson\nalex@mail.com\nhttps://linkedin.com/in/alexj";
    const result = parseResumeHeuristic(text);
    expect(result.identity.links).toContain("https://linkedin.com/in/alexj");
  });

  it("extracts GitHub links", () => {
    const text = "Dev Person\ndev@mail.com\nhttps://github.com/devperson";
    const result = parseResumeHeuristic(text);
    expect(result.identity.links).toContain("https://github.com/devperson");
  });

  it("extracts name from first line", () => {
    const text = "Sarah Connor\nsarah@skynet.com";
    const result = parseResumeHeuristic(text);
    expect(result.identity.name).toBe("Sarah Connor");
  });

  it("extracts name from ALL CAPS format", () => {
    const text = "JOHN DOE\njohn@email.com";
    const result = parseResumeHeuristic(text);
    expect(result.identity.name).toBe("John Doe");
  });

  it("extracts common tech skills", () => {
    const text = "Skills\nJavaScript, React, Node.js, Python, AWS, Docker";
    const result = parseResumeHeuristic(text);
    const skillNames = result.skills.map(s => s.name);
    expect(skillNames).toContain("JavaScript");
    expect(skillNames).toContain("React");
    expect(skillNames).toContain("Python");
  });

  it("extracts education from text", () => {
    const text = `Education
Massachusetts Institute of Technology
Bachelor of Science in Computer Science
2020`;
    const result = parseResumeHeuristic(text);
    expect(result.education.length).toBeGreaterThan(0);
    expect(result.education[0].school).toContain("Massachusetts");
  });

  it("extracts experience with dates", () => {
    const text = `Experience
Software Engineer Jan 2022 - Present
Built scalable APIs serving 1M+ requests daily
Led team of 5 engineers`;
    const result = parseResumeHeuristic(text);
    expect(result.experience_atoms.length).toBeGreaterThan(0);
  });

  it("handles labeled Name: format", () => {
    const text = "Name: Alice Wonderland\nalice@example.com";
    const result = parseResumeHeuristic(text);
    expect(result.identity.name).toBe("Alice Wonderland");
  });

  it("deduplicates links", () => {
    const text = "Test\ntest@mail.com\nhttps://linkedin.com/in/test\nhttps://linkedin.com/in/test";
    const result = parseResumeHeuristic(text);
    expect(result.identity.links.length).toBe(1);
  });
});

describe("toATSFormat", () => {
  const mockProfile: CandidateProfile = {
    identity: {
      name: "  Jane Doe  ",
      email: "jane@test.com",
      phone: "(555) 123-4567",
      links: ["https://linkedin.com/in/jane"],
    },
    skills: [
      { name: "React", proficiency: 90, evidence: [] },
      { name: "TypeScript", proficiency: 85, evidence: [] },
      { name: "react", proficiency: 70, evidence: [] }, // duplicate
    ],
    experience_atoms: [
      {
        id: "1",
        company: "Acme Inc",
        role: "Senior Engineer",
        duration: "Jan 2021 - Present",
        content: "Led team of 5\nImproved performance by 40%",
        keywords: [],
      },
    ],
    education: [
      { school: "MIT", degree: "BS Computer Science", year: "2020" },
    ],
    summary: "Experienced engineer",
  };

  it("normalizes strings by trimming", () => {
    const ats = toATSFormat(mockProfile);
    expect(ats.fullName).toBe("Jane Doe");
  });

  it("deduplicates skills case-insensitively", () => {
    const ats = toATSFormat(mockProfile);
    expect(ats.skills.length).toBe(2); // React and TypeScript, not react again
  });

  it("extracts start date from duration", () => {
    const ats = toATSFormat(mockProfile);
    expect(ats.workExperience[0].startDate).toBe("Jan 2021");
  });

  it("extracts end date from duration", () => {
    const ats = toATSFormat(mockProfile);
    expect(ats.workExperience[0].endDate).toBe("Present");
  });

  it("parses responsibilities from content", () => {
    const ats = toATSFormat(mockProfile);
    expect(ats.workExperience[0].responsibilities.length).toBeGreaterThan(0);
  });

  it("maps education correctly", () => {
    const ats = toATSFormat(mockProfile);
    expect(ats.education[0].institution).toBe("MIT");
    expect(ats.education[0].degree).toBe("BS Computer Science");
    expect(ats.education[0].endDate).toBe("2020");
  });

  it("includes summary", () => {
    const ats = toATSFormat(mockProfile);
    expect(ats.summary).toBe("Experienced engineer");
  });

  it("handles null/undefined values gracefully", () => {
    const sparse: CandidateProfile = {
      identity: { name: "", email: "", links: [] },
      skills: [],
      experience_atoms: [],
      education: [],
    };
    const ats = toATSFormat(sparse);
    expect(ats.fullName).toBeNull();
    expect(ats.email).toBeNull();
    expect(ats.skills).toEqual([]);
  });

  it("handles year-only duration format", () => {
    const profile: CandidateProfile = {
      identity: { name: "Test", email: "test@test.com", links: [] },
      skills: [],
      experience_atoms: [
        {
          id: "1",
          company: "Corp",
          role: "Dev",
          duration: "2019 - 2023",
          content: "Developed features",
          keywords: [],
        },
      ],
      education: [],
    };
    const ats = toATSFormat(profile);
    expect(ats.workExperience[0].startDate).toBe("2019");
    expect(ats.workExperience[0].endDate).toBe("2023");
  });
});
