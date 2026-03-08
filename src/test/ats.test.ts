import { describe, it, expect } from "vitest";
import { analyzeResumeForJob } from "@/lib/ats_engine";
import { scoreProfileHealth } from "@/lib/ats_scorer";
import { CandidateProfile } from "@/lib/resume_engine";

const mockProfile: CandidateProfile = {
  identity: { name: "Jane Doe", email: "jane@test.com", links: ["https://linkedin.com/in/jane"] },
  skills: [
    { name: "React", level: "expert" },
    { name: "TypeScript", level: "expert" },
    { name: "Node.js", level: "intermediate" },
  ],
  experience_atoms: [
    { company: "Acme Inc", role: "Senior Engineer", content: "Led a team of 5 engineers, improving deploy speed by 40%", start_date: "2021", end_date: "2023" },
  ],
  education: [{ institution: "MIT", degree: "BS Computer Science", start_date: "2017", end_date: "2021" }],
};

describe("ATS Engine", () => {
  it("scores a matching profile highly", async () => {
    const result = await analyzeResumeForJob(mockProfile, "Looking for a React and TypeScript developer");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("detects missing keywords", async () => {
    const result = await analyzeResumeForJob(mockProfile, "Requires Python, Kubernetes, and Terraform experience");
    expect(result.missing_keywords.length).toBeGreaterThan(0);
  });

  it("flags missing sections in empty profiles", async () => {
    const emptyProfile: CandidateProfile = {
      identity: { name: "", email: "", links: [] },
      skills: [],
      experience_atoms: [],
      education: [],
    };
    const result = await analyzeResumeForJob(emptyProfile, "Software Engineer");
    expect(result.formatting_issues.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(70);
  });
});

describe("ATS Health Scorer", () => {
  it("gives a high score to a complete profile", () => {
    const health = scoreProfileHealth(mockProfile);
    expect(health.totalScore).toBeGreaterThanOrEqual(80);
    expect(health.recommendation).toContain("Excellent");
  });

  it("penalizes missing email", () => {
    const noEmail = { ...mockProfile, identity: { ...mockProfile.identity, email: "" } };
    const health = scoreProfileHealth(noEmail);
    expect(health.checks.identity.score).toBeLessThan(100);
    expect(health.checks.identity.issues).toContain("Missing email address");
  });

  it("penalizes empty skills", () => {
    const noSkills = { ...mockProfile, skills: [] };
    const health = scoreProfileHealth(noSkills);
    expect(health.checks.skills.score).toBeLessThan(100);
  });
});
