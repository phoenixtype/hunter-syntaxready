import { describe, it, expect } from "vitest";
import { scoreProfileHealth, ATSHealthCheck } from "@/lib/ats_scorer";
import { CandidateProfile } from "@/lib/resume_engine";

const createMockProfile = (overrides: Partial<CandidateProfile> = {}): CandidateProfile => ({
  identity: {
    name: "Jane Doe",
    email: "jane@test.com",
    phone: "(555) 123-4567",
    links: ["https://linkedin.com/in/jane"],
  },
  skills: [
    { name: "React", proficiency: 90, evidence: ["Built SPA"] },
    { name: "TypeScript", proficiency: 85, evidence: ["3 years"] },
    { name: "Node.js", proficiency: 70, evidence: ["REST APIs"] },
    { name: "Python", proficiency: 75, evidence: ["Scripts"] },
    { name: "SQL", proficiency: 80, evidence: ["Database design"] },
    { name: "AWS", proficiency: 65, evidence: ["Cloud deployments"] },
    { name: "Docker", proficiency: 70, evidence: ["Containerization"] },
    { name: "Git", proficiency: 90, evidence: ["Version control"] },
  ],
  experience_atoms: [
    {
      id: "1",
      company: "Acme Inc",
      role: "Senior Engineer",
      duration: "2021-2023",
      content: "Led a team of 5 engineers, improving deploy speed by 40% and reducing costs by $50K annually.",
      keywords: ["leadership", "CI/CD"],
    },
    {
      id: "2",
      company: "StartupCo",
      role: "Software Engineer",
      duration: "2019-2021",
      content: "Built microservices handling 1M+ requests daily. Increased test coverage from 40% to 85%.",
      keywords: ["microservices", "testing"],
    },
  ],
  education: [{ school: "MIT", degree: "BS Computer Science", year: "2019" }],
  ...overrides,
});

describe("scoreProfileHealth - Complete Profile", () => {
  it("gives high score to complete profile", () => {
    const health = scoreProfileHealth(createMockProfile());
    expect(health.totalScore).toBeGreaterThanOrEqual(80);
  });

  it("returns positive recommendation for good profile", () => {
    const health = scoreProfileHealth(createMockProfile());
    expect(health.recommendation).toContain("Excellent");
  });

  it("has all check categories at high scores", () => {
    const health = scoreProfileHealth(createMockProfile());
    expect(health.checks.identity.score).toBeGreaterThanOrEqual(90);
    expect(health.checks.skills.score).toBe(100);
    expect(health.checks.education.score).toBe(100);
  });
});

describe("scoreProfileHealth - Identity Issues", () => {
  it("penalizes missing email", () => {
    const profile = createMockProfile({
      identity: { name: "Jane Doe", email: "", links: [] },
    });
    const health = scoreProfileHealth(profile);
    expect(health.checks.identity.score).toBeLessThan(100);
    expect(health.checks.identity.issues).toContain("Missing email address");
  });

  it("penalizes invalid email format", () => {
    const profile = createMockProfile({
      identity: { name: "Jane", email: "invalid-email", links: [] },
    });
    const health = scoreProfileHealth(profile);
    expect(health.checks.identity.issues).toContain("Invalid email format");
  });

  it("penalizes unknown name", () => {
    const profile = createMockProfile({
      identity: { name: "Unknown Candidate", email: "test@test.com", links: [] },
    });
    const health = scoreProfileHealth(profile);
    expect(health.checks.identity.issues).toContain("Could not detect full name");
  });

  it("penalizes missing professional links", () => {
    const profile = createMockProfile({
      identity: { name: "Jane", email: "jane@test.com", links: [] },
    });
    const health = scoreProfileHealth(profile);
    expect(health.checks.identity.issues).toContain("No professional links (LinkedIn/Github) found");
  });
});

describe("scoreProfileHealth - Skills Issues", () => {
  it("penalizes empty skills", () => {
    const profile = createMockProfile({ skills: [] });
    const health = scoreProfileHealth(profile);
    expect(health.checks.skills.score).toBeLessThan(100);
    expect(health.checks.skills.issues).toContain("No detectable technical skills found");
  });

  it("penalizes thin skill list", () => {
    const profile = createMockProfile({
      skills: [
        { name: "React", proficiency: 90, evidence: [] },
        { name: "TypeScript", proficiency: 85, evidence: [] },
      ],
    });
    const health = scoreProfileHealth(profile);
    expect(health.checks.skills.issues).toContain("Skill list is too thin (aim for 8+ skills)");
  });
});

describe("scoreProfileHealth - Experience Issues", () => {
  it("penalizes empty experience", () => {
    const profile = createMockProfile({ experience_atoms: [] });
    const health = scoreProfileHealth(profile);
    expect(health.checks.experience.score).toBeLessThan(100);
    expect(health.checks.experience.issues).toContain("No work experience detected");
  });

  it("penalizes experience without metrics", () => {
    const profile = createMockProfile({
      experience_atoms: [
        {
          id: "1",
          company: "Corp",
          role: "Dev",
          duration: "2020-2022",
          content: "Worked on various projects and collaborated with team members.",
          keywords: [],
        },
      ],
    });
    const health = scoreProfileHealth(profile);
    expect(health.checks.experience.issues.some(i => i.includes("lacks measurable impact"))).toBe(true);
  });

  it("penalizes short experience descriptions", () => {
    const profile = createMockProfile({
      experience_atoms: [
        {
          id: "1",
          company: "Corp",
          role: "Dev",
          duration: "2020-2022",
          content: "Did stuff.",
          keywords: [],
        },
      ],
    });
    const health = scoreProfileHealth(profile);
    expect(health.checks.experience.issues.some(i => i.includes("too short"))).toBe(true);
  });
});

describe("scoreProfileHealth - Education Issues", () => {
  it("notes missing education", () => {
    const profile = createMockProfile({ education: [] });
    const health = scoreProfileHealth(profile);
    expect(health.checks.education.issues).toContain("No education history found (optional but recommended)");
  });
});

describe("scoreProfileHealth - Score Calculation", () => {
  it("uses weighted scoring (identity 20%, skills 30%, experience 40%, education 10%)", () => {
    // Perfect profile should be 100
    const perfect = scoreProfileHealth(createMockProfile());
    expect(perfect.totalScore).toBeGreaterThanOrEqual(90);

    // Empty profile should be very low
    const empty: CandidateProfile = {
      identity: { name: "", email: "", links: [] },
      skills: [],
      experience_atoms: [],
      education: [],
    };
    const emptyHealth = scoreProfileHealth(empty);
    expect(emptyHealth.totalScore).toBeLessThan(50);
  });

  it("clamps scores to reasonable range", () => {
    const profile = createMockProfile();
    const health = scoreProfileHealth(profile);
    expect(health.totalScore).toBeGreaterThanOrEqual(0);
    expect(health.totalScore).toBeLessThanOrEqual(100);
  });

  it("provides appropriate recommendations based on score", () => {
    const goodProfile = createMockProfile();
    const goodHealth = scoreProfileHealth(goodProfile);
    expect(goodHealth.recommendation).toMatch(/Excellent|Good/);

    const badProfile: CandidateProfile = {
      identity: { name: "", email: "", links: [] },
      skills: [],
      experience_atoms: [],
      education: [],
    };
    const badHealth = scoreProfileHealth(badProfile);
    expect(badHealth.recommendation).toContain("Needs improvement");
  });
});
